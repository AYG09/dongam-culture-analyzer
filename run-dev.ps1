# 경동 조직문화 분석기 - 실행 스크립트 (PowerShell)
$ErrorActionPreference = 'Stop'

$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path
$BACKEND = Join-Path $ROOT 'backend'
$FRONTEND = Join-Path $ROOT 'frontend'

# 선호: 워크스페이스 venv의 python.exe
$pyExe = Join-Path (Join-Path $ROOT '..') '.venv/Scripts/python.exe'
if (-not (Test-Path $pyExe)) {
  Write-Warning "venv Python not found. Falling back to 'python' on PATH."
  $pyExe = 'python'
} else {
  Write-Host "[INFO] Using venv Python: $pyExe"
}

# Backend
Write-Host "[START] Backend -> http://127.0.0.1:8000"
Start-Process -WindowStyle Normal -FilePath "cmd.exe" -ArgumentList "/k","`"$pyExe`" -m uvicorn app:app --host 127.0.0.1 --port 8000 --reload --app-dir `"$BACKEND`""

# Frontend
Write-Host "[START] Frontend -> http://localhost:5176"
Start-Process -WindowStyle Normal -FilePath "cmd.exe" -ArgumentList "/k","cd /d `"$FRONTEND`" && npm run dev"

Start-Sleep -Seconds 2
Start-Process "http://localhost:5176"

Write-Host "[OK] 실행 완료. 두 콘솔 창(Backend, Frontend)이 열립니다."
