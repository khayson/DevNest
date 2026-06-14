' Launch DevNest desktop app without showing a terminal window.
' First run builds the app in the background (may take a few minutes).
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
root = fso.GetParentFolderName(scriptDir)
releaseExe = root & "\frontend\src-tauri\target\release\DevNest.exe"

If fso.FileExists(releaseExe) Then
    sh.Run """" & releaseExe & """", 1, False
Else
    sh.Run "powershell.exe -WindowStyle Hidden -ExecutionPolicy Bypass -File """ & scriptDir & "\build-desktop.ps1"" -Launch", 0, False
End If
