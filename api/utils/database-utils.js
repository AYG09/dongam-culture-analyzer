// 데이터베이스 테이블 용도 확인 유틸리티
// 실수 방지를 위한 명확한 함수명 사용

export const TablePurpose = {
  // 실제 워크숍 세션 관리
  WORKSHOP_SESSIONS: 'sessions',
  
  // Gateway 로그인 기록
  LOGIN_LOGS: 'gateway_access_logs',
  
  // 임시 비밀번호 관리
  TEMP_PASSWORDS: 'temp_passwords'
};

export const SessionOperations = {
  // 워크숍 세션 조회 (TEST3 등)
  getWorkshopSessions: (supabase) => supabase.from(TablePurpose.WORKSHOP_SESSIONS),
  
  // 로그인 기록 조회
  getLoginLogs: (supabase) => supabase.from(TablePurpose.LOGIN_LOGS),
  
  // 임시 비밀번호 조회
  getTempPasswords: (supabase) => supabase.from(TablePurpose.TEMP_PASSWORDS)
};

export const DataFieldMapping = {
  // 세션 식별자 구분
  WORKSHOP_SESSION_ID: 'code',        // sessions 테이블의 세션 코드 (TEST3)
  LOGIN_SESSION_TOKEN: 'session_token', // gateway_access_logs의 로그인 토큰
  
  // 시간 필드 구분
  SESSION_CREATED: 'created_at',      // 세션 생성 시간
  LOGIN_TIME: 'created_at',           // 로그인 시간
  LAST_ACCESS: 'last_access'          // 세션 최근 접근
};

// 실수 방지용 검증 함수
export function validateTableUsage(operation, expectedTable) {
  const warnings = [];
  
  if (operation.includes('session') && expectedTable !== TablePurpose.WORKSHOP_SESSIONS) {
    warnings.push(`⚠️  세션 관리는 ${TablePurpose.WORKSHOP_SESSIONS} 테이블을 사용하세요!`);
  }
  
  if (operation.includes('login') && expectedTable !== TablePurpose.LOGIN_LOGS) {
    warnings.push(`⚠️  로그인 기록은 ${TablePurpose.LOGIN_LOGS} 테이블을 사용하세요!`);
  }
  
  return warnings;
}