@echo off
chcp 65001 >nul
title 경동 조직문화 분석기 - 자동 실행
echo =========================================
echo  경동 조직문화 분석기 자동 실행
echo =========================================
echo.

echo [1/4] 기존 개발 서버 종료 중...
echo   - 백엔드 서버 (포트 65432) 종료...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :65432 ^| findstr LISTENING') do (
    echo     PID %%a 종료 중...
    taskkill /f /pid %%a >nul 2>&1
)
echo   - 프론트엔드 서버 (포트 3333) 종료...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3333 ^| findstr LISTENING') do (
    echo     PID %%a 종료 중...
    taskkill /f /pid %%a >nul 2>&1
)
echo   - 기존 서버 정리 완료, 2초 대기...
timeout /t 2 /nobreak >nul

echo [2/4] 백엔드 서버 시작 중...
cd /d "%~dp0backend"
start "Backend Server" cmd /k "python -m uvicorn app:app --host 0.0.0.0 --port 65432 --reload"

echo [3/4] 프론트엔드 서버 시작 중...
cd /d "%~dp0frontend"
start "Frontend Server" cmd /k "npm run dev -- --host --port 3333"

echo [4/4] 서버 시작 대기 중 (8초)...
timeout /t 8 /nobreak >nul

echo 브라우저 열기 중...
start http://localhost:3333

echo.
echo =========================================
echo  실행 완료!
echo  - 백엔드: http://localhost:65432
echo  - 프론트엔드: http://localhost:3333
echo  * 네트워크 IP는 프론트엔드에서 자동으로 감지됩니다
echo =========================================
echo.
echo 서버를 종료하려면 각각의 창에서 Ctrl+C를 누르세요.
pause