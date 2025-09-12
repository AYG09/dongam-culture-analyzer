@echo off
setlocal
Title 경동 조직문화 분석기 - 실행 스크립트

REM 현재 스크립트의 디렉터리
set "ROOT=%~dp0"
set "BACKEND=%ROOT%backend"
set "FRONTEND=%ROOT%frontend"

REM 우선 로컬 가상환경 파이썬 사용, 없으면 PATH의 python 사용
set "PY_EXE=%ROOT%..\.venv\Scripts\python.exe"
if exist "%PY_EXE%" (
  echo [INFO] Using venv Python: "%PY_EXE%"
) else (
  echo [WARN] venv Python not found. Falling back to 'python' on PATH.
  set "PY_EXE=python"
)

REM 백엔드 시작 (0.0.0.0:65432)
echo [START] Backend -> http://0.0.0.0:65432 (accessible via network IP)
start "KD Backend" cmd /k call "%PY_EXE%" -m uvicorn app:app --host 0.0.0.0 --port 65432 --reload --app-dir "%BACKEND%"

REM 프론트엔드 시작 (Vite: 3333)
echo [START] Frontend -> http://localhost:3333
start "KD Frontend" cmd /k cd /d "%FRONTEND%" ^&^& npm run dev -- --host --port 3333

REM 잠깐 대기 후 브라우저 열기
timeout /t 2 >nul
start "" "http://localhost:3333"

echo [OK] 실행 완료. 두 개의 콘솔 창(Backend, Frontend)이 열려 있어야 합니다.
exit /b 0
