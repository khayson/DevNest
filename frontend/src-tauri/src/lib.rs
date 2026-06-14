mod runtime;

use runtime::{ensure_environment, install_background_service};
use tauri::Manager;
use window_vibrancy::{apply_mica, apply_vibrancy, NSVisualEffectMaterial};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_updater::Builder::new().build())
    .plugin(tauri_plugin_process::init())
    .invoke_handler(tauri::generate_handler![
      runtime::ensure_environment_cmd,
      runtime::install_background_service_cmd,
      runtime::is_desktop_app,
    ])
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

      let handle = app.handle().clone();
      std::thread::spawn(move || {
        let _ = install_background_service(&handle);
        ensure_environment(&handle);
      });

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
