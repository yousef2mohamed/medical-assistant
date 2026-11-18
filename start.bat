@echo off
start "Backend" cmd /k "cd /d C:\medical-assistant\backend && python -m uvicorn main:app --reload"
start "Frontend" cmd /k "cd /d C:\medical-assistant\frontend && npm run dev"
timeout /t 6 >nul
start http://localhost:5173