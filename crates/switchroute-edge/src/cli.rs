use crate::{
    cli_daemon,
    cli_offline,
    config::EdgeConfig,
    error::EdgeError,
    run_server,
    secrets::{OsSecretStore, SecretStore},
};
use clap::{Parser, Subcommand};
use std::{net::SocketAddr, path::PathBuf, sync::Arc};

#[derive(Parser)]
#[command(
    name = "switchroute-edge",
    version = env!("SWITCHROUTE_VERSION"),
    about = "Local SwitchRoute router"
)]
struct Args {
    #[command(subcommand)]
    command: Command,
    #[arg(long, global = true)]
    db: Option<PathBuf>,
}

#[derive(Subcommand)]
pub(crate) enum Command {
    Start {
        #[arg(long)]
        bind: Option<SocketAddr>,
        #[arg(long)]
        foreground: bool,
    },
    Stop {
        #[arg(long, default_value = "http://127.0.0.1:8787")]
        url: String,
    },
    Status {
        #[arg(long, default_value = "http://127.0.0.1:8787")]
        url: String,
    },
    Discover,
    Doctor,
    Runtime {
        #[command(subcommand)]
        command: RuntimeCommand,
    },
    Model {
        #[command(subcommand)]
        command: ModelCommand,
    },
    Route {
        #[command(subcommand)]
        command: RouteCommand,
    },
    Key {
        #[command(subcommand)]
        command: KeyCommand,
    },
    #[command(hide = true)]
    Serve {
        #[arg(long)]
        bind: Option<SocketAddr>,
    },
}

#[derive(Subcommand)]
pub(crate) enum KeyCommand {
    Create {
        #[arg(long, default_value = "Local key")]
        name: String,
    },
    List,
    Revoke {
        id_or_prefix: String,
    },
}

#[derive(Subcommand)]
pub(crate) enum RuntimeCommand {
    List,
    Add {
        kind: String,
        url: String,
        #[arg(long)]
        name: Option<String>,
        #[arg(long)]
        secret_env: Option<String>,
    },
    Remove {
        runtime: String,
    },
    Refresh,
}

#[derive(Subcommand)]
pub(crate) enum ModelCommand {
    List,
}

#[derive(Subcommand)]
pub(crate) enum RouteCommand {
    List,
    Inspect {
        route: String,
    },
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
        Command::Start { bind, foreground } => {
            let start_config = EdgeConfig::load(bind, Some(config.database_path))?;
            if foreground {
                run_server(start_config, secrets).await
            } else {
                cli_daemon::start(&start_config).await
            }
        }
        Command::Serve { bind } => {
            run_server(EdgeConfig::load(bind, Some(config.database_path))?, secrets).await
        }
        Command::Stop { url } => cli_daemon::stop(&config.database_path, &url).await,
        Command::Status { url } => cli_daemon::status(&url).await,
        other => cli_offline::run(other, &config.database_path, secrets).await,
    }
}
