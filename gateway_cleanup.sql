-- Gateway 테이블 정리 스크립트
-- 중복 정의 제거 및 기존 테이블 활용

-- 1단계: 중복 정의로 인한 오류 방지
-- (기존 temp_passwords 테이블을 사용)

-- 2단계: 필요한 경우에만 컬럼 추가/수정
DO $$
BEGIN
    -- 기존 테이블에 누락된 컬럼이 있으면 추가
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='temp_passwords' AND column_name='metadata') THEN
        ALTER TABLE temp_passwords ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    END IF;
    
    -- password 컬럼이 VARCHAR(50)이면 유지 (기존 데이터 호환성)
    -- 새로운 더 긴 비밀번호가 필요한 경우에만 확장
    
END $$;

-- 3단계: 활성 임시 비밀번호 뷰 생성 (기존 컬럼명 사용)
CREATE OR REPLACE VIEW active_temp_passwords AS
SELECT *
FROM temp_passwords
WHERE is_active = true 
  AND expires_at > NOW();

-- 4단계: 인덱스 생성 (이미 있으면 무시됨)
CREATE INDEX IF NOT EXISTS idx_temp_passwords_password ON temp_passwords(password);
CREATE INDEX IF NOT EXISTS idx_temp_passwords_active ON temp_passwords(is_active, expires_at);
CREATE INDEX IF NOT EXISTS idx_gateway_logs_accessed_at ON gateway_access_logs(accessed_at);
CREATE INDEX IF NOT EXISTS idx_gateway_logs_ip ON gateway_access_logs(ip_address);

-- 5단계: RLS 정책 설정 (기존 테이블용)
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

-- 6단계: 테스트 데이터 확인/추가
INSERT INTO temp_passwords (password, description, expires_at) 
VALUES ('TEST123', '테스트용 비밀번호', NOW() + INTERVAL '24 hours')
ON CONFLICT (password) DO NOTHING;

-- 완료 확인
SELECT 
    'Gateway 시스템 설정 완료!' as message,
    COUNT(*) as temp_password_count
FROM temp_passwords 
WHERE is_active = true;