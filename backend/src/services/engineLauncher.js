/**
 * engineLauncher.js — builds the one-click "Dark Matter Engine" launcher scripts.
 *
 * Problem it solves: on the deployed site the Models page talks to the Render
 * backend for all app logic, but the AI engine (llama-server + the local model
 * backend on http://localhost:4000) must run on the USER'S own computer.
 * Telling the user to "start the backend yourself" is a dead end — so Step 0
 * offers this launcher instead: download one small file, run it, and it does
 * everything automatically:
 *
 *   1. checks Node.js 20+ (installs it on Windows via winget when missing)
 *   2. downloads the Dark Matter backend from GitHub (public repo)
 *   3. runs `npm install` (first run only)
 *   4. starts the backend on http://localhost:4000
 *   5. triggers the llama-server engine download through the loopback-only
 *      POST /api/v1/engine/bootstrap endpoint
 *   6. opens the Models page in the browser
 *
 * The `__SITE__` placeholder is replaced with the site origin (passed by the
 * frontend as `?site=`) when the script is served.
 */

const REPO_ZIP_URL = 'https://codeload.github.com/Obfinityy/Dark-Matter/zip/refs/heads/main';
const LOCAL_HEALTH = 'http://localhost:4000/api/v1/health';
const LOCAL_BOOTSTRAP = 'http://localhost:4000/api/v1/engine/bootstrap';

const WINDOWS_LAUNCHER = `@echo off
rem ============================================================
rem  Dark Matter Engine - one-click launcher (generated file)
rem  Run it: double-click. It starts everything automatically.
rem ============================================================

echo ============================================================
echo  Dark Matter Engine - one-click local backend + AI engine
echo ============================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 goto nonode
echo [1/6] Node.js OK
goto after_node
:nonode
echo [1/6] Node.js not found - trying automatic install...
where winget >nul 2>nul
if %errorlevel% neq 0 goto manual_node
winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
echo.
echo Node.js installed. Close this window and double-click the launcher again.
pause
exit /b 0
:manual_node
echo Automatic install is not available on this PC.
echo Install Node.js 20 or newer from https://nodejs.org
echo then double-click this file again.
pause
exit /b 1
:after_node

set "DM_HOME=%USERPROFILE%\\.darkmatter\\engine"
if not exist "%DM_HOME%" mkdir "%DM_HOME%"
cd /d "%DM_HOME%"

if exist "backend\\package.json" goto skip_dl
echo [2/6] Downloading Dark Matter backend...
curl -L -o dm-backend.zip "${REPO_ZIP_URL}"
if %errorlevel% neq 0 goto dl_fail
tar -xf dm-backend.zip
if exist "Dark-Matter-main\\backend" (
  if exist "backend" rmdir /s /q backend
  move "Dark-Matter-main\\backend" backend >nul
)
rmdir /s /q Dark-Matter-main
del dm-backend.zip
goto after_dl
:dl_fail
echo Download failed - check your internet connection and run this file again.
pause
exit /b 1
:after_dl
:skip_dl
echo [2/6] Backend files OK

cd /d "%DM_HOME%\\backend"
if exist "node_modules" goto skip_npm
echo [3/6] Installing dependencies - first run only, one time...
call npm install --no-audit --no-fund
if %errorlevel% neq 0 goto npm_fail
goto after_npm
:npm_fail
echo npm install failed. Run this file again to retry.
pause
exit /b 1
:after_npm
:skip_npm
echo [3/6] Dependencies OK

curl -s -o nul --max-time 3 "${LOCAL_HEALTH}"
if %errorlevel% equ 0 goto already_up
echo [4/6] Starting Dark Matter backend on http://localhost:4000 ...
start "Dark Matter Backend" /min node src/server.js
echo Waiting for the backend to start...
set /a tries=0
:waitloop
curl -s -o nul --max-time 3 "${LOCAL_HEALTH}"
if %errorlevel% equ 0 goto backend_ready
set /a tries+=1
if %tries% geq 30 goto backend_fail
timeout /t 2 /nobreak >nul
goto waitloop
:backend_fail
echo The backend did not start in time.
echo Check the "Dark Matter Backend" window for errors, then run this file again.
pause
exit /b 1
:backend_ready
echo Backend is running.
goto after_start
:already_up
echo [4/6] Backend already running on http://localhost:4000
:after_start

echo [5/6] Starting the AI engine download - one time...
curl -s -o nul --max-time 10 -X POST "${LOCAL_BOOTSTRAP}"

echo [6/6] Opening the Models page in your browser...
start "" "__SITE__/agent/models"

echo.
echo Done! The engine is downloading - watch the progress on the Models page.
echo Keep the "Dark Matter Backend" window open while you use local models.
echo You can close this window now.
pause
`;

