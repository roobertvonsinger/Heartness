import os
import subprocess

def create_shortcut():
    desktop_path = os.path.expanduser('~/Desktop')
    shortcut_path = os.path.join(desktop_path, 'DSH.lnk')
    old_shortcut_path = os.path.join(desktop_path, 'RITA DSH.lnk')
    
    # Remove old shortcut if exists
    if os.path.exists(old_shortcut_path):
        try:
            os.remove(old_shortcut_path)
            print(f"[-] Acceso directo antiguo eliminado: {old_shortcut_path}")
        except Exception:
            pass

    vbs_path = r'c:\Users\rober\Dropbox\TESTING DEV\repos\dsh\DSH.vbs'
    work_dir = r'c:\Users\rober\Dropbox\TESTING DEV\repos\dsh'

    ps_command = f"""
    $WshShell = New-Object -ComObject WScript.Shell
    $Shortcut = $WshShell.CreateShortcut('{shortcut_path}')
    $Shortcut.TargetPath = 'wscript.exe'
    $Shortcut.Arguments = '"{vbs_path}"'
    $Shortcut.WorkingDirectory = '{work_dir}'
    $Shortcut.Description = 'DeepSick Hardness (DSH)'
    $Shortcut.Save()
    """

    subprocess.run(['powershell', '-Command', ps_command], check=True)
    print(f"[+] Acceso directo creado en: {shortcut_path}")

if __name__ == '__main__':
    create_shortcut()
