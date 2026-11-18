@echo off
chcp 65001 > nul
title API Studio Tester [Port 8015]
echo ========================================================
echo   API STUDIO TESTER // HTTP CLIENT & BENCHMARK
echo ========================================================
echo [INFO] Проверка и установка зависимостей...
python -m pip install -r requirements.txt --quiet
echo [INFO] Запуск FastAPI веб-сервера на http://localhost:8015 ...
start http://localhost:8015
python -m uvicorn main:app --host 0.0.0.0 --port 8015
pause
