#![windows_subsystem = "windows"]

/**
 * DeepSick Hardness (DSH) — Sovereign Native Launcher
 *
 * 100% Frictionless Desktop Launcher:
 * - Single-Instance: focuses existing window instantly if already open.
 * - Zero Console Flash: compiled with windows_subsystem = "windows".
 * - Physical Desktop Bridge: launches PWA window on WinSta0\Default.
 * - Autonomous Backend: starts Node daemon on :3080 with CREATE_NO_WINDOW if not running.
 */

use std::ffi::OsStr;
use std::net::TcpStream;
use std::os::windows::ffi::OsStrExt;
use std::os::windows::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::thread;
use std::time::Duration;

#[repr(C)]
#[allow(non_snake_case)]
struct STARTUPINFOW {
    cb: u32,
    lpReserved: *mut u16,
    lpDesktop: *mut u16,
    lpTitle: *mut u16,
    dwX: u32,
    dwY: u32,
    dwXSize: u32,
    dwYSize: u32,
    dwXCountChars: u32,
    dwYCountChars: u32,
    dwFillAttribute: u32,
    dwFlags: u32,
    wShowWindow: u16,
    cbReserved2: u16,
    lpReserved2: *mut u8,
    hStdInput: isize,
    hStdOutput: isize,
    hStdError: isize,
}

#[repr(C)]
#[allow(non_snake_case)]
struct PROCESS_INFORMATION {
    hProcess: isize,
    hThread: isize,
    dwProcessId: u32,
    dwThreadId: u32,
}

const ERROR_ALREADY_EXISTS: u32 = 183;
const SW_RESTORE: i32 = 9;
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[link(name = "kernel32")]
extern "system" {
    fn CreateProcessW(
        lpApplicationName: *const u16,
        lpCommandLine: *mut u16,
        lpProcessAttributes: *mut std::ffi::c_void,
        lpThreadAttributes: *mut std::ffi::c_void,
        bInheritHandles: i32,
        dwCreationFlags: u32,
        lpEnvironment: *mut std::ffi::c_void,
        lpCurrentDirectory: *const u16,
        lpStartupInfo: *mut STARTUPINFOW,
        lpProcessInformation: *mut PROCESS_INFORMATION,
    ) -> i32;
    fn CloseHandle(hObject: isize) -> i32;
    fn CreateMutexW(lpMutexAttributes: *mut std::ffi::c_void, bInitialOwner: i32, lpName: *const u16) -> isize;
    fn GetLastError() -> u32;
}

#[link(name = "user32")]
extern "system" {
    fn FindWindowW(lpClassName: *const u16, lpWindowName: *const u16) -> isize;
    fn SetForegroundWindow(hWnd: isize) -> i32;
    fn ShowWindow(hWnd: isize, nCmdShow: i32) -> i32;
}

fn to_wide(s: &str) -> Vec<u16> {
    OsStr::new(s).encode_wide().chain(Some(0)).collect()
}

fn is_port_open(port: u16) -> bool {
    let addr = format!("127.0.0.1:{}", port);
    if let Ok(addr) = addr.parse() {
        TcpStream::connect_timeout(&addr, Duration::from_millis(250)).is_ok()
    } else {
        false
    }
}

fn find_node() -> PathBuf {
    let candidates = [
        r"C:\Program Files\nodejs\node.exe",
        r"C:\Program Files (x86)\nodejs\node.exe",
    ];
    for c in &candidates {
        let p = PathBuf::from(c);
        if p.exists() {
            return p;
        }
    }
    PathBuf::from("node.exe")
}

fn find_browser() -> Option<PathBuf> {
    let candidates = [
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    ];

    for c in &candidates {
        let p = PathBuf::from(c);
        if p.exists() {
            return Some(p);
        }
    }
    None
}

fn find_repo_dir() -> PathBuf {
    // 1. Check canonical path
    let canonical = PathBuf::from(r"C:\Users\rober\Dropbox\TESTING DEV\repos\dsh");
    if canonical.join("apps").join("cli").join("lib").join("bin.js").exists() {
        return canonical;
    }

    // 2. Current working directory
    if let Ok(cwd) = std::env::current_dir() {
        if cwd.join("apps").join("cli").join("lib").join("bin.js").exists() {
            return cwd;
        }
    }

    // 3. Executable parent directory
    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            if parent.join("apps").join("cli").join("lib").join("bin.js").exists() {
                return parent.to_path_buf();
            }
        }
    }

    PathBuf::from(r"C:\Users\rober\Dropbox\TESTING DEV\repos\dsh")
}

