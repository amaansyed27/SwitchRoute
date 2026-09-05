use axum::{extract::State, routing::post, Json, Router};
use serde_json::{json, Value};
use std::sync::{
    atomic::{AtomicUsize, Ordering},
    Arc,
};
use switchroute_edge::{
    models::*, persistence::Store, routing::RouterEngine, secrets::MemorySecretStore,
};

#[derive(Clone)]
struct StateData {
    calls: Arc<AtomicUsize>,
    models: Arc<std::sync::Mutex<Vec<String>>>,
}

async fn chat(State(state): State<StateData>, Json(value): Json<Value>) -> Json<Value> {
    state.calls.fetch_add(1, Ordering::SeqCst);
    state
        .models
        .lock()
        .unwrap()
        .push(value["model"].as_str().unwrap_or_default().to_string());
    Json(json!({
        "id": "chatcmpl-strategy",
        "object": "chat.completion",
        "choices": [{"message": {"role": "assistant", "content": "ok"}, "index": 0}]
    }))
}

async fn mock_server() -> (String, Arc<AtomicUsize>, Arc<std::sync::Mutex<Vec<String>>>) {
    let calls = Arc::new(AtomicUsize::new(0));
    let models = Arc::new(std::sync::Mutex::new(Vec::new()));
    let app = Router::new()
        .route("/v1/chat/completions", post(chat))
        .with_state(StateData {
            calls: calls.clone(),
            models: models.clone(),
        });
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    tokio::spawn(async move {
        axum::serve(listener, app).await.unwrap();
    });
    (format!("http://{address}"), calls, models)
}

fn add_model(store: &Store, runtime: &RuntimeConnection, id: &str, origin: ModelOrigin) {
    let mut models = store.models().unwrap();
    models.push(EdgeModel {
        runtime_id: runtime.id.clone(),
        runtime: runtime.kind,
        id: id.into(),
        display_name: id.into(),
        origin,
        context_length: None,
        capabilities: Vec::new(),
        loaded: Some(true),
        healthy: true,
        metadata_provenance: "test".into(),
        metadata: json!({}),
    });
    store.replace_models(&runtime.id, &models).unwrap();
}

fn add_target(
    store: &Store,
    route: &EdgeRoute,
    runtime: &RuntimeConnection,
    model: &str,
    position: i64,
) {
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

#[tokio::test]
async fn priority_preserves_position_but_local_and_free_first_use_model_origin() {
    let (base, calls, selected) = mock_server().await;
    let directory = tempfile::tempdir().unwrap();
    let store = Store::open(&directory.path().join("edge.db")).unwrap();
    let runtime = RuntimeConnection {
        id: "test-ollama".into(),
        kind: RuntimeKind::Ollama,
        display_name: "Ollama".into(),
        base_url: base,
        enabled: true,
        manual: true,
        auth_secret_ref: None,
    };
    store.upsert_runtime(&runtime).unwrap();
    add_model(&store, &runtime, "remote", ModelOrigin::Cloud);
    add_model(&store, &runtime, "local", ModelOrigin::Local);
    let engine = RouterEngine::new(store.clone(), Arc::new(MemorySecretStore::default())).unwrap();

    let priority = store
        .create_route("Priority", "priority", RouteStrategy::Priority, true)
        .unwrap();
    add_target(&store, &priority, &runtime, "remote", 0);
    add_target(&store, &priority, &runtime, "local", 1);
    engine
        .complete(&priority, &json!({"messages": []}))
        .await
        .unwrap();

    for (name, slug, strategy) in [
        ("Local first", "local-first", RouteStrategy::LocalFirst),
        ("Free first", "free-first", RouteStrategy::FreeFirst),
    ] {
        let route = store.create_route(name, slug, strategy, false).unwrap();
        add_target(&store, &route, &runtime, "remote", 0);
        add_target(&store, &route, &runtime, "local", 1);
        engine
            .complete(&route, &json!({"messages": []}))
            .await
            .unwrap();
    }

    assert_eq!(calls.load(Ordering::SeqCst), 3);
    assert_eq!(
        selected.lock().unwrap().as_slice(),
        ["remote", "local", "local"]
    );
}
