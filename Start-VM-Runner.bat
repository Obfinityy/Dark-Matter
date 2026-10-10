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

REM --- Check QEMU ---
where qemu-system-x86_64 >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo  [WARNING] QEMU nahi mila!
    echo  Kali VM chalane ke liye QEMU chahiye:
    echo    1. https://www.qemu.org/download/ se QEMU for Windows install karo
    echo    2. "Windows Hypervisor Platform" Windows Features me enable karo
    echo    3. Ye script dobara chalao
    echo.
    pause
    exit /b 1
)
echo  [OK] QEMU mila

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
