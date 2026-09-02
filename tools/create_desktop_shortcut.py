import os
import subprocess
from pathlib import Path

def create_dsh_shortcut():
    # 1. Rutas dinamicas basadas en la raiz del repo DSH
    repo_root = Path(__file__).resolve().parent.parent
    vbs_path = repo_root / "DSH.vbs"
    desktop_path = Path(os.path.expanduser("~/Desktop"))
    start_menu_path = Path(os.path.expanduser("~/AppData/Roaming/Microsoft/Windows/Start Menu/Programs"))
    
    shortcut_desktop = desktop_path / "DSH.lnk"
    shortcut_start_menu = start_menu_path / "DSH.lnk"
    
    # 2. Limpieza de accesos obsoletos
    old_shortcuts = [desktop_path / "RITA DSH.lnk", desktop_path / "DeepSick.lnk"]
    for old in old_shortcuts:
        if old.exists():
            try:
                old.unlink()
                print(f"[-] Acceso obsoleto eliminado: {old.name}")
            except Exception:
                pass

    # 3. Asignacion de icono: favicon local de DSH o icono de sistema
    icon_path = repo_root / "website" / "public" / "favicon.ico"
    icon_param = f"$Shortcut.IconLocation = '{icon_path}'" if icon_path.exists() else "$Shortcut.IconLocation = 'shell32.dll,220'"

    # 4. Generacion PowerShell en Desktop y Start Menu (para registro global de Hotkey en Explorer)
    ps_script = f"""
    $WshShell = New-Object -ComObject WScript.Shell
    
    # Desktop Shortcut
    $Shortcut = $WshShell.CreateShortcut('{shortcut_desktop}')
    $Shortcut.TargetPath = 'wscript.exe'
    $Shortcut.Arguments = '"{vbs_path}"'
    $Shortcut.WorkingDirectory = '{repo_root}'
    $Shortcut.Description = 'DeepShell / DSH Sovereign Harness (Ctrl+Alt+D)'
    $Shortcut.Hotkey = 'Ctrl+Alt+D'
    $Shortcut.WindowStyle = 7  # Minimized
    {icon_param}
    $Shortcut.Save()

    # Start Menu Shortcut (indispensable para que Windows registre el hotkey globalmente)
    $ShortcutSM = $WshShell.CreateShortcut('{shortcut_start_menu}')
    $ShortcutSM.TargetPath = 'wscript.exe'
    $ShortcutSM.Arguments = '"{vbs_path}"'
    $ShortcutSM.WorkingDirectory = '{repo_root}'
    $ShortcutSM.Description = 'DeepShell / DSH Sovereign Harness (Ctrl+Alt+D)'
    $ShortcutSM.Hotkey = 'Ctrl+Alt+D'
    $ShortcutSM.WindowStyle = 7
    {icon_param.replace('$Shortcut.', '$ShortcutSM.')}
    $ShortcutSM.Save()

    # Notificar al Shell de Windows para refrescar la tabla de Hotkeys sin reiniciar Explorer
    try {{
        $code = '[DllImport("shell32.dll")] public static extern void SHChangeNotify(int wEventId, int uFlags, IntPtr dwItem1, IntPtr dwItem2);'
        $type = Add-Type -MemberDefinition $code -Name Win32Shell -Namespace SystemTools -PassThru
        $type::SHChangeNotify(0x08000000, 0, [IntPtr]::Zero, [IntPtr]::Zero) # SHCNE_ASSOCCHANGED
    }} catch {{}}
    """

    subprocess.run(["powershell", "-NoProfile", "-Command", ps_script], check=True)

    # 5. Verificacion Empirica
    if shortcut_desktop.exists() and shortcut_start_menu.exists():
        print(f"[+] Accesos directos verificados exitosamente:")
        print(f"    |-- Desktop:    {shortcut_desktop}")
        print(f"    |-- Start Menu: {shortcut_start_menu}")
        print(f"    |-- Atajo global: [Ctrl + Alt + D]")
        print(f"    |-- Target:     {vbs_path}")
        print(f"    \\-- WorkingDir: {repo_root}")
    else:
        raise RuntimeError("Error: No se pudo generar los accesos directos")

if __name__ == "__main__":
    create_dsh_shortcut()
