use crate::{
    auth::create_key,
    config::EdgeConfig,
    discovery::{http_client, refresh_configured},
    endpoint,
    error::EdgeError,
    models::*,
    persistence::Store,
    providers::adapter,
    run_server,
    secrets::{OsSecretStore, SecretStore},
};
use clap::{Parser, Subcommand};
use std::{net::SocketAddr, path::PathBuf, str::FromStr, sync::Arc};
use uuid::Uuid;

#[derive(Parser)]
#[command(name = "switchroute-edge", version, about = "Local SwitchRoute router")]
struct Args {
    #[command(subcommand)]
    command: Command,
    #[arg(long, global = true)]
    db: Option<PathBuf>,
}
#[derive(Subcommand)]
enum Command {
    Start {
        #[arg(long)]
        bind: Option<SocketAddr>,
    },
    Status {
        #[arg(long, default_value = "http://127.0.0.1:8787")]
        url: String,
    },
    Providers,
    Models,
    Routes,
    Doctor,
    Key {
        #[command(subcommand)]
        command: KeyCommand,
    },
    Runtime {
        #[command(subcommand)]
        command: RuntimeCommand,
    },
    Route {
        #[command(subcommand)]
        command: RouteCommand,
    },
}
#[derive(Subcommand)]
enum KeyCommand {
    Create {
        #[arg(long, default_value = "Local key")]
        name: String,
    },
}
#[derive(Subcommand)]
enum RuntimeCommand {
    Add {
        kind: String,
        url: String,
        #[arg(long)]
        name: Option<String>,
        #[arg(long)]
        secret_env: Option<String>,
    },
    Refresh,
}
#[derive(Subcommand)]
enum RouteCommand {
    Create {
        name: String,
        slug: String,
        #[arg(long, default_value = "local_first")]
        strategy: String,
        #[arg(long)]
        default: bool,
    },
    AddLocal {
        route: String,
        runtime: String,
        model: String,
        position: i64,
    },
    AddCloud {
        route: String,
        base_url: String,
        cloud_route: String,
        position: i64,
        #[arg(long, default_value = "SWITCHROUTE_CLOUD_KEY")]
        secret_env: String,
    },
    Target {
        target_id: String,
        enabled: bool,
    },
}

pub async fn run() -> Result<(), EdgeError> {
    let args = Args::parse();
    let config = EdgeConfig::load(None, args.db)?;
    let secrets: Arc<dyn SecretStore> = Arc::new(OsSecretStore);
    match args.command {
        Command::Start { bind } => {
            run_server(EdgeConfig::load(bind, Some(config.database_path))?, secrets).await
        }
        Command::Status { url } => {
            let r = http_client()?
                .get(format!("{}/health", url.trim_end_matches('/')))
                .send()
                .await?;
            println!(
                "{}",
                if r.status().is_success() {
                    "running"
                } else {
                    "unhealthy"
                }
            );
            Ok(())
        }
        other => run_offline(other, &config.database_path, secrets).await,
    }
}

