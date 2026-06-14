/** App version strings — keep in sync with package.json / tauri.conf.json */
export const APP_VERSION = "0.1.0";
export const APP_CHANNEL = "stable";
export const RELEASES_URL = "https://github.com/khayson/DevNest/releases/latest";

export const STACK = {
  react: "19.2",
  tauri: "2.11",
  vite: "8.0",
  go: "1.26",
} as const;
