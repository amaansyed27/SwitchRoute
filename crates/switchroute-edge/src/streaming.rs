use crate::{error::EdgeError, models::ActivityRecord, persistence::Store};
use axum::{
    body::Body,
    http::{header, HeaderValue, StatusCode},
    response::Response,
};
use bytes::Bytes;
use futures_util::{stream, StreamExt};
use serde_json::Value;
use std::{io, time::Instant};
use tokio::sync::mpsc;
use tokio_stream::wrappers::ReceiverStream;

const PRECOMMIT_BUFFER_LIMIT: usize = 262_144;

pub async fn commit_sse(
    response: reqwest::Response,
    store: Store,
    mut activity: ActivityRecord,
    started: Instant,
) -> Result<Option<Response>, EdgeError> {
    let mut upstream = response.bytes_stream();
    let mut buffered = Vec::<Bytes>::new();
    let mut joined = Vec::<u8>::new();

    while let Some(chunk) = upstream.next().await {
        let Ok(bytes) = chunk else {
            return Ok(None);
        };
        joined.extend_from_slice(&bytes);
        buffered.push(bytes);
        if contains_output(&joined) {
            activity.ttft_ms = Some(started.elapsed().as_millis() as i64);
            let (tx, rx) = mpsc::channel::<Result<Bytes, io::Error>>(16);
            tokio::spawn(async move {
                let stream = stream::iter(buffered.into_iter().map(Ok::<Bytes, io::Error>))
                    .chain(upstream.map(|r| r.map_err(io::Error::other)));
                tokio::pin!(stream);
                while let Some(item) = stream.next().await {
                    if tx.send(item).await.is_err() {
                        break;
                    }
                }
                activity.latency_ms = started.elapsed().as_millis() as i64;
                let _ = store.record_activity(&activity);
            });
            return Ok(Some(sse_response(ReceiverStream::new(rx))));
        }
        if joined.len() > PRECOMMIT_BUFFER_LIMIT {
            return Ok(None);
        }
    }
    Ok(None)
}

fn sse_response(stream: ReceiverStream<Result<Bytes, io::Error>>) -> Response {
    let mut response = Response::new(Body::from_stream(stream));
    *response.status_mut() = StatusCode::OK;
    response.headers_mut().insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static("text/event-stream"),
    );
    response
        .headers_mut()
        .insert(header::CACHE_CONTROL, HeaderValue::from_static("no-cache"));
    response.headers_mut().insert(
        "x-accel-buffering",
        HeaderValue::from_static("no"),
    );
    response
}

fn contains_output(bytes: &[u8]) -> bool {
    let text = String::from_utf8_lossy(bytes);
    for event in text.split("\n\n") {
        let Some(data) = event.lines().find_map(|line| line.strip_prefix("data: ")) else {
            continue;
        };
        if data == "[DONE]" {
            continue;
        }
        let Ok(value) = serde_json::from_str::<Value>(data) else {
            continue;
        };
        let delta = value.pointer("/choices/0/delta");
        let has_text = |field: &str| {
            delta
                .and_then(|d| d.get(field))
                .and_then(Value::as_str)
                .is_some_and(|s| !s.is_empty())
        };
        if has_text("content")
            || has_text("reasoning_content")
            || delta.and_then(|d| d.get("tool_calls")).is_some()
            || delta.and_then(|d| d.get("function_call")).is_some()
        {
            return true;
        }
    }
    false
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn role_only_is_not_output() {
        assert!(!contains_output(
            b"data: {\"choices\":[{\"delta\":{\"role\":\"assistant\"}}]}\n\n"
        ));
    }

    #[test]
    fn content_is_output() {
        assert!(contains_output(
            b"data: {\"choices\":[{\"delta\":{\"content\":\"hi\"}}]}\n\n"
        ));
    }
}
