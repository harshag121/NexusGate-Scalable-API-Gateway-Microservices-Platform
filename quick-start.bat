@echo off
echo.
echo ========================================
echo   NEXUSGATE QUICK START
echo ========================================
echo.

echo [1/5] Creating directory structure...
call setup-dirs.bat
echo.

echo [2/5] Generating infrastructure and shared libraries...
node build-project.js
echo.

echo [3/5] Generating Auth Service...
node generate-services.js
echo.

echo [4/5] Generating utility scripts...
node generate-everything.js
echo.

echo [5/5] Generating JWT keys...
node scripts/generate-jwt-keys.js
echo.

echo ========================================
echo   ✅ SETUP COMPLETE!
echo ========================================
echo.
echo Next steps:
echo   1. Review .env.example and create .env
echo   2. Start infrastructure: docker-compose up -d
echo   3. Install service dependencies:
echo      cd services\auth-service ^&^& npm install
echo   4. Seed database: node scripts\seed-database.js
echo   5. Check health: node scripts\health-check.js
echo.
echo See SETUP-GUIDE.md for complete instructions.
echo.
pause
