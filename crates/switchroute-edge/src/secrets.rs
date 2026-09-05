use std::{collections::HashMap,sync::{Arc,Mutex}};
use crate::error::EdgeError;

pub trait SecretStore:Send+Sync{fn put(&self,reference:&str,value:&str)->Result<(),EdgeError>;fn get(&self,reference:&str)->Result<String,EdgeError>;fn delete(&self,reference:&str)->Result<(),EdgeError>;}

#[derive(Default)]
pub struct OsSecretStore;
impl SecretStore for OsSecretStore{
    fn put(&self,reference:&str,value:&str)->Result<(),EdgeError>{entry(reference)?.set_password(value).map_err(|_|EdgeError::Secret)}
    fn get(&self,reference:&str)->Result<String,EdgeError>{entry(reference)?.get_password().map_err(|_|EdgeError::Secret)}
    fn delete(&self,reference:&str)->Result<(),EdgeError>{entry(reference)?.delete_credential().map_err(|_|EdgeError::Secret)}
}
fn entry(reference:&str)->Result<keyring::Entry,EdgeError>{keyring::Entry::new("SwitchRouteEdge",reference).map_err(|_|EdgeError::Secret)}

#[derive(Clone,Default)]
pub struct MemorySecretStore{inner:Arc<Mutex<HashMap<String,String>>>}
impl SecretStore for MemorySecretStore{
    fn put(&self,reference:&str,value:&str)->Result<(),EdgeError>{self.inner.lock().map_err(|_|EdgeError::Secret)?.insert(reference.into(),value.into());Ok(())}
    fn get(&self,reference:&str)->Result<String,EdgeError>{self.inner.lock().map_err(|_|EdgeError::Secret)?.get(reference).cloned().ok_or(EdgeError::Secret)}
    fn delete(&self,reference:&str)->Result<(),EdgeError>{self.inner.lock().map_err(|_|EdgeError::Secret)?.remove(reference);Ok(())}
}
