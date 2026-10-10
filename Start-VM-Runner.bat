@echo off
REM ============================================================
REM  Infinity AI — One-Click VM Runner Starter
REM  Starts the Kali Linux sandbox VM runner on this machine.
REM  The backend (port 4000) talks to this runner (port 4100).
REM ============================================================

title Infinity AI VM Runner

echo.
echo  ============================================================
echo   Infinity AI — VM Runner (Kali Linux Sandbox)
echo  ============================================================
echo.

REM --- Check Node.js ---
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo  [ERROR] Node.js nahi mila! Pehle https://nodejs.org se Node.js 20+ install karo.
    pause
    exit /b 1
)
echo  [OK] Node.js mila
node --version

REM --- Go to vm-runner directory ---
cd /d "%~dp0vm-runner"
if %errorlevel% neq 0 (
    echo  [ERROR] vm-runner folder nahi mila: %~dp0vm-runner
    pause
    exit /b 1
)

REM --- Install dependencies if needed ---
if not exist "node_modules" (
    echo.
    echo  Pehli baar chal raha hai — dependencies install ho rahi hain...
    call npm install
    if %errorlevel% neq 0 (
        echo  [ERROR] npm install fail ho gaya.
        pause
        exit /b 1
    )
)
echo  [OK] Dependencies ready

REM --- Check QEMU (PATH + common install locations) ---
REM Search order matches vm-runner/src/qemu.js: env override, %ProgramFiles%\qemu, PATH.
set "QEMU_BIN="
where qemu-system-x86_64 >nul 2>nul
if %errorlevel% equ 0 set "QEMU_BIN=on PATH"

if not defined QEMU_BIN if defined INFINITY_VM_RUNNER_QEMU_DIR if exist "%INFINITY_VM_RUNNER_QEMU_DIR%\qemu-system-x86_64.exe" (
    set "QEMU_BIN=%INFINITY_VM_RUNNER_QEMU_DIR%\qemu-system-x86_64.exe"
    set "PATH=%INFINITY_VM_RUNNER_QEMU_DIR%;%PATH%"
)
if not defined QEMU_BIN if exist "%ProgramFiles%\qemu\qemu-system-x86_64.exe" (
    set "QEMU_BIN=%ProgramFiles%\qemu\qemu-system-x86_64.exe"
    set "PATH=%ProgramFiles%\qemu;%PATH%"
)
if not defined QEMU_BIN if defined ProgramW6432 if exist "%ProgramW6432%\qemu\qemu-system-x86_64.exe" (
    set "QEMU_BIN=%ProgramW6432%\qemu\qemu-system-x86_64.exe"
    set "PATH=%ProgramW6432%\qemu;%PATH%"
)
if not defined QEMU_BIN if exist "C:\Program Files\qemu\qemu-system-x86_64.exe" (
    set "QEMU_BIN=C:\Program Files\qemu\qemu-system-x86_64.exe"
    set "PATH=C:\Program Files\qemu;%PATH%"
)

if not defined QEMU_BIN (
    echo.
    echo  [WARNING] QEMU nahi mila!
    echo  Ye locations check ki gayin:
    echo    - PATH ^(where qemu-system-x86_64^)
    echo    - %ProgramFiles%\qemu
    echo    - C:\Program Files\qemu
    if defined INFINITY_VM_RUNNER_QEMU_DIR echo    - %INFINITY_VM_RUNNER_QEMU_DIR% ^(INFINITY_VM_RUNNER_QEMU_DIR env^)
    echo.
    echo  Kali VM chalane ke liye QEMU chahiye:
    echo    1. https://www.qemu.org/download/ se QEMU for Windows install karo
    echo    2. "Windows Hypervisor Platform" Windows Features me enable karo
    echo    3. Ye script dobara chalao
    echo.
    pause
    exit /b 1
)
echo  [OK] QEMU mila: %QEMU_BIN%

echo.
echo  ============================================================
echo   VM Runner start ho raha hai...
echo   Port: http://127.0.0.1:4100
echo   Health: http://127.0.0.1:4100/health
echo.
echo   Band karne ke liye: Ctrl+C dabao
echo  ============================================================
echo.

call npm start
pause
