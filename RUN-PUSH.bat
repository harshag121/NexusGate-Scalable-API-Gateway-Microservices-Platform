@echo off
cd /d "C:\Users\G Harsha Vardhan\OneDrive\Desktop\New folder\NexusGate-Scalable-API-Gateway-Microservices-Platform"

echo.
echo ========================================
echo   PUSHING TO GITHUB...
echo ========================================
echo.

echo [Step 1/3] Adding files...
git add .

echo.
echo [Step 2/3] Committing...
git commit -m "feat: Complete NexusGate API Gateway foundation (60%% complete)" -m "- Add complete infrastructure setup (docker-compose.yml)" -m "- Add comprehensive environment configuration (.env.example)" -m "- Add complete Auth Service with JWT RS256, bcrypt, Kafka events" -m "- Add shared libraries (logger, metrics, JWT, Kafka, Consul)" -m "- Add utility scripts (key generation, database seeding, health checks)" -m "- Add complete documentation (9 files)" -m "- Add build automation scripts" -m "- Add PostgreSQL schemas for 3 databases" -m "- Add Prometheus, Grafana, Jaeger, Loki configurations" -m "- Add service templates for remaining implementation" -m "" -m "Infrastructure: 100%% complete" -m "Auth Service: 100%% complete" -m "Shared Libraries: 100%% complete" -m "Documentation: 100%% complete" -m "Overall: 60%% complete (9/15 tasks)" -m "" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"

echo.
echo [Step 3/3] Pushing to GitHub...
git push origin main

echo.
if %errorlevel% equ 0 (
    echo ========================================
    echo   ✅ SUCCESS! PUSHED TO GITHUB
    echo ========================================
    echo.
    echo View your repository at:
    echo https://github.com/YOUR-USERNAME/NexusGate-Scalable-API-Gateway-Microservices-Platform
    echo.
    git log -1 --oneline
) else (
    echo ========================================
    echo   ⚠️  PUSH FAILED
    echo ========================================
    echo.
    echo Check:
    echo 1. Are you authenticated with GitHub?
    echo 2. Is the remote configured correctly?
    echo.
    echo Run: git remote -v
    echo.
)

echo.
pause
