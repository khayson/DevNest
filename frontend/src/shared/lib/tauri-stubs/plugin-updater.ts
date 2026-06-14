/** Browser-only stub — real plugin is used when built via Tauri. */
export async function check() {
  return null
}

export async function downloadAndInstall() {}

export default { check, downloadAndInstall }
