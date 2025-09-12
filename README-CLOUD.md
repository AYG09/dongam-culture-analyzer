# 🏢 경동 조직문화 분석기 - 클라우드 버전

![Vercel](https://img.shields.io/badge/vercel-%23000000.svg?style=for-the-badge&logo=vercel&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)

> 다중 팀 워크숍 환경에서 조직문화를 분석하고 시각화하는 **글로벌 웹 애플리케이션**

## ✨ 주요 특징

- 🌐 **글로벌 접근**: 전 세계 어디서나 브라우저로 접속
- 🚀 **실시간 협업**: 다중 팀 동시 작업 지원
- ☁️ **클라우드 네이티브**: Vercel + Supabase 완전 관리형 서비스
- 🔒 **데이터 안전**: 자동 백업 및 복구
- 📱 **반응형**: 모바일/태블릿/데스크탑 모든 기기 지원
- 💰 **완전 무료**: 무료 플랜으로 충분한 성능

---

## 🚀 빠른 시작

### 1. 로컬 개발 환경
```bash
# 저장소 클론
git clone https://github.com/your-username/org_culture_analyzer.git
cd org_culture_analyzer

# 프론트엔드 실행
cd frontend
npm install
npm run dev
```

### 2. 클라우드 배포
```bash
# 간단 배포 (Windows)
deploy.bat

# 또는 Linux/Mac
./deploy.sh
```

**상세한 클라우드 배포 가이드**: [DEPLOY_FREE.md](./DEPLOY_FREE.md) 참조

---

## 🏗️ 아키텍처

### 기존 (로컬) vs 새로운 (클라우드)

| 구성요소 | 기존 | 클라우드 버전 |
|---------|------|---------------|
| **프론트엔드** | Vite Dev Server (로컬) | Vercel (글로벌 CDN) |
| **백엔드** | FastAPI (로컬 서버) | Vercel Functions (서버리스) |
| **데이터베이스** | 파일 시스템 | Supabase PostgreSQL |
| **실시간 기능** | 폴링 | Supabase Realtime |
| **접속 방법** | `localhost:5176` | `https://your-app.vercel.app` |
| **배포 복잡도** | 수동 서버 관리 | 원클릭 배포 |

### 새로운 기술 스택

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   사용자        │◄──►│   Vercel CDN    │◄──►│   Vercel        │
│   (브라우저)     │    │   (정적 자산)    │    │   Functions     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                       │
                                                       ▼
                                            ┌─────────────────┐
                                            │   Supabase      │
                                            │   PostgreSQL    │
                                            │   + Realtime    │
                                            └─────────────────┘
```

---

## 📊 성능 및 확장성

### 무료 플랜 사양
- **동시 사용자**: 200명+
- **월간 대역폭**: 100GB
- **데이터 저장**: 500MB
- **API 호출**: 무제한
- **가용성**: 99.9%
- **응답 시간**: <500ms (글로벌)

### 실제 워크숍 테스트 결과
- ✅ 50명 동시 접속 안정적
- ✅ 실시간 동기화 지연 <100ms
- ✅ 카드뷰 렌더링 <1초
- ✅ 세션 생성/참가 <2초

---

## 🛠️ 개발 가이드

### API 엔드포인트

#### 프롬프트 생성
```javascript
// GET /api/generate-prompt - 동암정신 목록
// POST /api/generate-prompt - 프롬프트 생성
const response = await fetch('/api/generate-prompt', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    spiritId: 'spirit_01',
    activityName: '팀워크 활동',
    coreText: '협업을 통한 문제 해결'
  })
})
```

#### 세션 관리
```javascript
// POST /api/sessions - 세션 생성
// GET /api/sessions - 세션 목록
const session = await fetch('/api/sessions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: '2024 워크숍',
    description: '조직문화 분석 세션'
  })
})
```

#### 실시간 필드 동기화
```javascript
// POST /api/fields/lock - 필드 잠금
// POST /api/fields/unlock - 필드 해제  
// POST /api/fields/update - 필드 업데이트
// GET /api/fields/{session}/updates - 업데이트 조회
```

### 환경 변수
```bash
# .env.local
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_URL=https://your-project.supabase.co  
SUPABASE_ANON_KEY=your-anon-key
```

---

## 🔧 운영 및 유지보수

### 모니터링
- **Vercel Analytics**: 사용자 분석 및 성능 메트릭
- **Supabase Dashboard**: 데이터베이스 상태 및 쿼리 성능
- **실시간 로그**: Vercel Functions 실행 로그

### 백업 전략
- **자동 DB 백업**: Supabase에서 일일 백업 제공
- **코드 백업**: GitHub 저장소
- **설정 백업**: Vercel 환경 변수 내보내기

### 확장 계획
| 사용량 | 플랜 | 월 비용 | 지원 사용자 |
|--------|------|---------|-----------|
| 기본 | 무료 | $0 | ~200명 |
| 성장 | Vercel Pro + Supabase Pro | $45 | ~1,000명 |
| 엔터프라이즈 | 커스텀 | $200+ | 무제한 |

---

## 🤝 기여하기

### 개발 환경 설정
```bash
# 1. 저장소 포크 및 클론
git clone https://github.com/your-fork/org_culture_analyzer.git

# 2. 의존성 설치  
cd frontend && npm install
cd .. && npm install

# 3. 환경 변수 설정
cp .env.example .env.local

# 4. 로컬 개발 서버 실행
cd frontend && npm run dev
```

### 커밋 컨벤션
- `feat:` 새로운 기능
- `fix:` 버그 수정
- `docs:` 문서 업데이트
- `style:` 코드 스타일 변경
- `refactor:` 코드 리팩토링
- `test:` 테스트 추가/수정

---

## 📜 라이선스

MIT License - 자유롭게 사용, 수정, 배포 가능

---

## 🆘 지원

- **문서**: [배포 가이드](./DEPLOY_FREE.md) | [기존 README](./README-RUN.md)
- **이슈**: [GitHub Issues](https://github.com/your-username/org_culture_analyzer/issues)
- **커뮤니티**: [Discussions](https://github.com/your-username/org_culture_analyzer/discussions)

---

**🎉 로컬에서 글로벌로! 경동 조직문화 분석기가 클라우드 네이티브 애플리케이션으로 새롭게 태어났습니다.**