fn launch_browser_on_desktop(browser: &Path, args: &str, cwd: &Path) -> bool {
    let app_wide = to_wide(&browser.to_string_lossy());
    let mut cmd_wide = to_wide(&format!(r#""{}" {}"#, browser.display(), args));
    let cwd_wide = to_wide(&cwd.to_string_lossy());
    let mut desktop_wide = to_wide(r"WinSta0\Default");

    let mut si = STARTUPINFOW {
        cb: std::mem::size_of::<STARTUPINFOW>() as u32,
        lpReserved: std::ptr::null_mut(),
        lpDesktop: desktop_wide.as_mut_ptr(),
        lpTitle: std::ptr::null_mut(),
        dwX: 0,
        dwY: 0,
        dwXSize: 0,
        dwYSize: 0,
        dwXCountChars: 0,
        dwYCountChars: 0,
        dwFillAttribute: 0,
        dwFlags: 0,
        wShowWindow: 0,
        cbReserved2: 0,
        lpReserved2: std::ptr::null_mut(),
        hStdInput: 0,
        hStdOutput: 0,
        hStdError: 0,
    };

    let mut pi = PROCESS_INFORMATION {
        hProcess: 0,
        hThread: 0,
        dwProcessId: 0,
        dwThreadId: 0,
    };

    let success = unsafe {
        CreateProcessW(
            app_wide.as_ptr(),
            cmd_wide.as_mut_ptr(),
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            0,
            0,
            std::ptr::null_mut(),
            cwd_wide.as_ptr(),
            &mut si,
            &mut pi,
        )
    };

    if success != 0 {
        unsafe {
            CloseHandle(pi.hProcess);
            CloseHandle(pi.hThread);
        }
        true
    } else {
        // Fallback: regular command spawn
        Command::new(browser)
            .raw_arg(args)
            .current_dir(cwd)
            .spawn()
            .is_ok()
    }
}

fn focus_existing_window() -> bool {
    let window_title = to_wide("DeepSick Hardness (DSH)");
    let hwnd = unsafe { FindWindowW(std::ptr::null(), window_title.as_ptr()) };
    if hwnd != 0 {
        unsafe {
            ShowWindow(hwnd, SW_RESTORE);
            SetForegroundWindow(hwnd);
        }
        true
    } else {
        false
    }
}

fn main() {
    let mutex_name = to_wide("Global\\DSH_Sovereign_Cockpit_Mutex");
    let mutex = unsafe { CreateMutexW(std::ptr::null_mut(), 0, mutex_name.as_ptr()) };

    if mutex != 0 && unsafe { GetLastError() } == ERROR_ALREADY_EXISTS {
        if focus_existing_window() {
            return;
        }
    }

    let repo_dir = find_repo_dir();
    let port = 3080;
    let local_app_data = std::env::var("LOCALAPPDATA").unwrap_or_else(|_| r"C:\Users\rober\AppData\Local".to_string());
    let log_path = format!(r"{}\dsh_launcher.log", local_app_data);
    let daemon_log_path = format!(r"{}\dsh_daemon.log", local_app_data);

    // 1. Ensure backend is running
    if !is_port_open(port) {
        let node_exe = find_node();
        let bin_js = repo_dir.join("apps").join("cli").join("lib").join("bin.js");

        let log_file = std::fs::OpenOptions::new()
            .create(true)
            .write(true)
            .truncate(true)
            .open(&daemon_log_path);

        let mut cmd = Command::new(&node_exe);
        cmd.arg(&bin_js)
            .arg("web")
            .arg("--port")
            .arg(port.to_string())
            .arg("--no-open")
            .current_dir(&repo_dir)
            .stdin(std::process::Stdio::null())
            .creation_flags(CREATE_NO_WINDOW | 0x00000200);

        if let Ok(file) = log_file {
            if let Ok(err_clone) = file.try_clone() {
                cmd.stdout(file);
                cmd.stderr(err_clone);
            }
        }

        let spawn_res = cmd.spawn();

        let log_entry = format!(
            "repo: {}\nnode: {}\nbin_js: {} (exists: {})\nspawn: {:?}\n",
            repo_dir.display(),
            node_exe.display(),
            bin_js.display(),
            bin_js.exists(),
            spawn_res.as_ref().map(|c| c.id()).map_err(|e| e.to_string())
        );
        let _ = std::fs::write(&log_path, log_entry);

        // Wait up to 10 seconds for backend port 3080 to become ready
        for _ in 0..40 {
            thread::sleep(Duration::from_millis(250));
            if is_port_open(port) {
                break;
            }
        }
    }

    // 2. Launch browser window in PWA App Mode on physical monitor WinSta0\Default
    if let Some(browser) = find_browser() {
        let local_app_data = std::env::var("LOCALAPPDATA").unwrap_or_else(|_| r"C:\Users\rober\AppData\Local".to_string());
        let profile_dir = format!(r"{}\DSH_Desktop_Profile", local_app_data);

        let args = format!(
            r#"--app=http://127.0.0.1:{} --window-size=1400,920 "--user-data-dir={}" --app-id=dsh-sovereign "--title=DeepSick Hardness (DSH)""#,
            port,
            profile_dir
        );

        launch_browser_on_desktop(&browser, &args, &repo_dir);
    } else {
        let _ = Command::new("cmd.exe")
            .arg("/c")
            .arg("start")
            .arg(format!("http://127.0.0.1:{}", port))
            .creation_flags(CREATE_NO_WINDOW)
            .spawn();
    }
}
