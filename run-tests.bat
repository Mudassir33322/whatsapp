@echo off
echo ====================================
echo   SalonLink Pakistan - Test Runner
echo ====================================
echo.

:: Backend Tests
echo [1/2] Running Backend Tests...
cd /d "%~dp0backend"
call npx vitest run --reporter=verbose
if %errorlevel% neq 0 (
    echo.
    echo [WARN] Some backend tests failed or skipped.
    echo        Skipped tests need MySQL running on localhost:3306.
)

echo.
echo [2/2] Running Frontend Build Check...
cd /d "%~dp0frontend"
call npx next build --webpack 2>nul
if %errorlevel% equ 0 (
    echo [OK] Frontend builds successfully.
) else (
    echo [FAIL] Frontend build failed.
)

echo.
echo ====================================
echo   All checks complete!
echo   Tests: ^> see output above
echo ====================================
pause
