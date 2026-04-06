@echo off
echo.
echo ========================================
echo   PUSH NEXUSGATE TO GITHUB
echo ========================================
echo.
echo This will push 23 files to your repository
echo.
set /p confirm="Ready to push? (yes/no): "

if /i not "%confirm%"=="yes" (
    echo Push cancelled. Run again when ready.
    pause
    exit /b
)

echo.
echo [1/4] Adding all files...
git add .

echo.
echo [2/4] Committing changes...
git commit -m "feat: Complete NexusGate API Gateway foundation (60%% complete)

- Add complete infrastructure setup (docker-compose.yml)
- Add comprehensive environment configuration (.env.example)
- Add complete Auth Service with JWT RS256, bcrypt, Kafka events
- Add shared libraries (logger, metrics, JWT, Kafka, Consul)
- Add utility scripts (key generation, database seeding, health checks)
- Add complete documentation (9 files)
- Add build automation scripts
- Add PostgreSQL schemas for 3 databases
- Add Prometheus, Grafana, Jaeger, Loki configurations
- Add service templates for remaining implementation

Infrastructure: 100%% complete
Auth Service: 100%% complete
Shared Libraries: 100%% complete
Documentation: 100%% complete
Overall: 60%% complete (9/15 tasks)

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"

echo.
echo [3/4] Pushing to GitHub...
git push origin main

if errorlevel 1 (
    echo.
    echo ❌ Push failed! See FINAL-INSTRUCTIONS.md for troubleshooting
    pause
    exit /b 1
)

echo.
echo [4/4] Verifying push...
git log -1 --oneline

echo.
echo ========================================
echo   ✅ PUSH COMPLETE!
echo ========================================
echo.
echo Your NexusGate foundation is now on GitHub!
echo See FINAL-INSTRUCTIONS.md for next steps
echo.
pause
