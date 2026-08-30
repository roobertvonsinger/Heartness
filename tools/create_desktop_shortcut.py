import os
import subprocess

def create_shortcut():
    desktop_path = os.path.expanduser('~/Desktop')
    shortcut_path = os.path.join(desktop_path, 'RITA DSH.lnk')
    vbs_path = r'c:\Users\rober\Dropbox\TESTING DEV\repos\deepseek-harness\RITA_DSH.vbs'
    work_dir = r'c:\Users\rober\Dropbox\TESTING DEV\repos\deepseek-harness'

    ps_command = f"""
    $WshShell = New-Object -ComObject WScript.Shell
    $Shortcut = $WshShell.CreateShortcut('{shortcut_path}')
    $Shortcut.TargetPath = 'wscript.exe'
    $Shortcut.Arguments = '"{vbs_path}"'
    $Shortcut.WorkingDirectory = '{work_dir}'
    $Shortcut.Description = 'RITA DSH - Copiloto Soberano y Harness Agéntico'
    $Shortcut.Save()
    """

    subprocess.run(['powershell', '-Command', ps_command], check=True)
    print(f"[+] Acceso directo creado en: {shortcut_path}")

if __name__ == '__main__':
    create_shortcut()
