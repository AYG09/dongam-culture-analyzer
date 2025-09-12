from __future__ import annotations

import json
import time
import uuid
import random
import string
import os
from pathlib import Path
from typing import Dict, Any, List, Optional

# Windows file locking
try:
    import msvcrt
    HAS_MSVCRT = True
except ImportError:
    HAS_MSVCRT = False
    try:
        import fcntl
        HAS_FCNTL = True
    except ImportError:
        HAS_FCNTL = False


BASE_DIR = Path(__file__).resolve().parent.parent  # backend/
SESSIONS_DIR = BASE_DIR.parent / "uploads" / "sessions"  # project/uploads/sessions
SESSIONS_DIR.mkdir(parents=True, exist_ok=True)


def _sessions_index_path() -> Path:
    return SESSIONS_DIR / "sessions_index.json"


def _load_sessions_index() -> Dict[str, Any]:
    p = _sessions_index_path()
    if not p.exists():
        return {"sessions": []}
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return {"sessions": []}


def _save_sessions_index(data: Dict[str, Any]) -> None:
    p = _sessions_index_path()
    p.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def generate_session_code() -> str:
    """6자리 대문자 + 숫자 세션 코드 생성"""
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))


def create_session(*, name: str, description: Optional[str] = None) -> Dict[str, Any]:
    """새 세션 생성"""
    now = int(time.time())
    session_code = generate_session_code()
    
    # 중복 코드 방지
    existing_sessions = list_sessions()
    existing_codes = {s["code"] for s in existing_sessions}
    while session_code in existing_codes:
        session_code = generate_session_code()
    
    # 세션 디렉토리 생성
    session_dir = SESSIONS_DIR / session_code
    session_dir.mkdir(exist_ok=True)
    
    session_data = {
        "code": session_code,
        "name": name,
        "description": description or "",
        "createdAt": now,
        "lastAccessedAt": now,
        "participantCount": 1
    }
    
    # 세션 메타데이터 저장
    session_meta_path = session_dir / "session_meta.json"
    session_meta_path.write_text(
        json.dumps(session_data, ensure_ascii=False, indent=2), 
        encoding="utf-8"
    )
    
    # 전역 세션 인덱스에 추가
    idx = _load_sessions_index()
    sessions_list: List[Dict[str, Any]] = idx.get("sessions", [])
    sessions_list.append(session_data)
    idx["sessions"] = sessions_list
    _save_sessions_index(idx)
    
    return session_data


