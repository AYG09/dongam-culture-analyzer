@echo off
REM 경동 조직문화 분석기 - Vercel 배포 스크립트 (Windows)

echo 🚀 경동 조직문화 분석기 - Vercel 배포 시작

REM 환경 변수 확인
if exist ".env.local" (
    echo ✅ 환경 변수 파일 확인됨
) else (
    echo ⚠️  .env.local 파일이 없습니다. .env.example을 참고하여 생성하세요.
    pause
    exit /b 1
)

REM 프론트엔드 의존성 설치
echo 📦 프론트엔드 의존성 설치 중...
cd frontend
call npm install

REM 빌드 테스트
echo 🔨 빌드 테스트 중...
call npm run build

if %errorlevel% neq 0 (
    echo ❌ 빌드 실패
    pause
    exit /b 1
)

echo ✅ 빌드 성공
cd ..

REM Vercel CLI 확인 및 설치
where vercel >nul 2>nul
if %errorlevel% neq 0 (
    echo 📥 Vercel CLI 설치 중...
    call npm install -g vercel
) else (
    echo ✅ Vercel CLI 확인됨
)

REM 배포 실행
echo 🌐 Vercel 배포 중...
call vercel --prod

echo 🎉 배포 완료!
echo 💡 환경 변수가 설정되지 않았다면 Vercel Dashboard에서 설정해주세요:
echo    - SUPABASE_URL
echo    - SUPABASE_ANON_KEY
echo    - VITE_SUPABASE_URL
echo    - VITE_SUPABASE_ANON_KEY

pause