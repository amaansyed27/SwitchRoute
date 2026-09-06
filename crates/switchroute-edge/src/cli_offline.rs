use crate::{
    auth::create_key,
    cli::{Command, KeyCommand, ModelCommand, RouteCommand, RuntimeCommand},
    cli_daemon,
    discovery::{detect_common, http_client, refresh_configured},
    endpoint,
    error::EdgeError,
    models::*,
    persistence::Store,
    providers::adapter,
    secrets::SecretStore,
};
use std::{path::Path, str::FromStr, sync::Arc};
use uuid::Uuid;

pub async fn run(
    command: Command,
    db: &Path,
    secrets: Arc<dyn SecretStore>,
) -> Result<(), EdgeError> {
    let store = Store::open(db)?;
    match command {
        Command::Discover => discover(&store, secrets).await,
        Command::Doctor => doctor(&store, db, secrets).await,
        Command::Runtime { command } => runtime(command, &store, secrets).await,
        Command::Model { command } => model(command, &store),
        Command::Route { command } => route(command, &store, secrets).await,
        Command::Key { command } => key(command, &store),
        Command::Start { .. }
        | Command::Stop { .. }
        | Command::Status { .. }
        | Command::Serve { .. } => Ok(()),
    }
}

async fn discover(store: &Store, secrets: Arc<dyn SecretStore>) -> Result<(), EdgeError> {
    let found = detect_common(store, secrets).await?;
    if found.is_empty() {
        println!("no common local runtime detected; use `runtime add` for a custom endpoint");
    } else {
        for runtime in found {
            println!("detected {:<12} {}", runtime.kind, runtime.base_url);
        }
    }
    Ok(())
}

async fn runtime(
    command: RuntimeCommand,
    store: &Store,
    secrets: Arc<dyn SecretStore>,
) -> Result<(), EdgeError> {
    match command {
        RuntimeCommand::List => {
            for runtime in store.runtimes()? {
                println!(
                    "{} {:<12} {} enabled={} manual={}",
                    runtime.id, runtime.kind, runtime.base_url, runtime.enabled, runtime.manual
                );
            }
            Ok(())
        }
        RuntimeCommand::Refresh => {
            for (runtime, ok) in refresh_configured(store, secrets).await? {
                println!(
                    "{:<12} {}",
                    runtime.kind,
                    if ok { "healthy" } else { "unavailable" }
                );
            }
            Ok(())
        }
        RuntimeCommand::Add {
            kind,
            url,
            name,
            secret_env,
        } => add_runtime(store, secrets, &kind, &url, name, secret_env).await,
        RuntimeCommand::Remove { runtime } => {
            let existing = store
                .runtime(&runtime)?
                .ok_or_else(|| EdgeError::NotFound("runtime not found".into()))?;
            for route in store.routes()? {
                for target in store.targets(&route.id)? {
                    if matches!(
                        &target.target,
                        TargetKind::Local { runtime_id, .. } if runtime_id == &runtime
                    ) {
                        return Err(EdgeError::Invalid(format!(
                            "runtime is still referenced by route {}; disable/remove that target first",
                            route.slug
                        )));
                    }
                }
            }
            if let Some(reference) = existing.auth_secret_ref.as_deref() {
                secrets.delete(reference)?;
            }
            if !store.remove_runtime(&runtime)? {
                return Err(EdgeError::NotFound("runtime not found".into()));
            }
            println!("removed {runtime}");
            Ok(())
        }
    }
}

async fn add_runtime(
    store: &Store,
    secrets: Arc<dyn SecretStore>,
    kind: &str,
    url: &str,
    name: Option<String>,
    secret_env: Option<String>,
) -> Result<(), EdgeError> {
    let kind = RuntimeKind::from_str(kind).map_err(EdgeError::Invalid)?;
    let base_url = endpoint::validate_runtime_url(url)?;
    let id = format!("manual-{}-{}", kind.id(), Uuid::new_v4());
    let secret_ref = if let Some(env_name) = secret_env {
        let value = std::env::var(&env_name).map_err(|_| {
            EdgeError::Invalid(format!("environment variable {env_name} is not set"))
        })?;
        let reference = format!("runtime:{id}");
        secrets.put(&reference, &value)?;
        Some(reference)
    } else {
        None
    };
    let runtime = RuntimeConnection {
        id,
        kind,
        display_name: name.unwrap_or_else(|| kind.display_name().into()),
        base_url,
        enabled: true,
        manual: true,
        auth_secret_ref: secret_ref,
    };
    store.upsert_runtime(&runtime)?;
    let client = http_client()?;
    let secret = runtime
        .auth_secret_ref
        .as_deref()
        .map(|reference| secrets.get(reference))
        .transpose()?;
    let runtime_adapter = adapter(kind);
    if !runtime_adapter
        .probe(&client, &runtime, secret.as_deref())
        .await
    {
        return Err(EdgeError::Upstream);
    }
    let models = runtime_adapter
        .discover_models(&client, &runtime, secret.as_deref())
        .await?;
    store.replace_models(&runtime.id, &models)?;
    println!("added {} with {} model(s)", runtime.id, models.len());
    Ok(())
}

fn model(command: ModelCommand, store: &Store) -> Result<(), EdgeError> {
    match command {
        ModelCommand::List => {
            for item in store.models()? {
                println!(
                    "{:<36} {:<40} {:?} loaded={:?}",
                    item.runtime_id, item.id, item.origin, item.loaded
                );
            }
            Ok(())
        }
    }
}

