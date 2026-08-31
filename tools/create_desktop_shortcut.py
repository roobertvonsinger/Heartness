import os
import subprocess
from pathlib import Path

def create_dsh_shortcut():
    # 1. Rutas dinamicas basadas en la raiz del repo DSH
    repo_root = Path(__file__).resolve().parent.parent
    vbs_path = repo_root / "DSH.vbs"
    desktop_path = Path(os.path.expanduser("~/Desktop"))
    shortcut_path = desktop_path / "DSH.lnk"
    
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

    # 4. Generacion PowerShell con Hotkey y Metadatos
    ps_script = f"""
    $WshShell = New-Object -ComObject WScript.Shell
    $Shortcut = $WshShell.CreateShortcut('{shortcut_path}')
    $Shortcut.TargetPath = 'wscript.exe'
    $Shortcut.Arguments = '"{vbs_path}"'
    $Shortcut.WorkingDirectory = '{repo_root}'
    $Shortcut.Description = 'DeepShell / DSH Sovereign Harness (Ctrl+Alt+D)'
    $Shortcut.Hotkey = 'Ctrl+Alt+D'
    $Shortcut.WindowStyle = 7  # Minimized para proceso de fondo
    {icon_param}
    $Shortcut.Save()
    """

    subprocess.run(["powershell", "-NoProfile", "-Command", ps_script], check=True)

    # 5. Verificacion Empirica
    if shortcut_path.exists() and shortcut_path.stat().st_size > 0:
        print(f"[+] Acceso directo verificado exitosamente: {shortcut_path}")
        print(f"    |-- Atajo global: [Ctrl + Alt + D]")
        print(f"    |-- Target: {vbs_path}")
        print(f"    \\-- Working Dir: {repo_root}")
    else:
        raise RuntimeError(f"Error: No se pudo generar el acceso directo en {shortcut_path}")

if __name__ == "__main__":
    create_dsh_shortcut()
