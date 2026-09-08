use axum::{
    body::Body,
    extract::State,
    http::{header, HeaderValue, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use bytes::Bytes;
use futures_util::{stream, StreamExt};
use serde_json::{json, Value};
use std::{
    io,
    sync::{
        atomic::{AtomicUsize, Ordering},
        Arc,
    },
    time::Duration,
};
use switchroute_edge::{
    models::*, persistence::Store, providers::adapter, routing::RouterEngine,
    secrets::MemorySecretStore,
};

#[derive(Clone)]
struct MockState {
    calls: Arc<AtomicUsize>,
}

async fn spawn_mock() -> (String, Arc<AtomicUsize>) {
    let calls = Arc::new(AtomicUsize::new(0));
    let app = Router::new()
        .route(
            "/api/v1/models",
            get(|| async {
                Json(json!({
                    "models": [
                        {
                            "key": "loaded-model",
                            "display_name": "Loaded model",
                            "max_context_length": 8192,
                            "loaded_instances": [{"id": "instance-1"}]
                        },
                        {
                            "key": "unloaded-model",
                            "display_name": "Unloaded model",
                            "max_context_length": 4096,
                            "loaded_instances": []
                        }
                    ]
                }))
            }),
        )
        .route(
            "/v1/models",
            get(|| async {
                Json(json!({
                    "object": "list",
                    "data": [
                        {"id": "malformed"},
                        {"id": "good"},
                        {"id": "broken"}
                    ]
                }))
            }),
        )
        .route("/v1/chat/completions", post(mock_chat))
        .with_state(MockState {
            calls: calls.clone(),
        });
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    tokio::spawn(async move {
        axum::serve(listener, app).await.unwrap();
    });
    (format!("http://{address}"), calls)
}

async fn mock_chat(State(state): State<MockState>, Json(value): Json<Value>) -> Response {
    state.calls.fetch_add(1, Ordering::SeqCst);
    let model = value.get("model").and_then(Value::as_str).unwrap_or("");
    let streaming = value
        .get("stream")
        .and_then(Value::as_bool)
        .unwrap_or(false);

    if model == "malformed" && !streaming {
        return (StatusCode::OK, "this is not JSON").into_response();
    }
    if model == "broken" && streaming {
        let first = stream::once(async {
            Ok::<Bytes, io::Error>(Bytes::from_static(
                b"data: {\"choices\":[{\"delta\":{\"content\":\"partial\"}}]}\n\n",
            ))
        });
        let failure = stream::once(async {
            tokio::time::sleep(Duration::from_millis(75)).await;
            Err::<Bytes, io::Error>(io::Error::other("simulated transport failure"))
        });
        let mut response = Response::new(Body::from_stream(first.chain(failure)));
        response.headers_mut().insert(
            header::CONTENT_TYPE,
            HeaderValue::from_static("text/event-stream"),
        );
        return response;
    }

    Json(json!({
        "id": "chatcmpl-review",
        "object": "chat.completion",
        "choices": [{
            "index": 0,
            "message": {"role": "assistant", "content": "ok"},
            "finish_reason": "stop"
        }]
    }))
    .into_response()
}

fn runtime(kind: RuntimeKind, base_url: &str) -> RuntimeConnection {
    RuntimeConnection {
        id: format!("review-{}", kind.id()),
        kind,
        display_name: kind.display_name().into(),
        base_url: base_url.into(),
        enabled: true,
        manual: true,
        auth_secret_ref: None,
    }
}

async fn configured_vllm(
    base_url: &str,
) -> (
    tempfile::TempDir,
    std::path::PathBuf,
    Store,
    RuntimeConnection,
) {
    let directory = tempfile::tempdir().unwrap();
    let database = directory.path().join("edge.db");
    let store = Store::open(&database).unwrap();
    let runtime = runtime(RuntimeKind::Vllm, base_url);
    store.upsert_runtime(&runtime).unwrap();
    let client = switchroute_edge::discovery::http_client().unwrap();
    let models = adapter(RuntimeKind::Vllm)
        .discover_models(&client, &runtime, None)
        .await
        .unwrap();
    store.replace_models(&runtime.id, &models).unwrap();
    (directory, database, store, runtime)
}

#[tokio::test]
async fn lm_studio_loaded_instances_are_preserved() {
    let (base_url, _) = spawn_mock().await;
    let client = switchroute_edge::discovery::http_client().unwrap();
    let runtime = runtime(RuntimeKind::LmStudio, &base_url);
    let models = adapter(RuntimeKind::LmStudio)
        .discover_models(&client, &runtime, None)
        .await
        .unwrap();

    assert_eq!(
        models
            .iter()
            .find(|model| model.id == "loaded-model")
            .unwrap()
            .loaded,
        Some(true)
    );
    assert_eq!(
        models
            .iter()
            .find(|model| model.id == "unloaded-model")
            .unwrap()
            .loaded,
        Some(false)
    );
}

#[tokio::test]
async fn malformed_success_response_falls_back_before_output() {
    let (base_url, calls) = spawn_mock().await;
    let (_directory, _database, store, runtime) = configured_vllm(&base_url).await;
    let route = store
        .create_route("Fallback", "fallback", RouteStrategy::Priority, true)
        .unwrap();
    for (position, model) in [(0, "malformed"), (1, "good")] {
        store
            .add_target(
                &route.id,
                position,
                TargetKind::Local {
                    runtime_id: runtime.id.clone(),
                    model_id: model.into(),
                },
            )
            .unwrap();
    }

    let response = RouterEngine::new(store, Arc::new(MemorySecretStore::default()))
        .unwrap()
        .complete(&route, &json!({"messages": []}))
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(calls.load(Ordering::SeqCst), 2);
}

#[tokio::test]
async fn committed_stream_failure_is_normalized_without_fallback() {
    let (base_url, calls) = spawn_mock().await;
    let (_directory, database, store, runtime) = configured_vllm(&base_url).await;
    let route = store
        .create_route("Stream", "stream", RouteStrategy::Priority, true)
        .unwrap();
    for (position, model) in [(0, "broken"), (1, "good")] {
        store
            .add_target(
                &route.id,
                position,
                TargetKind::Local {
                    runtime_id: runtime.id.clone(),
                    model_id: model.into(),
                },
            )
            .unwrap();
    }

    let response = RouterEngine::new(store, Arc::new(MemorySecretStore::default()))
        .unwrap()
        .stream(&route, &json!({"messages": [], "stream": true}))
        .await
        .unwrap();
    let text = String::from_utf8(
        axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .unwrap()
            .to_vec(),
    )
    .unwrap();

    assert!(text.contains("partial"));
    assert!(text.contains("upstream_unavailable"));
    assert!(text.contains("[DONE]"));
    assert_eq!(calls.load(Ordering::SeqCst), 1);

    tokio::time::sleep(Duration::from_millis(30)).await;
    let connection = rusqlite::Connection::open(database).unwrap();
    let (status, category): (String, Option<String>) = connection
        .query_row(
            "SELECT status,error_category FROM activity ORDER BY id DESC LIMIT 1",
            [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .unwrap();
    assert_eq!(status, "error");
    assert_eq!(category.as_deref(), Some("upstream_unavailable"));
}
