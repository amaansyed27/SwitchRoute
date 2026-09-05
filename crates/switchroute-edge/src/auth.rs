use rand::{rngs::OsRng,RngCore};
use sha2::{Digest,Sha256};
use subtle::ConstantTimeEq;
use crate::{error::EdgeError,persistence::Store};

pub fn create_key(store:&Store,name:&str)->Result<String,EdgeError>{
    let mut bytes=[0u8;32]; OsRng.fill_bytes(&mut bytes);
    let key=format!("sr_edge_{}",hex::encode(bytes));
    let hash=hash_key(&key);
    store.insert_api_key(name,&key[..20],&hash)?;
    Ok(key)
}
pub fn verify_key(store:&Store,key:&str)->Result<(),EdgeError>{
    if !key.starts_with("sr_edge_"){return Err(EdgeError::Unauthorized)}
    let expected=hash_key(key);
    for stored in store.api_key_hashes()? { if stored.as_bytes().ct_eq(expected.as_bytes()).into(){return Ok(())} }
    Err(EdgeError::Unauthorized)
}
fn hash_key(key:&str)->String{hex::encode(Sha256::digest(key.as_bytes()))}
