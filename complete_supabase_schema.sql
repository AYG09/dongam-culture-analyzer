-- 경동 조직문화 분석기 - Supabase PostgreSQL 스키마 (완전판)
-- 기존 파일 기반 저장소를 클라우드 데이터베이스로 전환

-- 세션 관리 테이블
CREATE TABLE IF NOT EXISTS sessions (
  code VARCHAR(6) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  participant_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_access TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived'))
);

-- 아티팩트 저장 테이블 
CREATE TABLE IF NOT EXISTS artifacts (
  id VARCHAR(32) PRIMARY KEY,
  session_code VARCHAR(6) REFERENCES sessions(code) ON DELETE CASCADE,
  team VARCHAR(100),
  label VARCHAR(255),
  type VARCHAR(50) CHECK (type IN ('prompt', 'result', 'culture_map', 'note')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 실시간 필드 동기화 테이블
CREATE TABLE IF NOT EXISTS field_states (
  id SERIAL PRIMARY KEY,
  session_code VARCHAR(6) REFERENCES sessions(code) ON DELETE CASCADE,
  field_id VARCHAR(100) NOT NULL,
  user_id VARCHAR(100) NOT NULL,
  value TEXT DEFAULT '',
  locked_by VARCHAR(100),
  locked_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(session_code, field_id)
);

-- 컬처맵 데이터 테이블
CREATE TABLE IF NOT EXISTS culture_maps (
  id SERIAL PRIMARY KEY,
  session_code VARCHAR(6) REFERENCES sessions(code) ON DELETE CASCADE,
  notes JSONB DEFAULT '[]',
  connections JSONB DEFAULT '[]',
  layer_state JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 🔥 Gateway 시스템 테이블 (누락된 부분!)
-- 임시 비밀번호 테이블
CREATE TABLE IF NOT EXISTS temp_passwords (
    id SERIAL PRIMARY KEY,
    password VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    created_by VARCHAR(100) DEFAULT 'admin',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_count INTEGER DEFAULT 0,
    max_uses INTEGER DEFAULT NULL,
    is_active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMP WITH TIME ZONE,
    last_used_ip VARCHAR(45),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- 접근 로그 테이블
CREATE TABLE IF NOT EXISTS gateway_access_logs (
    id SERIAL PRIMARY KEY,
    ip_address VARCHAR(45),
    user_agent TEXT,
    password_type VARCHAR(20),
    password_used VARCHAR(50),
    success BOOLEAN NOT NULL,
    failure_reason VARCHAR(100),
    accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    session_token VARCHAR(100),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Gateway 테이블 설정
-- 활성 임시 비밀번호 뷰 생성
CREATE OR REPLACE VIEW active_temp_passwords AS
SELECT *
FROM temp_passwords
WHERE is_active = true 
  AND expires_at > NOW();

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_temp_passwords_password ON temp_passwords(password);
CREATE INDEX IF NOT EXISTS idx_temp_passwords_active ON temp_passwords(is_active, expires_at);
CREATE INDEX IF NOT EXISTS idx_gateway_logs_accessed_at ON gateway_access_logs(accessed_at);
CREATE INDEX IF NOT EXISTS idx_gateway_logs_ip ON gateway_access_logs(ip_address);

-- RLS 정책 설정 (Gateway 테이블용)
ALTER TABLE temp_passwords ENABLE ROW LEVEL SECURITY;
ALTER TABLE gateway_access_logs ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 후 재생성
DROP POLICY IF EXISTS "Enable all access for service role" ON temp_passwords;
DROP POLICY IF EXISTS "Enable all access for service role" ON gateway_access_logs;

-- 서비스 역할 정책 생성 (API 접근 허용)
CREATE POLICY "Enable all access for service role" ON temp_passwords
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all access for service role" ON gateway_access_logs  
    FOR ALL USING (true) WITH CHECK (true);

-- 테스트 데이터 삽입
INSERT INTO temp_passwords (password, description, expires_at) 
VALUES ('TEST123', '테스트용 비밀번호', NOW() + INTERVAL '24 hours')
ON CONFLICT (password) DO NOTHING;

-- 완료 확인
SELECT 
    'Gateway 시스템 설정 완료!' as message,
    COUNT(*) as temp_password_count
FROM temp_passwords 
WHERE is_active = true;