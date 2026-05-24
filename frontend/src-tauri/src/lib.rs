use tauri::Manager;
use window_vibrancy::{apply_mica, apply_vibrancy, NSVisualEffectMaterial};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
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
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
