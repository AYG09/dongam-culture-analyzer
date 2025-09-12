#!/bin/bash
# 경동 조직문화 분석기 - Vercel 배포 스크립트

echo "🚀 경동 조직문화 분석기 - Vercel 배포 시작"

# 환경 변수 확인
if [ -f ".env.local" ]; then
    echo "✅ 환경 변수 파일 확인됨"
else
    echo "⚠️  .env.local 파일이 없습니다. .env.example을 참고하여 생성하세요."
    exit 1
fi

# 프론트엔드 의존성 설치
echo "📦 프론트엔드 의존성 설치 중..."
cd frontend
npm install

# 빌드 테스트
echo "🔨 빌드 테스트 중..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ 빌드 성공"
else
    echo "❌ 빌드 실패"
    exit 1
fi

cd ..

# Vercel CLI 확인
if command -v vercel &> /dev/null; then
    echo "✅ Vercel CLI 확인됨"
else
    echo "📥 Vercel CLI 설치 중..."
    npm install -g vercel
fi

# 배포 실행
echo "🌐 Vercel 배포 중..."
vercel --prod

echo "🎉 배포 완료!"
echo "💡 환경 변수가 설정되지 않았다면 Vercel Dashboard에서 설정해주세요:"
echo "   - SUPABASE_URL"
echo "   - SUPABASE_ANON_KEY" 
echo "   - VITE_SUPABASE_URL"
echo "   - VITE_SUPABASE_ANON_KEY"