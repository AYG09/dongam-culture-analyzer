@echo off
chcp 65001 > nul

REM =============================================
REM org_culture_analyzer 폴더 내부 실행용 개발 서버 스크립트
REM =============================================
REM 이 파일을 org_culture_analyzer 폴더에 넣고 더블클릭하세요.
REM node_modules가 없으면 install-deps.bat을 먼저 실행하세요.

echo.
echo =========================================================
echo  Culture Map 개발 서버 및 브라우저를 시작합니다...
echo =========================================================
echo.
echo [1/2] 새 창에서 개발 서버를 실행합니다...
start "Culture Map Dev Server" cmd /k "npm.cmd run dev"

echo [2/2] 5초 후에 브라우저를 엽니다...
timeout /t 5 /nobreak > nul

start http://localhost:5178

echo.
echo =========================================================
echo  서버가 새 창에서 실행중이며, 브라우저가 열렸습니다.
echo  이 창은 이제 닫아도 됩니다.
echo =========================================================
echo.
timeout /t 3 > nul
