pub mod api;
pub mod auth;
pub mod cli;
mod cli_daemon;
mod cli_offline;
pub mod config;
pub mod discovery;
pub mod endpoint;
pub mod error;
pub mod models;
pub mod persistence;
pub mod providers;
pub mod routing;
pub mod secrets;
pub mod streaming;

use api::AppState;
use auth::create_key;
use config::EdgeConfig;
use discovery::{detect_common, refresh_configured};
use error::EdgeError;
use persistence::Store;
use secrets::SecretStore;
use std::sync::Arc;

pub async fn run_server(
    config: EdgeConfig,
    secrets: Arc<dyn SecretStore>,
) -> Result<(), EdgeError> {
    config.validate()?;
    let store = Store::open(&config.database_path)?;
    if store.api_key_count()? == 0 {
        let key = create_key(&store, "Initial local key")?;
        println!("SwitchRoute Edge API key (shown once): {key}");
    }
    let _ = detect_common(&store, secrets.clone()).await;
    let _ = refresh_configured(&store, secrets.clone()).await;
    spawn_discovery(store.clone(), secrets.clone());
    let listener = tokio::net::TcpListener::bind(config.bind)
        .await
        .map_err(|_| EdgeError::Internal)?;
    tracing::info!(bind=%config.bind,"SwitchRoute Edge listening");
    axum::serve(listener, api::app(AppState { store, secrets }))
        .with_graceful_shutdown(shutdown())
        .await
        .map_err(|_| EdgeError::Internal)
}

fn spawn_discovery(store: Store, secrets: Arc<dyn SecretStore>) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(std::time::Duration::from_secs(30));
        interval.tick().await;
        loop {
            interval.tick().await;
            let _ = detect_common(&store, secrets.clone()).await;
            let _ = refresh_configured(&store, secrets.clone()).await;
        }
    });
}

async fn shutdown() {
    let _ = tokio::signal::ctrl_c().await;
}
