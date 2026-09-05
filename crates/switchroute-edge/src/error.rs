use axum::{http::StatusCode, response::IntoResponse, Json};
use serde_json::json;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum EdgeError {
    #[error("invalid request: {0}")]
    Invalid(String),
    #[error("unauthorized")]
    Unauthorized,
    #[error("not found: {0}")]
    NotFound(String),
    #[error("upstream unavailable")]
    Upstream,
    #[error("storage error")]
    Storage,
    #[error("secret store error")]
    Secret,
    #[error("internal error")]
    Internal,
}

impl EdgeError {
    pub fn category(&self) -> &'static str {
        match self {
            Self::Invalid(_) => "invalid_request",
            Self::Unauthorized => "authentication_error",
            Self::NotFound(_) => "not_found",
            Self::Upstream => "upstream_unavailable",
            Self::Storage => "storage_error",
            Self::Secret => "secret_error",
            Self::Internal => "internal_error",
        }
    }
}

impl IntoResponse for EdgeError {
    fn into_response(self) -> axum::response::Response {
        let status = match &self {
            Self::Invalid(_) => StatusCode::BAD_REQUEST,
            Self::Unauthorized => StatusCode::UNAUTHORIZED,
            Self::NotFound(_) => StatusCode::NOT_FOUND,
            Self::Upstream => StatusCode::BAD_GATEWAY,
            Self::Storage | Self::Secret | Self::Internal => StatusCode::INTERNAL_SERVER_ERROR,
        };
        let message = match &self {
            Self::Invalid(m) | Self::NotFound(m) => m.as_str(),
            Self::Unauthorized => "Invalid SwitchRoute Edge API key.",
            Self::Upstream => "No eligible Edge target completed the request.",
            Self::Storage => "Edge local storage failed.",
            Self::Secret => "Edge credential storage failed.",
            Self::Internal => "SwitchRoute Edge encountered an internal error.",
        };
        (
            status,
            Json(
                json!({"error":{"message":message,"type":self.category(),"code":self.category()}}),
            ),
        )
            .into_response()
    }
}

impl From<rusqlite::Error> for EdgeError {
    fn from(_: rusqlite::Error) -> Self {
        Self::Storage
    }
}
impl From<reqwest::Error> for EdgeError {
    fn from(_: reqwest::Error) -> Self {
        Self::Upstream
    }
}
