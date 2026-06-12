@echo off
echo Starting AI Invoice Parser...


:: Navigate to backend and start the FastAPI server
cd /d "%~dp0backend"
start http://127.0.0.1:8001/
python main.py

pause
