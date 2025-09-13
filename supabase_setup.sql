-- Gateway Access Logs 테이블 생성
CREATE TABLE IF NOT EXISTS gateway_access_logs (
    id SERIAL PRIMARY KEY,
    ip_address VARCHAR(45) NOT NULL,
    user_agent TEXT,
    password_type VARCHAR(20) NOT NULL CHECK (password_type IN ('admin', 'temp', 'unknown', 'error')),
    password_used VARCHAR(255),
    success BOOLEAN NOT NULL DEFAULT false,
    failure_reason TEXT,
    session_token VARCHAR(255),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_gateway_access_logs_success ON gateway_access_logs(success);
CREATE INDEX IF NOT EXISTS idx_gateway_access_logs_created_at ON gateway_access_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_gateway_access_logs_session_token ON gateway_access_logs(session_token);
CREATE INDEX IF NOT EXISTS idx_gateway_access_logs_ip_address ON gateway_access_logs(ip_address);

-- RLS (Row Level Security) 설정 (필요시)
-- ALTER TABLE gateway_access_logs ENABLE ROW LEVEL SECURITY;

-- 테이블에 대한 설명 추가
COMMENT ON TABLE gateway_access_logs IS 'Gateway 로그인 시도 및 세션 관리를 위한 로그 테이블';
COMMENT ON COLUMN gateway_access_logs.password_type IS '비밀번호 유형: admin(관리자), temp(임시), unknown(알수없음), error(오류)';
COMMENT ON COLUMN gateway_access_logs.success IS '로그인 성공 여부';
COMMENT ON COLUMN gateway_access_logs.session_token IS '성공시 생성된 세션 토큰';