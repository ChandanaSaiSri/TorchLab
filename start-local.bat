@echo off
setlocal
set "ROOT=%~dp0"
title TorchLab launcher

where node >nul 2>nul || (echo Node.js was not found. Install Node 20+ and try again. & pause & exit /b 1)
set "PY=python"
where python >nul 2>nul || set "PY=py -3"
%PY% --version >nul 2>nul || (echo Python was not found. Install Python 3.10+ and try again. & pause & exit /b 1)

echo [1/3] Checking server packages...
pushd "%ROOT%server" && call npm install --no-audit --no-fund && popd
echo [2/3] Checking client packages...
pushd "%ROOT%client" && call npm install --no-audit --no-fund && popd
echo [3/3] Setting up the Python runner (first run only, PyTorch is ~1 GB)...
if not exist "%ROOT%runner\.venv\Scripts\python.exe" (
  pushd "%ROOT%runner"
  %PY% -m venv .venv || (echo Could not create the virtual environment. & pause & exit /b 1)
  .venv\Scripts\python.exe -m pip install -r requirements.txt || (echo pip install failed. & pause & exit /b 1)
  popd
)

REM --- Google sign-in (optional). The Client ID is public, so a plain text file is fine. ---
set "GFILE=%ROOT%google-client-id.txt"
if not exist "%GFILE%" (
  echo.
  echo Optional: Google sign-in. Paste your Google OAuth Client ID and press Enter.
  echo Press Enter without typing to skip. To change it later, delete google-client-id.txt.
  set "GID="
  set /p "GID=Client ID: "
  if defined GID (
    >"%GFILE%" echo %GID%
  ) else (
    >"%GFILE%" echo.
  )
)
set "GOOGLE_CLIENT_ID="
for /f "usebackq tokens=* delims=" %%A in ("%GFILE%") do set "GOOGLE_CLIENT_ID=%%A"
if defined GOOGLE_CLIENT_ID (echo Google sign-in: enabled) else (echo Google sign-in: not configured)

REM --- Admin accounts (optional). Emails listed here become admins when the API starts. ---
set "AFILE=%ROOT%admin-emails.txt"
if not exist "%AFILE%" (
  echo.
  echo Optional: admin account. Type the email you sign up with and press Enter, or just press Enter to skip.
  echo Sign up in the website first if you have not, then this takes effect the next time the API starts.
  set "AEM="
  set /p "AEM=Admin email: "
  if defined AEM (
    >"%AFILE%" echo %AEM%
  ) else (
    >"%AFILE%" echo.
  )
)
set "ADMIN_EMAILS="
for /f "usebackq tokens=* delims=" %%A in ("%AFILE%") do set "ADMIN_EMAILS=%%A"
if defined ADMIN_EMAILS (echo Admin: %ADMIN_EMAILS%) else (echo Admin: none configured)

REM --- AI assistant (optional). Put your Anthropic API key alone on the first line of anthropic-api-key.txt. ---
set "ANTHROPIC_API_KEY="
if exist "%ROOT%anthropic-api-key.txt" for /f "usebackq tokens=* delims=" %%A in ("%ROOT%anthropic-api-key.txt") do set "ANTHROPIC_API_KEY=%%A"
if defined ANTHROPIC_API_KEY (echo AI assistant: enabled) else (echo AI assistant: off ^(create anthropic-api-key.txt to turn it on^))

echo Starting services in separate windows...
start "TorchLab - Database" /d "%ROOT%server" cmd /k npm run db:local
start "TorchLab - Runner" /d "%ROOT%runner" cmd /k .venv\Scripts\python.exe -m uvicorn app:app --port 8000
start "TorchLab - API" /d "%ROOT%server" cmd /k npm run dev
start "TorchLab - Website" /d "%ROOT%client" cmd /k npm run dev

echo Waiting for services, then opening the site...
timeout /t 25 /nobreak >nul
start "" http://localhost:5173
echo.
echo TorchLab is starting at http://localhost:5173
echo Close the four "TorchLab - ..." windows to stop it.
pause
