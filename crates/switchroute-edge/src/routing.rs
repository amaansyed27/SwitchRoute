use crate::{
    discovery::http_client,
    error::EdgeError,
    models::*,
    persistence::Store,
    providers::send_chat,
    secrets::SecretStore,
    streaming::commit_sse,
};
use axum::{
    body::Body,
    http::{header, HeaderValue, StatusCode},
    response::Response,
};
use reqwest::Client;
use serde_json::Value;
use std::{sync::Arc, time::Instant};
use uuid::Uuid;

#[derive(Clone)]
pub struct RouterEngine {
    pub store: Store,
    pub secrets: Arc<dyn SecretStore>,
    pub client: Client,
}

impl RouterEngine {
    pub fn new(store: Store, secrets: Arc<dyn SecretStore>) -> Result<Self, EdgeError> {
        Ok(Self {
            store,
            secrets,
            client: http_client()?,
        })
    }

    fn ordered_targets(&self, route: &EdgeRoute) -> Result<Vec<RouteTarget>, EdgeError> {
        let mut targets = self
            .store
            .targets(&route.id)?
            .into_iter()
            .filter(|target| target.enabled)
            .collect::<Vec<_>>();
        targets.retain(|target| self.target_eligible(target).unwrap_or(false));
        targets.sort_by_key(|target| {
            let group = match route.strategy {
                RouteStrategy::Priority => 0,
                RouteStrategy::LocalFirst | RouteStrategy::FreeFirst => {
                    if self.target_is_confirmed_local(target).unwrap_or(false) {
                        0
                    } else {
                        1
                    }
                }
            };
            (group, target.position)
        });
        Ok(targets)
    }

    fn target_eligible(&self, target: &RouteTarget) -> Result<bool, EdgeError> {
        match &target.target {
            TargetKind::Local {
                runtime_id,
                model_id,
            } => Ok(self
                .store
                .runtime(runtime_id)?
                .is_some_and(|runtime| runtime.enabled)
                && self
                    .store
                    .model(runtime_id, model_id)?
                    .is_some_and(|model| model.healthy)),
            TargetKind::Cloud { .. } => Ok(true),
        }
    }

    fn target_is_confirmed_local(&self, target: &RouteTarget) -> Result<bool, EdgeError> {
        match &target.target {
            TargetKind::Local {
                runtime_id,
                model_id,
            } => Ok(matches!(
                self.store.model(runtime_id, model_id)?.map(|model| model.origin),
                Some(ModelOrigin::Local)
            )),
            TargetKind::Cloud { .. } => Ok(false),
        }
    }

    pub async fn complete(
        &self,
        route: &EdgeRoute,
        payload: &Value,
    ) -> Result<Response, EdgeError> {
        let started = Instant::now();
        let request_id = Uuid::new_v4().to_string();
        let mut path = Vec::new();
        for (index, target) in self.ordered_targets(route)?.into_iter().enumerate() {
            let label = self.target_label(&target)?;
            path.push(label.clone());
            let Ok(response) = self.open_target(&target, payload, false).await else {
                continue;
            };
            if !response.status().is_success() {
                continue;
            }
            let body: Value = response.json().await.map_err(|_| EdgeError::Upstream)?;
            let mut activity = self.activity_base(&request_id, route, &target, &label, &path);
            activity.latency_ms = started.elapsed().as_millis() as i64;
            activity.fallback_count = index as i64;
            let _ = self.store.record_activity(&activity);
            return Ok(json_response(StatusCode::OK, body));
        }
        self.record_failure(&request_id, route, started, &path);
        Err(EdgeError::Upstream)
    }

    pub async fn stream(&self, route: &EdgeRoute, payload: &Value) -> Result<Response, EdgeError> {
        let started = Instant::now();
        let request_id = Uuid::new_v4().to_string();
        let mut path = Vec::new();
        for (index, target) in self.ordered_targets(route)?.into_iter().enumerate() {
            let label = self.target_label(&target)?;
            path.push(label.clone());
            let Ok(response) = self.open_target(&target, payload, true).await else {
                continue;
            };
            if !response.status().is_success() {
                continue;
            }
            let mut activity = self.activity_base(&request_id, route, &target, &label, &path);
            activity.fallback_count = index as i64;
            if let Some(response) = commit_sse(response, self.store.clone(), activity, started).await? {
                return Ok(response);
            }
        }
        self.record_failure(&request_id, route, started, &path);
        Err(EdgeError::Upstream)
    }

