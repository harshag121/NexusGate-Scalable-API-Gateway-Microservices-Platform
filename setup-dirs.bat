@echo off
echo ========================================
echo NexusGate Project Setup
echo ========================================
echo.

echo Creating directory structure...
mkdir services\gateway\src\middleware 2>nul
mkdir services\gateway\src\routes 2>nul
mkdir services\gateway\src\config 2>nul
mkdir services\auth-service\src\controllers 2>nul
mkdir services\auth-service\src\routes 2>nul
mkdir services\auth-service\src\models 2>nul
mkdir services\auth-service\src\services 2>nul
mkdir services\auth-service\src\config 2>nul
mkdir services\auth-service\src\middleware 2>nul
mkdir services\user-service\src\controllers 2>nul
mkdir services\user-service\src\routes 2>nul
mkdir services\user-service\src\models 2>nul
mkdir services\user-service\src\config 2>nul
mkdir services\order-service\src\controllers 2>nul
mkdir services\order-service\src\routes 2>nul
mkdir services\order-service\src\models 2>nul
mkdir services\order-service\src\consumers 2>nul
mkdir services\order-service\src\config 2>nul
mkdir services\notification-service\src\consumers 2>nul
mkdir services\notification-service\src\config 2>nul
mkdir shared\logger 2>nul
mkdir shared\metrics 2>nul
mkdir shared\kafka 2>nul
mkdir shared\consul 2>nul
mkdir shared\jwt 2>nul
mkdir shared\middleware 2>nul
mkdir infrastructure\postgres\init-scripts 2>nul
mkdir infrastructure\prometheus 2>nul
mkdir infrastructure\grafana\dashboards 2>nul
mkdir infrastructure\grafana\provisioning\dashboards 2>nul
mkdir infrastructure\grafana\provisioning\datasources 2>nul
mkdir infrastructure\loki 2>nul
mkdir k8s\base 2>nul
mkdir k8s\overlays\dev 2>nul
mkdir k8s\overlays\prod 2>nul
mkdir scripts 2>nul
mkdir docs 2>nul
mkdir keys 2>nul

echo.
echo ✓ Directory structure created successfully!
echo.
echo Next steps:
echo 1. Run: node build-project.js
echo 2. Run: node generate-services.js  
echo 3. Check BUILD-GUIDE.md for complete instructions
echo.
pause
