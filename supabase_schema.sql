-- 경동 조직문화 분석기 - Supabase PostgreSQL 스키마
-- 기존 파일 기반 저장소를 클라우드 데이터베이스로 전환

-- =============================================================================
-- 세션 관리 테이블
-- =============================================================================
CREATE TABLE sessions (
  code VARCHAR(6) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  participant_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_access TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived'))
);

-- =============================================================================
-- 아티팩트 저장 테이블 (기존 파일 저장소 대체)
-- =============================================================================
CREATE TABLE artifacts (
  id VARCHAR(32) PRIMARY KEY,
  session_code VARCHAR(6) REFERENCES sessions(code) ON DELETE CASCADE,
  team VARCHAR(100),
  label VARCHAR(255),
  type VARCHAR(50) CHECK (type IN ('prompt', 'result', 'culture_map', 'note')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}', -- 추가 메타데이터용
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- 실시간 필드 동기화 테이블
-- =============================================================================
CREATE TABLE field_states (
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

-- =============================================================================
-- 컬처맵 데이터 테이블 (카드뷰 시각화용)
-- =============================================================================
CREATE TABLE culture_maps (
  id SERIAL PRIMARY KEY,
  session_code VARCHAR(6) REFERENCES sessions(code) ON DELETE CASCADE,
  notes JSONB DEFAULT '[]', -- 카드뷰 노트 데이터
  connections JSONB DEFAULT '[]', -- 연결 관계 데이터
  layer_state JSONB DEFAULT '{}', -- 레이어 상태
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- 성능 최적화 인덱스
-- =============================================================================
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_sessions_created_at ON sessions(created_at DESC);
CREATE INDEX idx_sessions_last_access ON sessions(last_access DESC);

CREATE INDEX idx_artifacts_session_code ON artifacts(session_code);
CREATE INDEX idx_artifacts_type ON artifacts(type);
CREATE INDEX idx_artifacts_created_at ON artifacts(created_at DESC);
CREATE INDEX idx_artifacts_team ON artifacts(team) WHERE team IS NOT NULL;

CREATE INDEX idx_field_states_session_code ON field_states(session_code);
CREATE INDEX idx_field_states_locked_by ON field_states(locked_by) WHERE locked_by IS NOT NULL;
CREATE INDEX idx_field_states_updated_at ON field_states(updated_at DESC);

CREATE INDEX idx_culture_maps_session_code ON culture_maps(session_code);
CREATE INDEX idx_culture_maps_updated_at ON culture_maps(updated_at DESC);

-- =============================================================================
-- 자동 업데이트 트리거
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_artifacts_updated_at BEFORE UPDATE ON artifacts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_culture_maps_updated_at BEFORE UPDATE ON culture_maps
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- Row Level Security (RLS) 설정
-- =============================================================================
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE culture_maps ENABLE ROW LEVEL SECURITY;

-- 워크숍 환경을 위한 공개 정책 (인증 없이 모든 접근 허용)
-- 프로덕션에서는 더 엄격한 정책으로 변경 권장

-- 세션 정책
CREATE POLICY "공개 세션 읽기" ON sessions FOR SELECT USING (true);
CREATE POLICY "공개 세션 생성" ON sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "공개 세션 수정" ON sessions FOR UPDATE USING (true);
CREATE POLICY "공개 세션 삭제" ON sessions FOR DELETE USING (true);

-- 아티팩트 정책
CREATE POLICY "공개 아티팩트 읽기" ON artifacts FOR SELECT USING (true);
CREATE POLICY "공개 아티팩트 생성" ON artifacts FOR INSERT WITH CHECK (true);
CREATE POLICY "공개 아티팩트 수정" ON artifacts FOR UPDATE USING (true);
CREATE POLICY "공개 아티팩트 삭제" ON artifacts FOR DELETE USING (true);

-- 필드 상태 정책
CREATE POLICY "공개 필드 읽기" ON field_states FOR SELECT USING (true);
CREATE POLICY "공개 필드 생성" ON field_states FOR INSERT WITH CHECK (true);
CREATE POLICY "공개 필드 수정" ON field_states FOR UPDATE USING (true);
CREATE POLICY "공개 필드 삭제" ON field_states FOR DELETE USING (true);

-- 컬처맵 정책
CREATE POLICY "공개 컬처맵 읽기" ON culture_maps FOR SELECT USING (true);
CREATE POLICY "공개 컬처맵 생성" ON culture_maps FOR INSERT WITH CHECK (true);
CREATE POLICY "공개 컬처맵 수정" ON culture_maps FOR UPDATE USING (true);
CREATE POLICY "공개 컬처맵 삭제" ON culture_maps FOR DELETE USING (true);

-- =============================================================================
-- 헬스체크 및 통계용 뷰
-- =============================================================================
CREATE VIEW session_stats AS
SELECT 
  COUNT(*) as total_sessions,
  COUNT(*) FILTER (WHERE status = 'active') as active_sessions,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as sessions_today,
  SUM(participant_count) as total_participants
FROM sessions;

CREATE VIEW artifact_stats AS
SELECT 
  COUNT(*) as total_artifacts,
  COUNT(*) FILTER (WHERE type = 'prompt') as prompts,
  COUNT(*) FILTER (WHERE type = 'result') as results,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as artifacts_today
FROM artifacts;

-- =============================================================================
-- 데이터 정리 함수 (선택적)
-- =============================================================================
CREATE OR REPLACE FUNCTION cleanup_old_sessions(days_old INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM sessions 
  WHERE status = 'inactive' 
    AND last_access < NOW() - INTERVAL '1 day' * days_old;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION cleanup_expired_locks()
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE field_states 
  SET locked_by = NULL, locked_at = NULL
  WHERE locked_at < NOW() - INTERVAL '30 seconds';
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 샘플 데이터 (테스트용)
-- =============================================================================
INSERT INTO sessions (code, name, description) VALUES 
  ('TEST01', '테스트 세션', '개발 및 테스트용 세션'),
  ('DEMO02', '데모 세션', '시연용 세션');

-- 초기 설정 완료
-- 다음 단계: Supabase 대시보드에서 이 스키마를 실행하세요.