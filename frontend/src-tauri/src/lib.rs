use std::net::TcpStream;
use std::time::Duration;
use tauri::Manager;
use tauri_plugin_shell::ShellExt;
use window_vibrancy::{apply_mica, apply_vibrancy, NSVisualEffectMaterial};

fn daemon_already_running() -> bool {
  TcpStream::connect_timeout(
    &"127.0.0.1:9090".parse().unwrap(),
    Duration::from_millis(400),
  )
  .is_ok()
}

fn spawn_daemon_sidecar(app: &tauri::AppHandle) {
  if daemon_already_running() {
    log::info!("DevNest daemon already listening on 127.0.0.1:9090 — skipping sidecar spawn");
    return;
  }

  match app.shell().sidecar("devnest") {
    Ok(sidecar) => match sidecar.args(["daemon"]).spawn() {
      Ok((_rx, child)) => {
        log::info!("DevNest daemon sidecar spawned (pid {:?})", child.pid());
      }
      Err(err) => {
        log::warn!("Failed to spawn DevNest daemon sidecar: {err}");
      }
    },
    Err(err) => {
      log::warn!("DevNest sidecar binary not bundled — start daemon manually: {err}");
    }
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .setup(|app| {
      let window = app.get_webview_window("main").unwrap();

      #[cfg(target_os = "macos")]
      let _ = apply_vibrancy(&window, NSVisualEffectMaterial::HudWindow, None, None);

      #[cfg(target_os = "windows")]
      let _ = apply_mica(&window, Some(true));

      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      spawn_daemon_sidecar(app.handle());

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
