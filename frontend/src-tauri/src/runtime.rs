use std::fs;
use std::io::{Read, Write};
use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::thread;
use std::time::Duration;

use serde::Serialize;
use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;

#[derive(Serialize)]
pub struct EnvironmentStatus {
  pub launcher: bool,
  pub daemon: bool,
  pub installed: bool,
}

pub fn launcher_running() -> bool {
  port_open("127.0.0.1:9089")
}

pub fn daemon_running() -> bool {
  port_open("127.0.0.1:9090")
}

fn port_open(addr: &str) -> bool {
  TcpStream::connect_timeout(&addr.parse().unwrap(), Duration::from_millis(400)).is_ok()
}

fn wait_for_port(addr: &str, attempts: u32) -> bool {
  for _ in 0..attempts {
    if port_open(addr) {
      return true;
    }
    thread::sleep(Duration::from_millis(250));
  }
  false
}

pub fn spawn_launcher_sidecar(app: &AppHandle) {
  if launcher_running() {
    log::info!("DevNest launcher already on 127.0.0.1:9089");
    return;
  }
  match app.shell().sidecar("devnest") {
    Ok(sidecar) => match sidecar.args(["launcher"]).spawn() {
      Ok((_rx, child)) => log::info!("Launcher sidecar spawned (pid {:?})", child.pid()),
      Err(err) => log::warn!("Failed to spawn launcher sidecar: {err}"),
    },
    Err(err) => log::warn!("DevNest sidecar not bundled: {err}"),
  }
}

pub fn spawn_daemon_sidecar(app: &AppHandle) {
  if daemon_running() {
    log::info!("DevNest daemon already on 127.0.0.1:9090");
    return;
  }
  match app.shell().sidecar("devnest") {
    Ok(sidecar) => match sidecar.args(["daemon"]).spawn() {
      Ok((_rx, child)) => log::info!("Daemon sidecar spawned (pid {:?})", child.pid()),
      Err(err) => log::warn!("Failed to spawn daemon sidecar: {err}"),
    },
    Err(err) => log::warn!("DevNest sidecar not bundled: {err}"),
  }
}

fn start_daemon_via_launcher() {
  let _ = post_json("127.0.0.1:9089", "/api/daemon/start", "{}");
}

fn post_json(host_port: &str, path: &str, body: &str) -> std::io::Result<String> {
  let mut stream = TcpStream::connect(host_port)?;
  stream.set_read_timeout(Some(Duration::from_secs(8)))?;
  let req = format!(
    "POST {path} HTTP/1.1\r\nHost: {host_port}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
    body.len()
  );
  stream.write_all(req.as_bytes())?;
  let mut buf = Vec::new();
  stream.read_to_end(&mut buf)?;
  Ok(String::from_utf8_lossy(&buf).into_owned())
}

pub fn ensure_environment(app: &AppHandle) -> EnvironmentStatus {
  if !launcher_running() {
    spawn_launcher_sidecar(app);
    wait_for_port("127.0.0.1:9089", 24);
  }

  if launcher_running() && !daemon_running() {
    start_daemon_via_launcher();
    if !wait_for_port("127.0.0.1:9090", 32) {
      spawn_daemon_sidecar(app);
      wait_for_port("127.0.0.1:9090", 32);
    }
  } else if !daemon_running() {
    spawn_daemon_sidecar(app);
    wait_for_port("127.0.0.1:9090", 32);
  }

  EnvironmentStatus {
    launcher: launcher_running(),
    daemon: daemon_running(),
    installed: devnest_bin_installed(),
  }
}

fn devnest_home_bin() -> Option<PathBuf> {
  dirs::home_dir().map(|h| h.join(".devnest").join("bin").join("devnest.exe"))
}

fn devnest_bin_installed() -> bool {
  devnest_home_bin()
    .map(|p| p.is_file())
    .unwrap_or(false)
}

fn sidecar_candidates(app: &AppHandle) -> Vec<PathBuf> {
  let mut out = Vec::new();
  if let Ok(res) = app.path().resource_dir() {
    out.push(res.join("binaries").join("devnest-x86_64-pc-windows-msvc.exe"));
    out.push(res.join("devnest-x86_64-pc-windows-msvc.exe"));
  }
  if let Ok(exe) = std::env::current_exe() {
    if let Some(dir) = exe.parent() {
      out.push(dir.join("devnest-x86_64-pc-windows-msvc.exe"));
      out.push(dir.join("binaries").join("devnest-x86_64-pc-windows-msvc.exe"));
    }
  }
  out
}

pub fn install_background_service(app: &AppHandle) -> Result<PathBuf, String> {
  let target = devnest_home_bin().ok_or("could not resolve home directory")?;
  if let Some(parent) = target.parent() {
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
  }

  if !target.is_file() {
    let mut copied = false;
    for src in sidecar_candidates(app) {
      if src.is_file() {
        fs::copy(&src, &target).map_err(|e| e.to_string())?;
        copied = true;
        break;
      }
    }
    if !copied {
      return Err("DevNest runtime binary not found in app bundle".into());
    }
  }

  register_launcher_startup(&target)?;
  Ok(target)
}

#[cfg(target_os = "windows")]
fn register_launcher_startup(bin: &Path) -> Result<(), String> {
  use std::os::windows::process::CommandExt;
  use std::process::Command;

  let value = format!("\"{}\" launcher", bin.display());
  let output = Command::new("reg")
    .args([
      "add",
      r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run",
      "/v",
      "DevNestLauncher",
      "/t",
      "REG_SZ",
      "/d",
      &value,
      "/f",
    ])
    .creation_flags(0x08000000) // CREATE_NO_WINDOW
    .output()
    .map_err(|e| e.to_string())?;
  if !output.status.success() {
    return Err(format!(
      "failed to register startup: {}",
      String::from_utf8_lossy(&output.stderr)
    ));
  }
  Ok(())
}

#[cfg(not(target_os = "windows"))]
fn register_launcher_startup(_bin: &Path) -> Result<(), String> {
  Ok(())
}

#[tauri::command]
pub fn ensure_environment_cmd(app: AppHandle) -> EnvironmentStatus {
  ensure_environment(&app)
}

#[tauri::command]
pub fn install_background_service_cmd(app: AppHandle) -> Result<String, String> {
  install_background_service(&app).map(|p| p.display().to_string())
}

#[tauri::command]
pub fn is_desktop_app() -> bool {
  true
}
