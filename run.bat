@echo off
echo ==============================================
^|     SalonLink Pakistan - Complete Project      ^|
^|        How to Run, Build, Test                 ^|
==================================================
echo.

:: ─── BACKEND ─────────────────────────────────
echo [Backend Commands]
echo   cd backend
echo   npm run dev          Start development server (port 4000)
echo   npm run build        Compile TypeScript
echo   npm start            Run compiled server
echo   npm run typecheck    Check TypeScript types
echo   npm run test         Run all tests
echo   npm run test:unit    Run unit tests only
echo   npm run test:watch   Watch mode
echo   npm run db:push      Push schema to database
echo   npm run db:seed      Seed sample data
echo.

:: ─── FRONTEND ────────────────────────────────
echo [Frontend Commands]
echo   cd frontend
echo   npm run dev          Start dev server (port 3000)
echo   npm run build        Production build (uses webpack)
echo   npm start            Start production server
echo   npm run test         Run Playwright E2E tests
echo   npm run test:e2e:ui  Run E2E tests with UI
echo.

:: ─── DOCKER ──────────────────────────────────
echo [Docker Commands]
echo   cd docker
echo   docker compose up -d       Start all services
echo   docker compose down        Stop all services
echo   docker compose logs -f     View logs
echo.

:: ─── TESTS ──────────────────────────────────
echo [Test Runner]
echo   run-tests.bat        Run backend tests + frontend build check
echo.

:: ─── CI/CD ──────────────────────────────────
echo [CI/CD (GitHub Actions)]
echo   Push to main/develop triggers:
echo     1. Backend tests (MySQL + Redis)
echo     2. Frontend build + E2E
echo     3. Docker build + push to Docker Hub
echo     4. Auto-deploy to VPS via SSH
echo.

echo ==============================================
^|  Ensure .env files are configured:            ^|
^|  backend/.env  - DB, JWT, Redis URLs           ^|
^|  frontend/.env - NEXT_PUBLIC_API_URL            ^|
==================================================
pause
