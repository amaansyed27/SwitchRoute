use crate::{config::EdgeConfig, discovery::http_client, error::EdgeError};
use std::{
    fs::{self, File, OpenOptions},
    net::SocketAddr,
    path::{Path, PathBuf},
    process::{Command, Stdio},
    time::Duration,
};

fn pid_path(db: &Path) -> PathBuf {
    db.with_extension("pid")
}
fn log_path(db: &Path) -> PathBuf {
    db.with_extension("log")
}

pub async fn healthy(url: &str) -> bool {
    match http_client() {
        Ok(client) => client
            .get(format!("{}/health", url.trim_end_matches('/')))
            .send()
            .await
            .map(|response| response.status().is_success())
            .unwrap_or(false),
        Err(_) => false,
    }
}

pub async fn status(url: &str) -> Result<(), EdgeError> {
    println!("{}", if healthy(url).await { "running" } else { "stopped" });
    Ok(())
}

pub async fn start(config: &EdgeConfig) -> Result<(), EdgeError> {
    let health_url = format!("http://{}", config.bind);
    if healthy(&health_url).await {
        println!("already running");
        return Ok(());
    }
    if let Some(parent) = config.database_path.parent() {
        fs::create_dir_all(parent).map_err(|_| EdgeError::Storage)?;
    }
    let executable = std::env::current_exe().map_err(|_| EdgeError::Internal)?;
    let log = OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_path(&config.database_path))
        .map_err(|_| EdgeError::Storage)?;
    let stderr = log.try_clone().map_err(|_| EdgeError::Storage)?;
    let mut command = Command::new(executable);
    command
        .arg("--db")
        .arg(&config.database_path)
        .arg("serve")
        .arg("--bind")
        .arg(config.bind.to_string())
        .stdin(Stdio::null())
        .stdout(Stdio::from(log))
        .stderr(Stdio::from(stderr));
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x0000_0008 | 0x0000_0200);
    }
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        command.process_group(0);
    }
    let child = command.spawn().map_err(|_| EdgeError::Internal)?;
    fs::write(pid_path(&config.database_path), child.id().to_string())
        .map_err(|_| EdgeError::Storage)?;
    for _ in 0..30 {
        if healthy(&health_url).await {
            println!("started pid={} url={health_url}", child.id());
            return Ok(());
        }
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
    Err(EdgeError::Internal)
}

pub async fn stop(db: &Path, url: &str) -> Result<(), EdgeError> {
    let path = pid_path(db);
    if !healthy(url).await {
        let _ = fs::remove_file(path);
        println!("already stopped");
        return Ok(());
    }
    let pid = fs::read_to_string(&path)
        .map_err(|_| EdgeError::Invalid("daemon pid file is missing; use doctor before manual cleanup".into()))?;
    let pid = pid.trim();
    #[cfg(windows)]
    let status = Command::new("taskkill")
        .args(["/PID", pid, "/T", "/F"])
        .status()
        .map_err(|_| EdgeError::Internal)?;
    #[cfg(unix)]
    let status = Command::new("kill")
        .args(["-TERM", pid])
        .status()
        .map_err(|_| EdgeError::Internal)?;
    if !status.success() {
        return Err(EdgeError::Internal);
    }
    let _ = fs::remove_file(path);
    println!("stopped");
    Ok(())
}

pub fn daemon_files(db: &Path) -> (PathBuf, PathBuf) {
    (pid_path(db), log_path(db))
}

#[allow(dead_code)]
fn _assert_file_send(_: File) {}
