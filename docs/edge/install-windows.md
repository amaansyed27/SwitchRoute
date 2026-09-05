# Windows installation

SwitchRoute Edge releases include a Windows x64 ZIP and SHA-256 checksum. End users do not need Rust or Cargo.

## Install

1. Download `switchroute-edge-<version>-windows-x64.zip` and its checksum from the matching GitHub Release.
2. Verify the checksum before extracting.
3. Extract `switchroute-edge.exe` to a stable directory such as `%LOCALAPPDATA%\SwitchRoute\bin`.
4. Add that directory to the user PATH.
5. Open a new PowerShell window.

```powershell
switchroute-edge --version
switchroute-edge start
switchroute-edge status
```

First start prints the generated local API key once. Save it securely.

## First-run diagnostics

```powershell
switchroute-edge discover
switchroute-edge runtime list
switchroute-edge model list
switchroute-edge doctor
```

## Upgrade

```powershell
switchroute-edge stop
```

Download and verify the next release, replace `switchroute-edge.exe`, then:

```powershell
switchroute-edge --version
switchroute-edge start
switchroute-edge doctor
```

The executable replacement does not delete the SQLite control database or OS credential-store secrets.

## Uninstall

```powershell
switchroute-edge stop
```

Remove the executable and its PATH entry. If you also want to erase configuration, remove the Edge data directory and delete SwitchRoute Edge credentials through Windows Credential Manager.

## Signing status

Release notes must state whether the Windows binary is Authenticode-signed. The release workflow does not claim signing when signing credentials are unavailable.
