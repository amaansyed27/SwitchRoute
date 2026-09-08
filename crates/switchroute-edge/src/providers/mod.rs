mod ollama;
mod openai;

use crate::{endpoint, error::EdgeError, models::*};
use async_trait::async_trait;
use reqwest::{Client, RequestBuilder, Response};
use serde_json::Value;

pub use ollama::OllamaAdapter;
pub use openai::OpenAiRuntimeAdapter;

#[async_trait]
pub trait RuntimeAdapter: Send + Sync {
    fn kind(&self) -> RuntimeKind;
    fn default_connection(&self) -> Option<RuntimeConnection>;
    async fn probe(
        &self,
        client: &Client,
        runtime: &RuntimeConnection,
        secret: Option<&str>,
    ) -> bool;
    async fn discover_models(
        &self,
        client: &Client,
        runtime: &RuntimeConnection,
        secret: Option<&str>,
    ) -> Result<Vec<EdgeModel>, EdgeError>;
}

pub fn adapter(kind: RuntimeKind) -> Box<dyn RuntimeAdapter> {
    match kind {
        RuntimeKind::Ollama => Box::new(OllamaAdapter),
        other => Box::new(OpenAiRuntimeAdapter::new(other)),
    }
}
pub fn default_connections() -> Vec<RuntimeConnection> {
    RuntimeKind::P0
        .into_iter()
        .filter_map(|k| adapter(k).default_connection())
        .collect()
}
pub fn authorized(builder: RequestBuilder, secret: Option<&str>) -> RequestBuilder {
    if let Some(s) = secret {
        builder.bearer_auth(s)
    } else {
        builder
    }
}
pub async fn send_chat(
    client: &Client,
    runtime: &RuntimeConnection,
    secret: Option<&str>,
    payload: &Value,
) -> Result<Response, EdgeError> {
    Ok(authorized(
        client
            .post(endpoint::chat_url(&runtime.base_url))
            .json(payload),
        secret,
    )
    .send()
    .await?)
}
