use crate::{
    auth::verify_key, error::EdgeError, persistence::Store, routing::RouterEngine,
    secrets::SecretStore,
};
use axum::{
    extract::State,
    http::{header, HeaderMap},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use chrono::Utc;
use serde_json::{json, Value};
use std::sync::Arc;
#[derive(Clone)]
pub struct AppState {
    pub store: Store,
    pub secrets: Arc<dyn SecretStore>,
}
pub fn app(state: AppState) -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/v1/models", get(models))
        .route("/v1/chat/completions", post(chat))
        .with_state(state)
}
async fn health() -> impl IntoResponse {
    Json(json!({"status":"ok","service":"switchroute-edge","exposure":"loopback-only"}))
}
async fn models(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Value>, EdgeError> {
    authenticate(&state, &headers)?;
    let created = Utc::now().timestamp();
    let mut data =
        vec![json!({"id":"auto","object":"model","created":created,"owned_by":"switchroute-edge"})];
    for r in state.store.routes()?.into_iter().filter(|r| r.enabled) {
        data.push(
            json!({"id":r.slug,"object":"model","created":created,"owned_by":"switchroute-edge"}),
        );
    }
    Ok(Json(json!({"object":"list","data":data})))
}
async fn chat(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<Value>,
) -> Result<Response, EdgeError> {
    authenticate(&state, &headers)?;
    let model = payload
        .get("model")
        .and_then(Value::as_str)
        .ok_or_else(|| EdgeError::Invalid("model is required".into()))?;
    if payload.get("messages").and_then(Value::as_array).is_none() {
        return Err(EdgeError::Invalid("messages must be an array".into()));
    }
    let route = state
        .store
        .resolve_route(model)?
        .ok_or_else(|| EdgeError::Invalid("use model='auto' or an Edge Route slug".into()))?;
    let engine = RouterEngine::new(state.store.clone(), state.secrets.clone())?;
    if payload
        .get("stream")
        .and_then(Value::as_bool)
        .unwrap_or(false)
    {
        engine.stream(&route, &payload).await
    } else {
        engine.complete(&route, &payload).await
    }
}
fn authenticate(state: &AppState, headers: &HeaderMap) -> Result<(), EdgeError> {
    let h = headers
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .ok_or(EdgeError::Unauthorized)?;
    verify_key(
        &state.store,
        h.strip_prefix("Bearer ").ok_or(EdgeError::Unauthorized)?,
    )
}
