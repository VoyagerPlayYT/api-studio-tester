@echo off
chcp 65001 > nul
title API Studio Tester [Port 8015]
echo ========================================================
echo   API STUDIO TESTER [PORT 8015]
echo ========================================================

if exist "C:\Python313\python.exe" (
    set "PY=C:\Python313\python.exe"
) else (
    set "PY=python"
)

echo [INFO] Проверка и освобождение порта 8015...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8015" ^| findstr "LISTENING"') do taskkill /f /pid %%a >nul 2>&1

echo [INFO] Запуск веб-сервера на http://localhost:8015 ...
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:8015"

cd /d "%~dp0"
"%PY%" -m uvicorn main:app --host 127.0.0.1 --port 8015
pause
