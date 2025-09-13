-- Gateway 인증 시스템용 테이블 스키마
-- 기존 Supabase 프로젝트에 추가

-- 임시 비밀번호 테이블
CREATE TABLE IF NOT EXISTS temp_passwords (
    id SERIAL PRIMARY KEY,
    password VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    max_uses INTEGER DEFAULT NULL,
    used_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    last_used_ip VARCHAR(100) DEFAULT NULL
);

-- Gateway 접근 로그 테이블
CREATE TABLE IF NOT EXISTS gateway_access_logs (
    id SERIAL PRIMARY KEY,
    ip_address VARCHAR(100),
    user_agent TEXT,
    password_type VARCHAR(20), -- 'admin' 또는 'temp'
    password_used VARCHAR(100),
    success BOOLEAN NOT NULL,
    failure_reason TEXT,
    session_token VARCHAR(200),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- 활성 임시 비밀번호 뷰 (만료되지 않은 것만)
CREATE OR REPLACE VIEW active_temp_passwords AS
SELECT *
FROM temp_passwords
WHERE is_active = true 
  AND expires_at > NOW();

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_temp_passwords_password ON temp_passwords(password);
CREATE INDEX IF NOT EXISTS idx_temp_passwords_active ON temp_passwords(is_active, expires_at);
CREATE INDEX IF NOT EXISTS idx_gateway_logs_created_at ON gateway_access_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_gateway_logs_ip ON gateway_access_logs(ip_address);

-- 기본 테스트 데이터 삽입
INSERT INTO temp_passwords (password, description, expires_at, max_uses) 
VALUES (
    'TEST123', 
    '기본 테스트 비밀번호', 
    NOW() + INTERVAL '24 hours',
    NULL
) ON CONFLICT (password) DO NOTHING;

-- RLS (Row Level Security) 정책 설정
ALTER TABLE temp_passwords ENABLE ROW LEVEL SECURITY;
ALTER TABLE gateway_access_logs ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 (있을 경우)
DROP POLICY IF EXISTS "Enable read access for all users" ON temp_passwords;
DROP POLICY IF EXISTS "Enable insert access for all users" ON temp_passwords;
DROP POLICY IF EXISTS "Enable update access for all users" ON temp_passwords;
DROP POLICY IF EXISTS "Enable read access for all users" ON gateway_access_logs;
DROP POLICY IF EXISTS "Enable insert access for all users" ON gateway_access_logs;

-- 새 정책 생성
CREATE POLICY "Enable read access for all users" ON temp_passwords
    FOR SELECT USING (true);

CREATE POLICY "Enable insert access for all users" ON temp_passwords
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update access for all users" ON temp_passwords
    FOR UPDATE USING (true);

CREATE POLICY "Enable read access for all users" ON gateway_access_logs
    FOR SELECT USING (true);

CREATE POLICY "Enable insert access for all users" ON gateway_access_logs
    FOR INSERT WITH CHECK (true);

-- 완료 메시지
SELECT 'Gateway 테이블 설치 완료!' as message;