경동 조직문화 분석기 - 실행 안내

빠른 실행
- Windows 배치: run-dev.bat (더블클릭)
- PowerShell: run-dev.ps1 (실행 정책 필요 시: PowerShell 관리자 > Set-ExecutionPolicy -Scope CurrentUser RemoteSigned)

동작
1) 백엔드: FastAPI(uvicorn) 127.0.0.1:8000
2) 프런트엔드: Vite dev server 5176 (프록시로 /api → 127.0.0.1:8000)
3) 브라우저 자동 오픈: http://localhost:5176

문제 해결
- 포트 충돌/권한(WinError 10013) 발생 시:
  - 백엔드 포트를 8010 등으로 바꾸고 frontend/vite.config.js의 proxy target도 동일하게 수정하세요.
- 가상환경이 없다면 루트의 .venv 대신 PATH의 python을 사용합니다.
- OCR 관련 패키지는 더 이상 사용하지 않습니다(삭제 예정).

워크숍 운영 모드(추천)
- 목적: 5~10개 조 동시 사용 시 안정성/간편성 향상
- 실행: PowerShell에서 run-prod.ps1
  - 프런트: production build 후, 백엔드에서 정적 제공(StaticFiles)
  - 백엔드: uvicorn 멀티 워커(기본 2개)
  - 접속: http://127.0.0.1:8000 (API와 정적 앱 동시 제공)

아티팩트 저장(선택)
- REST API
  - POST /api/artifacts { content, team?, label?, type?('prompt'|'result') } → { id }
  - GET /api/artifacts → { items: [...] }
  - GET /api/artifacts/{id} → { id, content, ... }
  - DELETE /api/artifacts/{id} → { ok: true }
- 프런트 UI에도 ‘저장’ 버튼 추가됨(프롬프트/결과)
