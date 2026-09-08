use tracing_subscriber::EnvFilter;
#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| EnvFilter::new("switchroute_edge=info")),
        )
        .init();
    if let Err(e) = switchroute_edge::cli::run().await {
        eprintln!("switchroute-edge: {e}");
        std::process::exit(1);
    }
}
