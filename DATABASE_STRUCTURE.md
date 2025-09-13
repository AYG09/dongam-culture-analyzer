# 데이터베이스 테이블 구조 및 용도

## 🎯 세션 관리 시스템

### `sessions` 테이블 - **메인 세션 데이터**
```sql
CREATE TABLE sessions (
  code VARCHAR(6) PRIMARY KEY,        -- 세션 코드 (TEST3 등)
  name VARCHAR(255) NOT NULL,         -- 세션명
  description TEXT,                   -- 설명
  participant_count INTEGER,          -- 참가자 수
  created_at TIMESTAMP,              -- 생성 시간
  last_access TIMESTAMP,             -- 최근 접근
  status VARCHAR(20)                 -- active/inactive/archived
);
```
**용도**: 실제 워크숍 세션 관리 (TEST3 등의 실제 세션)

### `gateway_access_logs` 테이블 - **로그인 로그**
```sql
CREATE TABLE gateway_access_logs (
  id BIGSERIAL PRIMARY KEY,
  ip_address VARCHAR(45),
  user_agent TEXT,
  password_type VARCHAR(20),          -- admin/temp/unknown/error
  password_used VARCHAR(255),
  success BOOLEAN,
  session_token VARCHAR(255),         -- 로그인 토큰 (세션 코드와 다름!)
  created_at TIMESTAMP
);
```
**용도**: Gateway 인증 시스템의 로그인 기록

## ⚠️ **중요한 구분**
- `sessions.code` ≠ `gateway_access_logs.session_token`
- 세션 관리 = `sessions` 테이블
- 로그인 로그 = `gateway_access_logs` 테이블

## 🔄 API 엔드포인트 매핑
- `GET /gateway-admin?type=sessions` → `sessions` 테이블 조회
- `DELETE /gateway-admin?sessionId=XXX` → `sessions` 테이블에서 삭제
- 로그인 기록 조회는 별도 엔드포인트 필요 시 추가