const POSIX_LAUNCHER = `#!/bin/sh
# ============================================================
#  Dark Matter Engine - one-click launcher (generated file)
#  Run it:  sh dark-matter-engine.sh
#  It starts everything automatically.
# ============================================================
set -u

SITE="__SITE__"
DM_HOME="$HOME/.darkmatter/engine"
REPO_ZIP="${REPO_ZIP_URL}"
LOCAL_HEALTH="${LOCAL_HEALTH}"
LOCAL_BOOTSTRAP="${LOCAL_BOOTSTRAP}"

echo "============================================================"
echo " Dark Matter Engine - one-click local backend + AI engine"
echo "============================================================"

if ! command -v node >/dev/null 2>&1; then
  echo "[1/6] Node.js 20+ is required but was not found."
  OS_NAME="$(uname -s)"
  if [ "$OS_NAME" = "Darwin" ]; then
    if command -v brew >/dev/null 2>&1; then
      echo "Installing Node.js via Homebrew..."
      brew install node || exit 1
    else
      echo "Install Node.js from https://nodejs.org (or Homebrew from https://brew.sh)"
      echo "then run this file again:  sh dark-matter-engine.sh"
      exit 1
    fi
  else
    echo "Install Node.js 20+ from https://nodejs.org"
    echo "then run this file again:  sh dark-matter-engine.sh"
    exit 1
  fi
fi
echo "[1/6] Node.js OK"

mkdir -p "$DM_HOME"
cd "$DM_HOME" || exit 1
if [ ! -f "backend/package.json" ]; then
  echo "[2/6] Downloading Dark Matter backend..."
  curl -L -o dm-backend.zip "$REPO_ZIP" || { echo "Download failed - check your connection."; exit 1; }
  tar -xf dm-backend.zip || { echo "Could not unpack the download."; exit 1; }
  rm -rf backend
  mv Dark-Matter-main/backend backend
  rm -rf Dark-Matter-main dm-backend.zip
fi
echo "[2/6] Backend files OK"

cd "$DM_HOME/backend" || exit 1
if [ ! -d "node_modules" ]; then
  echo "[3/6] Installing dependencies - first run only, one time..."
  npm install --no-audit --no-fund || { echo "npm install failed - run again to retry."; exit 1; }
fi
echo "[3/6] Dependencies OK"

if curl -s -o /dev/null --max-time 3 "$LOCAL_HEALTH"; then
  echo "[4/6] Backend already running on http://localhost:4000"
else
  echo "[4/6] Starting Dark Matter backend on http://localhost:4000 ..."
  nohup node src/server.js >"$DM_HOME/backend.log" 2>&1 &
  echo "Waiting for the backend to start..."
  tries=0
  while [ $tries -lt 30 ]; do
    if curl -s -o /dev/null --max-time 3 "$LOCAL_HEALTH"; then
      break
    fi
    sleep 2
    tries=$((tries + 1))
  done
  if ! curl -s -o /dev/null --max-time 3 "$LOCAL_HEALTH"; then
    echo "The backend did not start. See the log: $DM_HOME/backend.log"
    exit 1
  fi
  echo "Backend is running (log: $DM_HOME/backend.log)"
fi

echo "[5/6] Starting the AI engine download - one time..."
curl -s -o /dev/null --max-time 10 -X POST "$LOCAL_BOOTSTRAP"

echo "[6/6] Opening the Models page in your browser..."
OS_NAME="$(uname -s)"
if [ "$OS_NAME" = "Darwin" ]; then
  open "$SITE/agent/models"
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$SITE/agent/models" >/dev/null 2>&1 &
else
  echo "Open this page in your browser: $SITE/agent/models"
fi

echo ""
echo "Done! The engine is downloading - watch the progress on the Models page."
echo "The backend keeps running in the background."
`;

/** Download metadata per OS key. */
export const LAUNCHER_FILES = {
  windows: { filename: 'dark-matter-engine.bat', mime: 'application/octet-stream' },
  macos: { filename: 'dark-matter-engine.sh', mime: 'application/x-sh' },
  linux: { filename: 'dark-matter-engine.sh', mime: 'application/x-sh' },
};

/**
 * Build the launcher script for an OS.
 * @param {'windows'|'macos'|'linux'} os
 * @param {{ site: string }} opts — site origin, e.g. https://hack.thebhavesh.online
 * @returns {string} the script with __SITE__ replaced
 */
export function buildLauncher(os, { site }) {
  const template = os === 'windows' ? WINDOWS_LAUNCHER : POSIX_LAUNCHER;
  return template.split('__SITE__').join(site);
}
