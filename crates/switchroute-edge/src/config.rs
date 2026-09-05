use crate::error::EdgeError;
use directories::ProjectDirs;
use std::{
    net::{IpAddr, Ipv4Addr, SocketAddr},
    path::PathBuf,
};
pub const DEFAULT_PORT: u16 = 8787;
#[derive(Debug, Clone)]
pub struct EdgeConfig {
    pub bind: SocketAddr,
    pub database_path: PathBuf,
}
impl EdgeConfig {
    pub fn load(
        bind: Option<SocketAddr>,
        database_path: Option<PathBuf>,
    ) -> Result<Self, EdgeError> {
        let bind =
            bind.unwrap_or_else(|| SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), DEFAULT_PORT));
        let database_path = database_path.unwrap_or(default_database_path()?);
        let config = Self {
            bind,
            database_path,
        };
        config.validate()?;
        Ok(config)
    }
    pub fn validate(&self) -> Result<(), EdgeError> {
        if !self.bind.ip().is_loopback() {
            return Err(EdgeError::Invalid(
                "Slice 3 permits only loopback Edge bindings.".into(),
            ));
        }
        Ok(())
    }
}
pub fn default_database_path() -> Result<PathBuf, EdgeError> {
    let dirs =
        ProjectDirs::from("com", "DawnlightLabs", "SwitchRouteEdge").ok_or(EdgeError::Internal)?;
    Ok(dirs.data_local_dir().join("edge.sqlite3"))
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn non_loopback_is_rejected() {
        assert!(
            EdgeConfig::load(Some("0.0.0.0:8787".parse().unwrap()), Some("x.db".into())).is_err()
        );
        assert!(
            EdgeConfig::load(Some("127.0.0.1:8787".parse().unwrap()), Some("x.db".into())).is_ok()
        );
    }
}
