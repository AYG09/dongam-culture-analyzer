# 경동 조직문화 분석기 - 워크숍 운영 모드(Production-like)
$ErrorActionPreference = 'Stop'

$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path
$BACKEND = Join-Path $ROOT 'backend'
$FRONTEND = Join-Path $ROOT 'frontend'

# Prefer venv python if exists at repo root's sibling .venv
$pyExe = Join-Path (Join-Path $ROOT '..') '.venv/Scripts/python.exe'
if (-not (Test-Path $pyExe)) {
  Write-Warning "venv Python not found. Falling back to 'python' on PATH."
  $pyExe = 'python'
} else {
  Write-Host "[INFO] Using venv Python: $pyExe"
}

# 1) Build frontend
Write-Host "[BUILD] Frontend production build"
Push-Location $FRONTEND
try {
  npm run build
} finally {
  Pop-Location
}

# 2) Start backend (multi-workers) serving built frontend statics
# Parameters: -Workers N (default 2), -CacheTtlSeconds M (default 60)
param(
  [int]$Workers = 2,
  [int]$CacheTtlSeconds = 60
)

Write-Host "[START] Backend (multi-workers=$Workers, cacheTTL=$CacheTtlSeconds) -> http://127.0.0.1:8000"

# Pass cache ttl via env var
$env:PROMPT_CACHE_TTL_SECONDS = "$CacheTtlSeconds"

Start-Process -WindowStyle Normal -FilePath "cmd.exe" -ArgumentList "/k","`"$pyExe`" -m uvicorn app:app --host 127.0.0.1 --port 8000 --workers $Workers --app-dir `"$BACKEND`""

Start-Sleep -Seconds 2
Start-Process "http://127.0.0.1:8000"

Write-Host "[OK] 워크숍 모드 실행. 백엔드 한 창으로 운영됩니다. /api는 API, 그 외 경로는 빌드된 프런트를 제공합니다."
