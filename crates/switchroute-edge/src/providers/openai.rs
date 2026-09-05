use super::{authorized, RuntimeAdapter};
use crate::{endpoint, error::EdgeError, models::*};
use async_trait::async_trait;
use reqwest::Client;
use serde_json::Value;

pub struct OpenAiRuntimeAdapter {
    kind: RuntimeKind,
}
impl OpenAiRuntimeAdapter {
    pub fn new(kind: RuntimeKind) -> Self {
        Self { kind }
    }
}

#[async_trait]
impl RuntimeAdapter for OpenAiRuntimeAdapter {
    fn kind(&self) -> RuntimeKind {
        self.kind
    }
    fn default_connection(&self) -> Option<RuntimeConnection> {
        let base = match self.kind {
            RuntimeKind::LmStudio => "http://127.0.0.1:1234",
            RuntimeKind::Vllm => "http://127.0.0.1:8000",
            RuntimeKind::LlamaCpp => "http://127.0.0.1:8080",
            RuntimeKind::Sglang => "http://127.0.0.1:30000",
            RuntimeKind::LocalAi => "http://127.0.0.1:8080",
            RuntimeKind::FreeToken => "http://127.0.0.1:1919",
            RuntimeKind::Custom | RuntimeKind::Ollama => return None,
        };
        Some(RuntimeConnection {
            id: format!("auto-{}", self.kind.id()),
            kind: self.kind,
            display_name: self.kind.display_name().into(),
            base_url: base.into(),
            enabled: true,
            manual: false,
            auth_secret_ref: None,
        })
    }
    async fn probe(
        &self,
        client: &Client,
        runtime: &RuntimeConnection,
        secret: Option<&str>,
    ) -> bool {
        let url = match self.kind {
            RuntimeKind::LmStudio => endpoint::native_url(&runtime.base_url, "/api/v1/models"),
            RuntimeKind::LlamaCpp => endpoint::native_url(&runtime.base_url, "/health"),
            RuntimeKind::LocalAi => endpoint::native_url(&runtime.base_url, "/readyz"),
            RuntimeKind::FreeToken => endpoint::native_url(&runtime.base_url, "/health"),
            _ => endpoint::models_url(&runtime.base_url),
        };
        authorized(client.get(url), secret)
            .send()
            .await
            .map(|r| r.status().is_success())
            .unwrap_or(false)
    }
    async fn discover_models(
        &self,
        client: &Client,
        runtime: &RuntimeConnection,
        secret: Option<&str>,
    ) -> Result<Vec<EdgeModel>, EdgeError> {
        let url = if self.kind == RuntimeKind::LmStudio {
            endpoint::native_url(&runtime.base_url, "/api/v1/models")
        } else {
            endpoint::models_url(&runtime.base_url)
        };
        let response = authorized(client.get(url), secret).send().await?;
        if !response.status().is_success() {
            return Err(EdgeError::Upstream);
        }
        let value: Value = response.json().await?;
        let items = value
            .get("data")
            .or_else(|| value.get("models"))
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();
        let mut out = Vec::new();
        for item in items {
            let id = item
                .get("id")
                .or_else(|| item.get("key"))
                .or_else(|| item.get("model"))
                .and_then(Value::as_str);
            let Some(id) = id else { continue };
            let context = item
                .get("context_length")
                .or_else(|| item.get("max_context_length"))
                .and_then(Value::as_u64);
            let loaded = item.get("loaded").and_then(Value::as_bool).or_else(|| {
                item.get("status")
                    .and_then(Value::as_str)
                    .map(|s| s.eq_ignore_ascii_case("loaded"))
            });
            out.push(EdgeModel {
                runtime_id: runtime.id.clone(),
                runtime: self.kind,
                id: id.into(),
                display_name: item
                    .get("display_name")
                    .and_then(Value::as_str)
                    .unwrap_or(id)
                    .into(),
                origin: ModelOrigin::Local,
                context_length: context,
                capabilities: Vec::new(),
                loaded,
                healthy: true,
                metadata_provenance: format!("{} model API", self.kind.display_name()),
                metadata: item,
            });
        }
        Ok(out)
    }
}
