; DevNest NSIS hooks — stop daemon sidecar before overwriting devnest.exe on upgrade.
!macro NSIS_HOOK_PREINSTALL
  DetailPrint "Stopping DevNest background processes before install…"

  !if "${INSTALLMODE}" == "currentUser"
    nsis_tauri_utils::KillProcessCurrentUser "devnest.exe"
  !else
    nsis_tauri_utils::KillProcess "devnest.exe"
  !endif
  Pop $0
  Sleep 1000

  !if "${INSTALLMODE}" == "currentUser"
    nsis_tauri_utils::KillProcessCurrentUser "DevNest.exe"
  !else
    nsis_tauri_utils::KillProcess "DevNest.exe"
  !endif
  Pop $0
  Sleep 500
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  !if "${INSTALLMODE}" == "currentUser"
    nsis_tauri_utils::KillProcessCurrentUser "devnest.exe"
  !else
    nsis_tauri_utils::KillProcess "devnest.exe"
  !endif
  Pop $0
  Sleep 800
!macroend