async fn run_offline(
    command: Command,
    db: &std::path::Path,
    secrets: Arc<dyn SecretStore>,
) -> Result<(), EdgeError> {
    let store = Store::open(db)?;
    match command {
        Command::Providers => {
            for kind in RuntimeKind::P0 {
                let configured = store.runtimes()?.iter().any(|r| r.kind == kind);
                println!(
                    "{:<12} {}",
                    kind,
                    if configured {
                        "configured"
                    } else {
                        "not detected/configured"
                    }
                );
            }
            Ok(())
        }
        Command::Models => {
            for m in store.models()? {
                println!(
                    "{:<12} {:<40} {:?} loaded={:?}",
                    m.runtime, m.id, m.origin, m.loaded
                );
            }
            Ok(())
        }
        Command::Routes => {
            for r in store.routes()? {
                println!(
                    "{} [{}] strategy={} default={}",
                    r.slug, r.id, r.strategy, r.is_default
                );
                for t in store.targets(&r.id)? {
                    println!(
                        "  {} pos={} enabled={} {:?}",
                        t.id, t.position, t.enabled, t.target
                    );
                }
            }
            Ok(())
        }
        Command::Key {
            command: KeyCommand::Create { name },
        } => {
            println!("{}", create_key(&store, &name)?);
            Ok(())
        }
        Command::Runtime {
            command: RuntimeCommand::Refresh,
        } => {
            for (r, ok) in refresh_configured(&store, secrets).await? {
                println!(
                    "{:<12} {}",
                    r.kind,
                    if ok { "healthy" } else { "unavailable" }
                );
            }
            Ok(())
        }
        Command::Runtime {
            command:
                RuntimeCommand::Add {
                    kind,
                    url,
                    name,
                    secret_env,
                },
        } => {
            let kind = RuntimeKind::from_str(&kind).map_err(EdgeError::Invalid)?;
            let base_url = endpoint::validate_runtime_url(&url)?;
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
                .map(|r| secrets.get(r))
                .transpose()?;
            let a = adapter(kind);
            if !a.probe(&client, &runtime, secret.as_deref()).await {
                return Err(EdgeError::Upstream);
            }
            let models = a
                .discover_models(&client, &runtime, secret.as_deref())
                .await?;
            store.replace_models(&runtime.id, &models)?;
            println!("added {} with {} model(s)", runtime.id, models.len());
            Ok(())
        }
        Command::Route {
            command:
                RouteCommand::Create {
                    name,
                    slug,
                    strategy,
                    default,
                },
        } => {
            validate_slug(&slug)?;
            let r = store.create_route(
                &name,
                &slug,
                RouteStrategy::from_str(&strategy).map_err(EdgeError::Invalid)?,
                default,
            )?;
            println!("{}", r.id);
            Ok(())
        }
        Command::Route {
            command:
                RouteCommand::AddLocal {
                    route,
                    runtime,
                    model,
                    position,
                },
        } => {
            let r = find_route(&store, &route)?;
            if store.model(&runtime, &model)?.is_none() {
                return Err(EdgeError::NotFound(
                    "model is not in Edge discovery cache".into(),
                ));
            }
            let t = store.add_target(
                &r.id,
                position,
                TargetKind::Local {
                    runtime_id: runtime,
                    model_id: model,
                },
            )?;
            println!("{}", t.id);
            Ok(())
        }
        Command::Route {
            command:
                RouteCommand::AddCloud {
                    route,
                    base_url,
                    cloud_route,
                    position,
                    secret_env,
                },
        } => {
            let r = find_route(&store, &route)?;
            let value = std::env::var(&secret_env).map_err(|_| {
                EdgeError::Invalid(format!("environment variable {secret_env} is not set"))
            })?;
            let secret_ref = format!("cloud:{}:{}", r.id, Uuid::new_v4());
            secrets.put(&secret_ref, &value)?;
            let base_url = endpoint::validate_runtime_url(&base_url)?;
            let t = store.add_target(
                &r.id,
                position,
                TargetKind::Cloud {
                    base_url,
                    route_slug: cloud_route,
                    secret_ref,
                },
            )?;
            println!("{}", t.id);
            Ok(())
        }
        Command::Route {
            command: RouteCommand::Target { target_id, enabled },
        } => store.set_target_enabled(&target_id, enabled),
        Command::Doctor => doctor(&store, secrets).await,
        Command::Start { .. } | Command::Status { .. } => Ok(()),
    }
}

async fn doctor(store: &Store, secrets: Arc<dyn SecretStore>) -> Result<(), EdgeError> {
    println!("database: ok");
    let client = http_client()?;
    for r in store.runtimes()?.into_iter().filter(|r| r.enabled) {
        let secret = r
            .auth_secret_ref
            .as_deref()
            .map(|x| secrets.get(x))
            .transpose()?;
        let ok = adapter(r.kind).probe(&client, &r, secret.as_deref()).await;
        println!(
            "runtime {:<12} {}",
            r.kind,
            if ok { "ok" } else { "unavailable" }
        );
    }
    for route in store.routes()? {
        for t in store.targets(&route.id)? {
            if let TargetKind::Cloud {
                base_url,
                secret_ref,
                ..
            } = t.target
            {
                let secret = secrets.get(&secret_ref)?;
                let ok = client
                    .get(endpoint::models_url(&base_url))
                    .bearer_auth(secret)
                    .send()
                    .await
                    .map(|r| r.status().is_success())
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
fn find_route(store: &Store, slug: &str) -> Result<EdgeRoute, EdgeError> {
    store
        .routes()?
        .into_iter()
        .find(|r| r.slug == slug || r.id == slug)
        .ok_or_else(|| EdgeError::NotFound("route not found".into()))
}
fn validate_slug(v: &str) -> Result<(), EdgeError> {
    if v.len() < 2
        || v.len() > 64
        || !v
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
    {
        return Err(EdgeError::Invalid(
            "route slug must be lowercase letters, numbers, and hyphens".into(),
        ));
    }
    Ok(())
}
