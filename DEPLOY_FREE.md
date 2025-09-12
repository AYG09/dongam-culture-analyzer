# 🚀 경동 조직문화 분석기 - 무료 클라우드 배포 가이드

완전 무료로 VERCEL + SUPABASE를 활용한 글로벌 웹서비스 배포 방법

---

## 📋 사전 준비사항

- Node.js 18+ 설치
- Git 설치
- GitHub 계정 (Vercel 연동용)

---

## 🗄️ 1단계: Supabase 데이터베이스 설정

### 1.1 Supabase 프로젝트 생성
1. [https://supabase.com](https://supabase.com) 접속 및 회원가입 (무료)
2. `New Project` 클릭
3. 프로젝트 정보 입력:
   - **Name**: `org-culture-analyzer`
   - **Database Password**: 안전한 비밀번호 설정
   - **Region**: `Southeast Asia (Singapore)` 권장

### 1.2 데이터베이스 스키마 생성
1. Supabase 대시보드 → `SQL Editor` 메뉴
2. `supabase_schema.sql` 파일 내용 전체 복사
3. SQL Editor에 붙여넣기 후 `RUN` 버튼 클릭
4. 성공 메시지 확인: `Success. No rows returned`

### 1.3 API 키 확인
1. `Settings` → `API` 메뉴 이동
2. 다음 정보 복사해 두기:
   - **Project URL**: `https://your-project-id.supabase.co`
   - **anon public key**: `eyJhbGciOiJIUzI1NiIs...`

---

## 🌐 2단계: Vercel 배포 설정

### 2.1 GitHub 저장소 연결
```bash
# 프로젝트를 GitHub에 푸시 (아직 안 했다면)
git add .
git commit -m "Ready for Vercel deployment"
git push origin main
```

### 2.2 Vercel 배포
1. [https://vercel.com](https://vercel.com) 접속 및 GitHub 계정으로 로그인
2. `New Project` 클릭
3. GitHub 저장소 선택 → `Import`
4. 프로젝트 설정:
   - **Framework Preset**: `Other`
   - **Root Directory**: `./` (기본값)
   - **Build Command**: `cd frontend && npm install && npm run build`
   - **Output Directory**: `frontend/dist`

### 2.3 환경 변수 설정
배포 과정에서 또는 배포 후 Vercel Dashboard에서:

1. `Settings` → `Environment Variables` 메뉴
2. 다음 변수들 추가:

| Key | Value | Environment |
|-----|-------|-------------|
| `SUPABASE_URL` | `https://your-project-id.supabase.co` | All |
| `SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIs...` | All |
| `VITE_SUPABASE_URL` | `https://your-project-id.supabase.co` | All |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIs...` | All |

3. `Save` 후 `Redeploy` 실행

---

## ✅ 3단계: 배포 확인 및 테스트

### 3.1 기본 기능 테스트
1. Vercel에서 제공된 URL 접속 (예: `https://org-culture-analyzer.vercel.app`)
2. 다음 기능들 순서대로 테스트:
   - 📄 페이지 로딩 확인
   - 🎯 동암정신 선택 가능
   - ✍️ 프롬프트 생성 작동
   - 💾 결과 저장 기능
   - 👥 세션 생성/참가

### 3.2 API 엔드포인트 확인
브라우저에서 다음 URL들 테스트:
- `https://your-app.vercel.app/api/generate-prompt` (GET)
- `https://your-app.vercel.app/api/sessions` (GET)

### 3.3 데이터베이스 확인
Supabase Dashboard → `Table Editor`에서 데이터 생성 확인

---

## 🛠️ 4단계: 커스텀 도메인 연결 (선택)

### 4.1 도메인 구매
- **Namecheap**: ~$10/년
- **Cloudflare**: ~$8/년  
- **AWS Route53**: ~$12/년

### 4.2 Vercel에서 도메인 설정
1. Vercel Dashboard → `Settings` → `Domains`
2. `Add Domain` 클릭
3. 구매한 도메인 입력 (예: `culture-analyzer.com`)
4. DNS 설정 안내에 따라 CNAME 레코드 추가
5. SSL 인증서 자동 발급 완료 대기 (수분~수시간)

---

## 📊 리소스 사용량 및 제한

### 무료 플랜 한계
| 서비스 | 제한 | 예상 사용량 | 여유도 |
|--------|------|-------------|---------|
| **Vercel** | 100GB 대역폭/월 | ~5GB | ✅ 충분 |
| **Vercel** | 1,000 Function 실행/월 | ~300회 | ✅ 충분 |
| **Supabase** | 500MB DB | ~50MB | ✅ 충분 |
| **Supabase** | 2GB 대역폭/월 | ~1GB | ✅ 충분 |

### 성능 예상치
- **동시 사용자**: 50-200명
- **응답 시간**: <1초
- **가용성**: 99.9%
- **데이터 백업**: 자동 (Supabase)

---

## 🔧 유지보수 및 모니터링

### 모니터링 도구
1. **Vercel Analytics**: 사용자 통계
2. **Supabase Dashboard**: DB 상태 모니터링
3. **Vercel Functions**: API 호출 로그

### 정기 점검 사항
- [ ] 월간 리소스 사용량 확인
- [ ] 데이터베이스 크기 모니터링  
- [ ] API 응답 시간 체크
- [ ] 에러 로그 검토

### 백업 전략
- **자동 백업**: Supabase에서 자동 제공
- **코드 백업**: GitHub 저장소
- **환경 설정**: Vercel Dashboard에서 내보내기 가능

---

## 🚨 문제 해결

### 자주 발생하는 문제

**1. "함수 실행 실패" 오류**
```bash
# 해결: 환경 변수 확인
vercel env ls
# 누락된 변수가 있다면 추가
vercel env add SUPABASE_URL
```

**2. "데이터베이스 연결 실패"**
- Supabase 프로젝트 상태 확인
- API 키 정확성 검증
- RLS 정책 설정 확인

**3. "CORS 오류"**
- `vercel.json`의 headers 설정 확인
- API Functions의 CORS 헤더 설정 점검

**4. "빌드 실패"**
```bash
# 로컬에서 빌드 테스트
cd frontend
npm install
npm run build
```

### 지원 채널
- **Vercel**: [Discord Community](https://discord.gg/vercel)
- **Supabase**: [Discord Community](https://discord.supabase.com/)
- **GitHub Issues**: 프로젝트 저장소에서 이슈 등록

---

## 🎉 배포 완료!

성공적으로 배포가 완료되면:
- ✅ 전 세계 어디서나 접속 가능한 웹 애플리케이션
- ✅ 실시간 협업 기능이 포함된 조직문화 분석 도구
- ✅ 확장 가능한 클라우드 아키텍처
- ✅ **완전 무료** 운영 (트래픽 한계 내에서)

**축하합니다! 🎊 이제 로컬 환경에서 글로벌 웹서비스로 성공적으로 전환되었습니다.**