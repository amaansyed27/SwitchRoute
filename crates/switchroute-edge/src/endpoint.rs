use url::Url;
use crate::error::EdgeError;
pub fn validate_runtime_url(value:&str)->Result<String,EdgeError>{let mut url=Url::parse(value).map_err(|_|EdgeError::Invalid("runtime URL must be a valid http(s) URL".into()))?;if !matches!(url.scheme(),"http"|"https")||url.host_str().is_none()||!url.username().is_empty()||url.password().is_some()||url.query().is_some()||url.fragment().is_some(){return Err(EdgeError::Invalid("runtime URL must be http(s), have a host, and contain no credentials/query/fragment".into()));}let path=url.path().trim_end_matches('/');if path=="/v1"{url.set_path("");}else if !path.is_empty(){return Err(EdgeError::Invalid("runtime base URL must be the server root or end in /v1".into()));}Ok(url.as_str().trim_end_matches('/').to_string())}
pub fn native_url(base:&str,path:&str)->String{format!("{}{}",base.trim_end_matches('/'),path)}
pub fn models_url(base:&str)->String{native_url(base,"/v1/models")}
pub fn chat_url(base:&str)->String{native_url(base,"/v1/chat/completions")}
#[cfg(test)]mod tests{use super::*;#[test]fn local_private_and_lan_are_allowed(){for u in ["http://127.0.0.1:1234","http://localhost:8080","http://192.168.1.4:9000/v1"]{assert!(validate_runtime_url(u).is_ok());}}#[test]fn url_credentials_are_rejected(){assert!(validate_runtime_url("http://user:pass@localhost:8080").is_err());}}
