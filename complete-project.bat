@echo off
echo.
echo ========================================
echo   COMPLETING NEXUSGATE PROJECT
echo ========================================
echo.
echo Generating remaining 40%%:
echo  - User Service
echo  - Order Service
echo  - Notification Service
echo  - API Gateway
echo.

echo [1/5] Generating User Service...
node complete-remaining-services.js
if errorlevel 1 (
    echo Error generating User Service
    pause
    exit /b 1
)

echo.
echo [2/5] Generating Order Service...
node generate-order-service.js
if errorlevel 1 (
    echo Error generating Order Service
    pause
    exit /b 1
)

echo.
echo [3/5] Generating Notification Service...
node generate-notification-service.js
if errorlevel 1 (
    echo Error generating Notification Service
    pause
    exit /b 1
)

echo.
echo [4/5] Generating API Gateway...
node generate-gateway.js
if errorlevel 1 (
    echo Error generating API Gateway
    pause
    exit /b 1
)

echo.
echo [5/5] Installing dependencies in each service...
echo.

cd services\user-service
if exist package.json (
    echo Installing User Service dependencies...
    call npm install --silent
)
cd ..\..

cd services\order-service
if exist package.json (
    echo Installing Order Service dependencies...
    call npm install --silent
)
cd ..\..

cd services\notification-service
if exist package.json (
    echo Installing Notification Service dependencies...
    call npm install --silent
)
cd ..\..

cd services\gateway
if exist package.json (
    echo Installing Gateway dependencies...
    call npm install --silent
)
cd ..\..

echo.
echo ========================================
echo   ✅ PROJECT 100%% COMPLETE!
echo ========================================
echo.
echo All services generated:
echo  ✓ Auth Service (was already done)
echo  ✓ User Service (NEW)
echo  ✓ Order Service (NEW)
echo  ✓ Notification Service (NEW)
echo  ✓ API Gateway (NEW)
echo.
echo Next steps:
echo  1. Start infrastructure: docker-compose up -d
echo  2. Generate JWT keys: node scripts\generate-jwt-keys.js
echo  3. Seed database: node scripts\seed-database.js
echo  4. Test: curl http://localhost:8080/health
echo.
echo See COMPLETE-PROJECT-GUIDE.md for testing instructions
echo.
pause
