use std::collections::HashMap;
use async_trait::async_trait;
use reqwest::Client;
use serde_json::{json,Value};
use crate::{endpoint,error::EdgeError,models::*};
use super::{authorized,RuntimeAdapter};

pub struct OllamaAdapter;
#[async_trait]
impl RuntimeAdapter for OllamaAdapter{
    fn kind(&self)->RuntimeKind{RuntimeKind::Ollama}
    fn default_connection(&self)->Option<RuntimeConnection>{Some(RuntimeConnection{id:"auto-ollama".into(),kind:RuntimeKind::Ollama,display_name:"Ollama".into(),base_url:"http://127.0.0.1:11434".into(),enabled:true,manual:false,auth_secret_ref:None})}
    async fn probe(&self,client:&Client,runtime:&RuntimeConnection,secret:Option<&str>)->bool{authorized(client.get(endpoint::native_url(&runtime.base_url,"/api/tags")),secret).send().await.map(|r|r.status().is_success()).unwrap_or(false)}
    async fn discover_models(&self,client:&Client,runtime:&RuntimeConnection,secret:Option<&str>)->Result<Vec<EdgeModel>,EdgeError>{
        let tags:Value=authorized(client.get(endpoint::native_url(&runtime.base_url,"/api/tags")),secret).send().await?.json().await?;
        let ps:Value=authorized(client.get(endpoint::native_url(&runtime.base_url,"/api/ps")),secret).send().await?.json().await.unwrap_or_else(|_|json!({"models":[]}));
        let running:HashMap<String,u64>=ps.get("models").and_then(Value::as_array).into_iter().flatten().filter_map(|m|Some((m.get("model").or_else(||m.get("name"))?.as_str()?.to_string(),m.get("context_length").and_then(Value::as_u64).unwrap_or(0)))).collect();
        let mut out=Vec::new();
        for item in tags.get("models").and_then(Value::as_array).into_iter().flatten(){
            let Some(id)=item.get("model").or_else(||item.get("name")).and_then(Value::as_str) else{continue};
            let show:Value=authorized(client.post(endpoint::native_url(&runtime.base_url,"/api/show")).json(&json!({"model":id})),secret).send().await?.json().await.unwrap_or_else(|_|json!({}));
            let remote=item.get("remote_model").and_then(Value::as_str).filter(|s|!s.is_empty()).is_some()||item.get("remote_host").and_then(Value::as_str).filter(|s|!s.is_empty()).is_some()||show.get("remote_model").and_then(Value::as_str).filter(|s|!s.is_empty()).is_some()||show.get("remote_host").and_then(Value::as_str).filter(|s|!s.is_empty()).is_some();
            let context=running.get(id).copied().filter(|v|*v>0).or_else(||show.get("model_info").and_then(Value::as_object).and_then(|o|o.iter().find(|(k,_)|k.ends_with(".context_length")).and_then(|(_,v)|v.as_u64())));
            let capabilities=show.get("capabilities").and_then(Value::as_array).map(|a|a.iter().filter_map(|v|v.as_str().map(ToOwned::to_owned)).collect()).unwrap_or_default();
            out.push(EdgeModel{runtime_id:runtime.id.clone(),runtime:RuntimeKind::Ollama,id:id.into(),display_name:id.into(),origin:if remote{ModelOrigin::Cloud}else{ModelOrigin::Local},context_length:context,capabilities,loaded:Some(running.contains_key(id)),healthy:true,metadata_provenance:"Ollama /api/tags + /api/ps + /api/show".into(),metadata:json!({"tags":item,"show":show})});
        }
        Ok(out)
    }
}
