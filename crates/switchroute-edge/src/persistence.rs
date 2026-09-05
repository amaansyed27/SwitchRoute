use crate::{error::EdgeError, models::*};
use rusqlite::{params, Connection, OptionalExtension};
use std::{
    path::Path,
    sync::{Arc, Mutex},
};
use uuid::Uuid;

#[derive(Clone)]
pub struct Store {
    conn: Arc<Mutex<Connection>>,
}
impl Store {
    pub fn open(path: &Path) -> Result<Self, EdgeError> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(|_| EdgeError::Storage)?;
        }
        let conn = Connection::open(path)?;
        let s = Self {
            conn: Arc::new(Mutex::new(conn)),
        };
        s.migrate()?;
        Ok(s)
    }
    fn with<T>(
        &self,
        f: impl FnOnce(&Connection) -> Result<T, rusqlite::Error>,
    ) -> Result<T, EdgeError> {
        let c = self.conn.lock().map_err(|_| EdgeError::Storage)?;
        Ok(f(&c)?)
    }
    fn migrate(&self) -> Result<(), EdgeError> {
        self.with(|c|c.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS runtime_connections(id TEXT PRIMARY KEY,kind TEXT NOT NULL,display_name TEXT NOT NULL,base_url TEXT NOT NULL,enabled INTEGER NOT NULL,manual INTEGER NOT NULL,auth_secret_ref TEXT);
CREATE TABLE IF NOT EXISTS models(runtime_id TEXT NOT NULL,model_id TEXT NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(runtime_id,model_id));
CREATE TABLE IF NOT EXISTS routes(id TEXT PRIMARY KEY,name TEXT NOT NULL,slug TEXT NOT NULL UNIQUE,strategy TEXT NOT NULL,enabled INTEGER NOT NULL,is_default INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS route_targets(id TEXT PRIMARY KEY,route_id TEXT NOT NULL,position INTEGER NOT NULL,enabled INTEGER NOT NULL,target_json TEXT NOT NULL,FOREIGN KEY(route_id) REFERENCES routes(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS api_keys(id TEXT PRIMARY KEY,name TEXT NOT NULL,prefix TEXT NOT NULL,key_hash TEXT NOT NULL UNIQUE,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS activity(id INTEGER PRIMARY KEY AUTOINCREMENT,request_id TEXT NOT NULL,route_id TEXT NOT NULL,target_label TEXT NOT NULL,model_id TEXT NOT NULL,origin TEXT NOT NULL,latency_ms INTEGER NOT NULL,ttft_ms INTEGER,fallback_count INTEGER NOT NULL,fallback_path TEXT NOT NULL,status TEXT NOT NULL,error_category TEXT,created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity(created_at DESC);"))?;
        Ok(())
    }
    pub fn upsert_runtime(&self, r: &RuntimeConnection) -> Result<(), EdgeError> {
        self.with(|c|c.execute("INSERT INTO runtime_connections(id,kind,display_name,base_url,enabled,manual,auth_secret_ref) VALUES(?1,?2,?3,?4,?5,?6,?7) ON CONFLICT(id) DO UPDATE SET kind=excluded.kind,display_name=excluded.display_name,base_url=excluded.base_url,enabled=excluded.enabled,manual=excluded.manual,auth_secret_ref=excluded.auth_secret_ref",params![r.id,r.kind.to_string(),r.display_name,r.base_url,r.enabled as i32,r.manual as i32,r.auth_secret_ref]))?;
        Ok(())
    }
    pub fn runtimes(&self) -> Result<Vec<RuntimeConnection>, EdgeError> {
        self.with(|c|{let mut s=c.prepare("SELECT id,kind,display_name,base_url,enabled,manual,auth_secret_ref FROM runtime_connections ORDER BY display_name")?;let rows=s.query_map([],|r|Ok(RuntimeConnection{id:r.get(0)?,kind:r.get::<_,String>(1)?.parse().map_err(|_|rusqlite::Error::InvalidQuery)?,display_name:r.get(2)?,base_url:r.get(3)?,enabled:r.get::<_,i64>(4)?!=0,manual:r.get::<_,i64>(5)?!=0,auth_secret_ref:r.get(6)?}))?;rows.collect()})
    }
    pub fn runtime(&self, id: &str) -> Result<Option<RuntimeConnection>, EdgeError> {
        Ok(self.runtimes()?.into_iter().find(|r| r.id == id))
    }
    pub fn replace_models(&self, runtime_id: &str, models: &[EdgeModel]) -> Result<(), EdgeError> {
        self.with(|c| {
            c.execute("DELETE FROM models WHERE runtime_id=?1", [runtime_id])?;
            for m in models {
                c.execute(
                    "INSERT INTO models(runtime_id,model_id,payload) VALUES(?1,?2,?3)",
                    params![
                        runtime_id,
                        m.id,
                        serde_json::to_string(m).map_err(|_| rusqlite::Error::InvalidQuery)?
                    ],
                )?;
            }
            Ok(())
        })?;
        Ok(())
    }
    pub fn models(&self) -> Result<Vec<EdgeModel>, EdgeError> {
        self.with(|c| {
            let mut s = c.prepare("SELECT payload FROM models ORDER BY runtime_id,model_id")?;
            let rows = s.query_map([], |r| {
                let p: String = r.get(0)?;
                serde_json::from_str(&p).map_err(|_| rusqlite::Error::InvalidQuery)
            })?;
            rows.collect()
        })
    }
    pub fn model(&self, runtime_id: &str, model_id: &str) -> Result<Option<EdgeModel>, EdgeError> {
        Ok(self
            .models()?
            .into_iter()
            .find(|m| m.runtime_id == runtime_id && m.id == model_id))
    }
    pub fn create_route(
        &self,
        name: &str,
        slug: &str,
        strategy: RouteStrategy,
        is_default: bool,
    ) -> Result<EdgeRoute, EdgeError> {
        let route = EdgeRoute {
            id: Uuid::new_v4().to_string(),
            name: name.into(),
            slug: slug.into(),
            strategy,
            enabled: true,
            is_default,
        };
        self.with(|c|{if is_default{c.execute("UPDATE routes SET is_default=0",[])?;}c.execute("INSERT INTO routes(id,name,slug,strategy,enabled,is_default) VALUES(?1,?2,?3,?4,1,?5)",params![route.id,route.name,route.slug,route.strategy.to_string(),is_default as i32])})?;
        Ok(route)
    }
    pub fn routes(&self) -> Result<Vec<EdgeRoute>, EdgeError> {
        self.with(|c| {
            let mut s = c.prepare(
                "SELECT id,name,slug,strategy,enabled,is_default FROM routes ORDER BY name",
            )?;
            let rows = s.query_map([], |r| {
                Ok(EdgeRoute {
                    id: r.get(0)?,
                    name: r.get(1)?,
                    slug: r.get(2)?,
                    strategy: r
                        .get::<_, String>(3)?
                        .parse()
                        .map_err(|_| rusqlite::Error::InvalidQuery)?,
                    enabled: r.get::<_, i64>(4)? != 0,
                    is_default: r.get::<_, i64>(5)? != 0,
                })
            })?;
            rows.collect()
        })
    }
    pub fn resolve_route(&self, model: &str) -> Result<Option<EdgeRoute>, EdgeError> {
        let routes = self.routes()?;
        if model == "auto" {
            return Ok(routes
                .iter()
                .find(|r| r.enabled && r.is_default)
                .cloned()
                .or_else(|| routes.into_iter().find(|r| r.enabled)));
        }
        let slug = model.strip_prefix("edge:").unwrap_or(model);
        Ok(routes.into_iter().find(|r| r.enabled && r.slug == slug))
    }
    pub fn add_target(
        &self,
        route_id: &str,
        position: i64,
        target: TargetKind,
    ) -> Result<RouteTarget, EdgeError> {
        let t = RouteTarget {
            id: Uuid::new_v4().to_string(),
            route_id: route_id.into(),
            position,
            enabled: true,
            target,
        };
        let json = serde_json::to_string(&t.target).map_err(|_| EdgeError::Storage)?;
        self.with(|c|c.execute("INSERT INTO route_targets(id,route_id,position,enabled,target_json) VALUES(?1,?2,?3,1,?4)",params![t.id,t.route_id,t.position,json]))?;
        Ok(t)
    }
    pub fn targets(&self, route_id: &str) -> Result<Vec<RouteTarget>, EdgeError> {
        self.with(|c|{let mut s=c.prepare("SELECT id,route_id,position,enabled,target_json FROM route_targets WHERE route_id=?1 ORDER BY position,id")?;let rows=s.query_map([route_id],|r|{let p:String=r.get(4)?;Ok(RouteTarget{id:r.get(0)?,route_id:r.get(1)?,position:r.get(2)?,enabled:r.get::<_,i64>(3)?!=0,target:serde_json::from_str(&p).map_err(|_|rusqlite::Error::InvalidQuery)?})})?;rows.collect()})
    }
    pub fn set_target_enabled(&self, id: &str, enabled: bool) -> Result<(), EdgeError> {
        let n = self.with(|c| {
            c.execute(
                "UPDATE route_targets SET enabled=?2 WHERE id=?1",
                params![id, enabled as i32],
            )
        })?;
        if n == 0 {
            return Err(EdgeError::NotFound("route target not found".into()));
        }
        Ok(())
    }
    pub fn insert_api_key(&self, name: &str, prefix: &str, hash: &str) -> Result<(), EdgeError> {
        self.with(|c| {
            c.execute(
                "INSERT INTO api_keys(id,name,prefix,key_hash,created_at) VALUES(?1,?2,?3,?4,?5)",
                params![
                    Uuid::new_v4().to_string(),
                    name,
                    prefix,
                    hash,
                    chrono::Utc::now().to_rfc3339()
                ],
            )
        })?;
        Ok(())
    }
    pub fn api_key_hashes(&self) -> Result<Vec<String>, EdgeError> {
        self.with(|c| {
            let mut s = c.prepare("SELECT key_hash FROM api_keys")?;
            let rows = s.query_map([], |r| r.get(0))?;
            rows.collect()
        })
    }
    pub fn api_key_count(&self) -> Result<i64, EdgeError> {
        self.with(|c| c.query_row("SELECT COUNT(*) FROM api_keys", [], |r| r.get(0)))
    }
    pub fn record_activity(&self, a: &ActivityRecord) -> Result<(), EdgeError> {
        let path = serde_json::to_string(&a.fallback_path).map_err(|_| EdgeError::Storage)?;
        self.with(|c|{c.execute("INSERT INTO activity(request_id,route_id,target_label,model_id,origin,latency_ms,ttft_ms,fallback_count,fallback_path,status,error_category,created_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)",params![a.request_id,a.route_id,a.target_label,a.model_id,format!("{:?}",a.origin).to_ascii_lowercase(),a.latency_ms,a.ttft_ms,a.fallback_count,path,a.status,a.error_category,chrono::Utc::now().to_rfc3339()])?;c.execute("DELETE FROM activity WHERE id NOT IN (SELECT id FROM activity ORDER BY id DESC LIMIT 1000)",[])?;Ok(())})?;
        Ok(())
    }
    pub fn activity_count(&self) -> Result<i64, EdgeError> {
        self.with(|c| c.query_row("SELECT COUNT(*) FROM activity", [], |r| r.get(0)))
    }
    pub fn raw_activity_text(&self) -> Result<String, EdgeError> {
        self.with(|c|c.query_row("SELECT COALESCE(GROUP_CONCAT(target_label||model_id||fallback_path), '') FROM activity",[],|r|r.get(0)).optional().map(|v:Option<String>|v.unwrap_or_default()))
    }
}