    async fn open_target(
        &self,
        target: &RouteTarget,
        payload: &Value,
        stream: bool,
    ) -> Result<reqwest::Response, EdgeError> {
        let mut outgoing = payload.clone();
        outgoing["stream"] = Value::Bool(stream);
        match &target.target {
            TargetKind::Local {
                runtime_id,
                model_id,
            } => {
                let runtime = self
                    .store
                    .runtime(runtime_id)?
                    .ok_or_else(|| EdgeError::NotFound("runtime not found".into()))?;
                outgoing["model"] = Value::String(model_id.clone());
                let secret = runtime
                    .auth_secret_ref
                    .as_deref()
                    .map(|reference| self.secrets.get(reference))
                    .transpose()?;
                send_chat(&self.client, &runtime, secret.as_deref(), &outgoing).await
            }
            TargetKind::Cloud {
                base_url,
                route_slug,
                secret_ref,
            } => {
                outgoing["model"] = Value::String(route_slug.clone());
                let secret = self.secrets.get(secret_ref)?;
                Ok(self
                    .client
                    .post(crate::endpoint::chat_url(base_url))
                    .bearer_auth(secret)
                    .json(&outgoing)
                    .send()
                    .await?)
            }
        }
    }

    fn target_label(&self, target: &RouteTarget) -> Result<String, EdgeError> {
        match &target.target {
            TargetKind::Local { runtime_id, .. } => Ok(self
                .store
                .runtime(runtime_id)?
                .map(|runtime| runtime.kind.to_string())
                .unwrap_or_else(|| "local".into())),
            TargetKind::Cloud { route_slug, .. } => {
                Ok(format!("switchroute-cloud:{route_slug}"))
            }
        }
    }

    fn target_model_origin(&self, target: &RouteTarget) -> (String, ModelOrigin) {
        match &target.target {
            TargetKind::Local {
                runtime_id,
                model_id,
            } => (
                model_id.clone(),
                self.store
                    .model(runtime_id, model_id)
                    .ok()
                    .flatten()
                    .map(|model| model.origin)
                    .unwrap_or(ModelOrigin::Unknown),
            ),
            TargetKind::Cloud { route_slug, .. } => (route_slug.clone(), ModelOrigin::Cloud),
        }
    }

    fn activity_base(
        &self,
        request_id: &str,
        route: &EdgeRoute,
        target: &RouteTarget,
        label: &str,
        path: &[String],
    ) -> ActivityRecord {
        let (model_id, origin) = self.target_model_origin(target);
        ActivityRecord {
            request_id: request_id.into(),
            route_id: route.id.clone(),
            target_label: label.into(),
            model_id,
            origin,
            latency_ms: 0,
            ttft_ms: None,
            fallback_count: 0,
            fallback_path: path.to_vec(),
            status: "success".into(),
            error_category: None,
        }
    }

    fn record_failure(
        &self,
        request_id: &str,
        route: &EdgeRoute,
        started: Instant,
        path: &[String],
    ) {
        let activity = ActivityRecord {
            request_id: request_id.into(),
            route_id: route.id.clone(),
            target_label: path.last().cloned().unwrap_or_else(|| "none".into()),
            model_id: "unknown".into(),
            origin: ModelOrigin::Unknown,
            latency_ms: started.elapsed().as_millis() as i64,
            ttft_ms: None,
            fallback_count: path.len().saturating_sub(1) as i64,
            fallback_path: path.to_vec(),
            status: "error".into(),
            error_category: Some("upstream_unavailable".into()),
        };
        let _ = self.store.record_activity(&activity);
    }
}

fn json_response(status: StatusCode, value: Value) -> Response {
    let mut response = Response::new(Body::from(value.to_string()));
    *response.status_mut() = status;
    response.headers_mut().insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static("application/json"),
    );
    response
}