async fn route(
    command: RouteCommand,
    store: &Store,
    secrets: Arc<dyn SecretStore>,
) -> Result<(), EdgeError> {
    match command {
        RouteCommand::List => {
            for route in store.routes()? {
                println!(
                    "{} [{}] strategy={} default={} enabled={}",
                    route.slug, route.id, route.strategy, route.is_default, route.enabled
                );
            }
            Ok(())
        }
        RouteCommand::Inspect { route } => print_route(store, &find_route(store, &route)?),
        RouteCommand::Create {
            name,
            slug,
            strategy,
            default,
        } => {
            validate_slug(&slug)?;
            let created = store.create_route(
                &name,
                &slug,
                RouteStrategy::from_str(&strategy).map_err(EdgeError::Invalid)?,
                default,
            )?;
            println!("{}", created.id);
            Ok(())
        }
        RouteCommand::AddLocal {
            route,
            runtime,
            model,
            position,
        } => {
            let route = find_route(store, &route)?;
            if store.model(&runtime, &model)?.is_none() {
                return Err(EdgeError::NotFound(
                    "model is not in Edge discovery cache".into(),
                ));
            }
            let target = store.add_target(
                &route.id,
                position,
                TargetKind::Local {
                    runtime_id: runtime,
                    model_id: model,
                },
            )?;
            println!("{}", target.id);
            Ok(())
        }
        RouteCommand::AddCloud {
            route,
            base_url,
            cloud_route,
            position,
            secret_env,
        } => add_cloud(
            store,
            secrets,
            &route,
            &base_url,
            &cloud_route,
            position,
            &secret_env,
        ),
        RouteCommand::Target { target_id, enabled } => {
            store.set_target_enabled(&target_id, enabled)
        }
    }
}

fn add_cloud(
    store: &Store,
    secrets: Arc<dyn SecretStore>,
    route: &str,
    base_url: &str,
    cloud_route: &str,
    position: i64,
    secret_env: &str,
) -> Result<(), EdgeError> {
    let route = find_route(store, route)?;
    let value = std::env::var(secret_env)
        .map_err(|_| EdgeError::Invalid(format!("environment variable {secret_env} is not set")))?;
    let secret_ref = format!("cloud:{}:{}", route.id, Uuid::new_v4());
    secrets.put(&secret_ref, &value)?;
    let base_url = endpoint::validate_runtime_url(base_url)?;
    let target = store.add_target(
        &route.id,
        position,
        TargetKind::Cloud {
            base_url,
            route_slug: cloud_route.into(),
            secret_ref,
        },
    )?;
    println!("{}", target.id);
    Ok(())
}

fn print_route(store: &Store, route: &EdgeRoute) -> Result<(), EdgeError> {
    println!(
        "{} [{}] strategy={} default={} enabled={}",
        route.slug, route.id, route.strategy, route.is_default, route.enabled
    );
    for target in store.targets(&route.id)? {
        println!(
            "  {} pos={} enabled={} {:?}",
            target.id, target.position, target.enabled, target.target
        );
    }
    Ok(())
}

fn key(command: KeyCommand, store: &Store) -> Result<(), EdgeError> {
    match command {
        KeyCommand::Create { name } => {
            println!("{}", create_key(store, &name)?);
            Ok(())
        }
        KeyCommand::List => {
            for (id, name, prefix) in store.api_keys()? {
                println!("{id} {prefix} {name}");
            }
            Ok(())
        }
        KeyCommand::Revoke { id_or_prefix } => {
            if !store.revoke_api_key(&id_or_prefix)? {
                return Err(EdgeError::NotFound("key not found".into()));
            }
            println!("revoked {id_or_prefix}");
            Ok(())
        }
    }
}

async fn doctor(store: &Store, db: &Path, secrets: Arc<dyn SecretStore>) -> Result<(), EdgeError> {
    println!("database: ok ({})", db.display());
    let (pid, log) = cli_daemon::daemon_files(db);
    println!("daemon pid file: {}", pid.display());
    println!("daemon log: {}", log.display());
    println!("keys: {}", store.api_key_count()?);
    let client = http_client()?;
    for runtime in store.runtimes()?.into_iter().filter(|item| item.enabled) {
        let secret = runtime
            .auth_secret_ref
            .as_deref()
            .map(|reference| secrets.get(reference))
            .transpose()?;
        let ok = adapter(runtime.kind)
            .probe(&client, &runtime, secret.as_deref())
            .await;
        println!(
            "runtime {:<12} {}",
            runtime.kind,
            if ok { "ok" } else { "unavailable" }
        );
    }
    for route in store.routes()? {
        for target in store.targets(&route.id)? {
            if let TargetKind::Cloud {
                base_url,
                secret_ref,
                ..
            } = target.target
            {
                let secret = secrets.get(&secret_ref)?;
                let ok = client
                    .get(endpoint::models_url(&base_url))
                    .bearer_auth(secret)
                    .send()
                    .await
                    .map(|response| response.status().is_success())
                    .unwrap_or(false);
                println!(
                    "cloud {} {}",
                    route.slug,
                    if ok { "ok" } else { "unavailable" }
                );
            }
        }
    }
    Ok(())
}

fn find_route(store: &Store, slug_or_id: &str) -> Result<EdgeRoute, EdgeError> {
    store
        .routes()?
        .into_iter()
        .find(|route| route.slug == slug_or_id || route.id == slug_or_id)
        .ok_or_else(|| EdgeError::NotFound("route not found".into()))
}

fn validate_slug(value: &str) -> Result<(), EdgeError> {
    if value.len() < 2
        || value.len() > 64
        || !value
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
    {
        return Err(EdgeError::Invalid(
            "route slug must be lowercase letters, numbers, and hyphens".into(),
        ));
    }
    Ok(())
}