def _with_session_file_lock(func):
    """세션 파일 잠금을 사용하는 데코레이터"""
    def wrapper(file_path: Path, *args, **kwargs):
        max_retries = 3
        base_delay = 0.05  # 50ms
        
        for attempt in range(max_retries):
            try:
                with open(file_path, 'r+' if file_path.exists() else 'w+', encoding='utf-8') as f:
                    # 파일 잠금 시도
                    if HAS_MSVCRT:
                        msvcrt.locking(f.fileno(), msvcrt.LK_NBLCK, 1)
                    elif HAS_FCNTL:
                        fcntl.flock(f.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
                    
                    result = func(f, *args, **kwargs)
                    return result
                    
            except (IOError, OSError) as e:
                if attempt < max_retries - 1:
                    delay = base_delay * (2 ** attempt)  # 지수 백오프
                    time.sleep(delay)
                    continue
                else:
                    print(f"[ERROR] Failed to acquire session file lock after {max_retries} attempts: {e}")
                    raise
            except Exception as e:
                print(f"[ERROR] Unexpected error in session file operation: {e}")
                raise
    return wrapper


def get_session(session_code: str, update_access_time: bool = True) -> Optional[Dict[str, Any]]:
    """세션 정보 조회 (파일 잠금 사용)"""
    session_dir = SESSIONS_DIR / session_code
    
    if not session_dir.exists():
        return None
    
    session_meta_path = session_dir / "session_meta.json"
    if not session_meta_path.exists():
        return None
    
    @_with_session_file_lock
    def _read_session_data(f, update_time=False):
        content = f.read()
        if not content.strip():
            return None
        
        session_data = json.loads(content)
        
        if update_time:
            session_data["lastAccessedAt"] = int(time.time())
            f.seek(0)
            f.truncate()
            json.dump(session_data, f, ensure_ascii=False, indent=2)
            f.flush()
            os.fsync(f.fileno())
        
        return session_data
    
    try:
        return _read_session_data(session_meta_path, update_access_time)
    except Exception as e:
        print(f"[ERROR] Failed to read session {session_code}: {e}")
        return None


def cleanup_empty_sessions() -> int:
    """참가자가 0명인 세션들을 정리"""
    idx = _load_sessions_index()
    sessions: List[Dict[str, Any]] = idx.get("sessions", [])
    
    removed_count = 0
    active_sessions = []
    
    for session in sessions:
        participant_count = session.get("participantCount", 0)
        if participant_count <= 0:
            # 세션 디렉토리 삭제
            session_dir = SESSIONS_DIR / session["code"]
            try:
                if session_dir.exists():
                    import shutil
                    shutil.rmtree(session_dir)
                print(f"[INFO] Cleaned up empty session: {session['code']} ({session['name']})")
                removed_count += 1
            except Exception as e:
                print(f"[ERROR] Failed to remove session directory {session['code']}: {e}")
        else:
            active_sessions.append(session)
    
    # 업데이트된 세션 목록 저장
    if removed_count > 0:
        idx["sessions"] = active_sessions
        _save_sessions_index(idx)
        print(f"[INFO] Removed {removed_count} empty sessions")
    
    return removed_count


def list_sessions() -> List[Dict[str, Any]]:
    """활성 세션 목록 조회 (빈 세션 정리 후 참가자가 1명 이상인 세션만)"""
    # 먼저 빈 세션들 정리
    cleanup_empty_sessions()
    
    idx = _load_sessions_index()
    sessions: List[Dict[str, Any]] = idx.get("sessions", [])
    # 참가자가 1명 이상인 활성 세션만 필터링
    active_sessions = [s for s in sessions if s.get("participantCount", 0) >= 1]
    # 최근 생성순으로 정렬
    return sorted(active_sessions, key=lambda x: x.get("createdAt", 0), reverse=True)


def delete_session(session_code: str) -> bool:
    """세션 삭제"""
    session_dir = SESSIONS_DIR / session_code
    if not session_dir.exists():
        return False
    
    try:
        # 세션 디렉토리 및 모든 파일 삭제
        import shutil
        shutil.rmtree(session_dir)
        
        # 전역 인덱스에서 제거
        idx = _load_sessions_index()
        sessions_list: List[Dict[str, Any]] = idx.get("sessions", [])
        sessions_list = [s for s in sessions_list if s.get("code") != session_code]
        idx["sessions"] = sessions_list
        _save_sessions_index(idx)
        
        return True
    except Exception:
        return False


def get_session_dir(session_code: str) -> Optional[Path]:
    """세션별 데이터 디렉토리 경로 반환"""
    session_dir = SESSIONS_DIR / session_code
    if session_dir.exists():
        return session_dir
    return None


def increment_participant_count(session_code: str) -> None:
    """세션 참가자 수 증가 (파일 잠금 사용)"""
    session_dir = SESSIONS_DIR / session_code
    if not session_dir.exists():
        return
    
    session_meta_path = session_dir / "session_meta.json"
    if not session_meta_path.exists():
        return
    
    @_with_session_file_lock
    def _increment_count(f):
        content = f.read()
        if not content.strip():
            return None
        
        session_data = json.loads(content)
        session_data["participantCount"] = session_data.get("participantCount", 0) + 1
        session_data["lastAccessedAt"] = int(time.time())
        
        f.seek(0)
        f.truncate()
        json.dump(session_data, f, ensure_ascii=False, indent=2)
        f.flush()
        os.fsync(f.fileno())
        
        return session_data
    
    try:
        session_data = _increment_count(session_meta_path)
        if session_data:
            # 전역 인덱스도 업데이트
            idx = _load_sessions_index()
            sessions_list: List[Dict[str, Any]] = idx.get("sessions", [])
            for i, s in enumerate(sessions_list):
                if s.get("code") == session_code:
                    sessions_list[i] = session_data
                    break
            idx["sessions"] = sessions_list
            _save_sessions_index(idx)
    except Exception as e:
        print(f"[ERROR] Failed to increment participant count: {e}")


def decrement_participant_count(session_code: str) -> None:
    """세션 참가자 수 감소 (파일 잠금 사용)"""
    session_dir = SESSIONS_DIR / session_code
    if not session_dir.exists():
        return
    
    session_meta_path = session_dir / "session_meta.json"
    if not session_meta_path.exists():
        return
    
    @_with_session_file_lock
    def _decrement_count(f):
        content = f.read()
        if not content.strip():
            return None
        
        session_data = json.loads(content)
        current_count = session_data.get("participantCount", 0)
        session_data["participantCount"] = max(0, current_count - 1)  # 0 미만으로 가지 않도록
        session_data["lastAccessedAt"] = int(time.time())
        
        f.seek(0)
        f.truncate()
        json.dump(session_data, f, ensure_ascii=False, indent=2)
        f.flush()
        os.fsync(f.fileno())
        
        return session_data
    
    try:
        session_data = _decrement_count(session_meta_path)
        if session_data:
            # 전역 인덱스도 업데이트
            idx = _load_sessions_index()
            sessions_list: List[Dict[str, Any]] = idx.get("sessions", [])
            for i, s in enumerate(sessions_list):
                if s.get("code") == session_code:
                    sessions_list[i] = session_data
                    break
            idx["sessions"] = sessions_list
            _save_sessions_index(idx)
    except Exception as e:
        print(f"[ERROR] Failed to decrement participant count: {e}")