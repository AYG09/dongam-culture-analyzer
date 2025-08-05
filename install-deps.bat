@echo off
chcp 65001 > nul

REM =============================================
REM org_culture_analyzer 의존성 자동 설치 스크립트 (초보자용)
REM =============================================
REM 이 파일을 org_culture_analyzer 폴더에 넣고 더블클릭하세요.
REM node_modules가 없으면 npm install을 자동 실행합니다.

REM Node.js 설치 여부 확인
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js가 설치되어 있지 않습니다!
    echo https://nodejs.org 에서 LTS 버전을 설치한 후 다시 실행하세요.
    pause
    exit /b 1
)

REM Python 설치 여부 확인 (필요한 경우만)
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [경고] Python이 설치되어 있지 않습니다. 일부 기능(분석, PDF 등)이 동작하지 않을 수 있습니다.
    echo https://www.python.org/downloads/ 에서 Python 3.x를 설치해 주세요.
    echo (설치 후 cmd 창을 껐다가 다시 실행해야 인식됩니다)
)

if exist node_modules (
    echo [INFO] node_modules 폴더가 이미 존재합니다. 설치를 건너뜁니다.
) else (
    echo [INFO] node_modules 폴더가 없습니다. npm install을 실행합니다...
    npm install
    if %errorlevel% neq 0 (
        echo [ERROR] npm install 중 오류가 발생했습니다!
        pause
        exit /b 1
    )
    echo [INFO] npm install이 완료되었습니다.
)
echo.
echo [INFO] 의존성 설치 체크가 완료되었습니다.
pause
