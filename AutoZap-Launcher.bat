@echo off
title AutoZap Enterprise Launcher
color 0B

:: ─── CHECK ADMINISTRATOR ───────────────────────────────
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARNING] Not running as Administrator. DB checks may fail.
    echo.
)

:: ─── BANNER ────────────────────────────────────────────
echo ==============================================
echo     AutoZap Enterprise - WhatsApp Automation
echo     Platform for Salons
echo ==============================================
echo.

:: ─── CHECK NODE.JS ────────────────────────────────────
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
echo [OK] Node.js %NODE_VER%

:: ─── CHECK NPM ─────────────────────────────────────────
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] npm is not installed.
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('npm -v') do set NPM_VER=%%i
echo [OK] npm v%NPM_VER%
echo.

:: ─── INSTALL DEPENDENCIES ─────────────────────────────
if not exist "node_modules" (
    echo [!] node_modules not found. Installing dependencies...
    echo This may take 2-5 minutes on first run.
    echo.
    call npm install
    if errorlevel 1 (
        echo [ERROR] npm install failed. Check your internet connection.
        pause
        exit /b 1
    )
    echo [OK] Dependencies installed successfully.
    echo.
) else (
    echo [OK] node_modules found.
)

:: ─── CHECK .ENV ────────────────────────────────────────
if not exist ".env" (
    echo [WARNING] .env file not found.
    if exist ".env.example" (
        echo [INFO] Creating .env from .env.example...
        copy .env.example .env > nul
        echo [INFO] Please edit .env with your database credentials.
    ) else (
        echo [WARNING] No .env.example found. Creating minimal .env...
        (
            echo DB_HOST=localhost
            echo DB_USER=root
            echo DB_PASS=
            echo DB_NAME=autozap_platform
            echo PORT=3000
            echo NODE_ENV=development
            echo JWT_SECRET=salonlink-super-secret-key-change-in-prod
        ) > .env
    )
    echo.
)

:: ─── CHECK PORT ────────────────────────────────────────
netstat -ano | findstr ":3000 " >nul
if %errorlevel% equ 0 (
    echo [ERROR] Port 3000 is already in use!
    echo Please close the other application using port 3000.
    echo Or change PORT in .env file.
    pause
    exit /b 1
)
echo [OK] Port 3000 is available.
echo.

:: ─── CHECK MySQL ──────────────────────────────────────
echo [*] Checking MySQL connection...
node scripts/check-mysql.cjs 2> nul
if errorlevel 1 (
    echo [!] MySQL check failed (may not be installed).
    echo [!] The app will still start, but database features won't work.
    echo [!] Install XAMPP or MySQL and create database 'autozap_platform'.
    echo.
    set DB_FAILED=1
) else (
    echo [OK] MySQL is running.
    set DB_FAILED=0
)

:: ─── CREATE DATABASE ──────────────────────────────────
if "%DB_FAILED%"=="0" (
    echo [*] Ensuring database exists...
    node scripts/create-database.cjs >nul 2>&1
    if errorlevel 1 (
        echo [!] Could not create database. Schema may be missing.
    ) else (
        echo [OK] Database 'autozap_platform' ready.
    )

    :: ─── RUN SCHEMA ────────────────────────────────────
    echo [*] Running database schema...
    if exist "schema.sql" (
        node scripts/run-schema.cjs >nul 2>&1
        if errorlevel 1 (
            echo [!] Schema may have warnings. Server will auto-create missing tables.
        ) else (
            echo [OK] Database schema applied.
        )
    )
)

echo.
echo ==============================================
echo     Starting AutoZap Enterprise Server
echo     http://localhost:3000
echo ==============================================
echo.
echo [INFO] Press Ctrl+C to stop the server.
echo [INFO] Admin Panel: http://localhost:3000/admin
echo [INFO] Salon Portal: http://localhost:3000/salon
echo.

:: ─── START SERVER ─────────────────────────────────────
npm run dev

:: ─── IF SERVER CRASHES ────────────────────────────────
echo.
echo [ERROR] Server stopped unexpectedly.
echo Check server-err.txt or server.log for details.
pause
