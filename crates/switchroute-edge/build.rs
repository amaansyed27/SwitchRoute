use std::{env, fs, path::PathBuf};

fn main() {
    let manifest = PathBuf::from(env::var("CARGO_MANIFEST_DIR").expect("manifest dir"));
    let version_file = manifest.join("../../VERSION");
    println!("cargo:rerun-if-changed={}", version_file.display());
    let version = fs::read_to_string(version_file)
        .expect("VERSION must exist")
        .trim()
        .to_owned();
    println!("cargo:rustc-env=SWITCHROUTE_VERSION={version}");
}
