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
pub mod router;
pub mod secrets;
pub mod stream;

use crate::{config::EdgeConfig, error::EdgeError, persistence::Store, secrets::SecretStore};
use axum::Router;
use std::sync::Arc;

pub async fn run_server(
    config: EdgeConfig,
    secrets: Arc<dyn SecretStore>,
) -> Result<(), EdgeError> {
    let store = Store::open(&config.database_path)?;
    let app: Router = api::router(store, secrets);
    let listener = tokio::net::TcpListener::bind(config.bind).await?;
    tracing::info!(bind = %config.bind, "SwitchRoute Edge listening");
    axum::serve(listener, app).await?;
    Ok(())
}
