from __future__ import annotations

import json
import time
import os
from pathlib import Path
from typing import Dict, Any, Optional, List
from .session_manager import get_session_dir

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


def get_field_state_path(session_code: str) -> Optional[Path]:
    """세션의 실시간 필드 상태 파일 경로 반환"""
    session_dir = get_session_dir(session_code)
    if not session_dir:
        return None
    return session_dir / "field_states.json"


def _with_file_lock(func):
    """파일 잠금을 사용하는 데코레이터"""
    def wrapper(state_path: Path, *args, **kwargs):
        max_retries = 3
        base_delay = 0.05  # 50ms
        
        for attempt in range(max_retries):
            try:
                with open(state_path, 'r+' if state_path.exists() else 'w+', encoding='utf-8') as f:
                    # 파일 잠금 시도
                    if HAS_MSVCRT:
                        msvcrt.locking(f.fileno(), msvcrt.LK_NBLCK, 1)
                    elif HAS_FCNTL:
                        fcntl.flock(f.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
                    
                    result = func(f, *args, **kwargs)
                    
                    # 잠금 해제는 파일이 닫힐 때 자동으로 됨
                    return result
                    
            except (IOError, OSError) as e:
                if attempt < max_retries - 1:
                    delay = base_delay * (2 ** attempt)  # 지수 백오프
                    time.sleep(delay)
                    continue
                else:
                    print(f"[ERROR] Failed to acquire file lock after {max_retries} attempts: {e}")
                    raise
            except Exception as e:
                print(f"[ERROR] Unexpected error in file operation: {e}")
                raise
    return wrapper


def load_field_states(session_code: str) -> Dict[str, Any]:
    """세션의 필드 상태 로드 (파일 잠금 사용)"""
    state_path = get_field_state_path(session_code)
    if not state_path:
        return {"fields": {}, "lastUpdate": int(time.time())}
    
    if not state_path.exists():
        # 파일이 없으면 기본값 반환
        return {"fields": {}, "lastUpdate": int(time.time())}
    
    @_with_file_lock
    def _load_from_file(f):
        content = f.read()
        if not content.strip():
            return {"fields": {}, "lastUpdate": int(time.time())}
        return json.loads(content)
    
    try:
        return _load_from_file(state_path)
    except Exception as e:
        print(f"[ERROR] Failed to load field states: {e}")
        return {"fields": {}, "lastUpdate": int(time.time())}


def save_field_states(session_code: str, states: Dict[str, Any]) -> None:
    """세션의 필드 상태 저장 (파일 잠금 사용)"""
    state_path = get_field_state_path(session_code)
    if not state_path:
        return
    
    states["lastUpdate"] = int(time.time())
    
    @_with_file_lock
    def _save_to_file(f, states_data):
        f.seek(0)
        f.truncate()
        json.dump(states_data, f, ensure_ascii=False, indent=2)
        f.flush()
        os.fsync(f.fileno())  # 강제로 디스크에 쓰기
    
    try:
        _save_to_file(state_path, states)
    except Exception as e:
        print(f"[ERROR] Failed to save field states: {e}")


def lock_field(session_code: str, field_id: str, user_id: str) -> bool:
    """필드 잠금 시도 - 경쟁 상태 해결"""
    states = load_field_states(session_code)
    current_time = int(time.time())
    
    # 기존 잠금 확인
    field_state = states["fields"].get(field_id, {})
    current_owner = field_state.get("lockedBy")
    lock_time = field_state.get("lockTime", 0)
    
    print(f"[DEBUG] Lock attempt - Field: {field_id}, User: {user_id}, Current owner: {current_owner}")
    
    # 1. 잠금이 없는 경우
    if not current_owner:
        states["fields"][field_id] = {
            "lockedBy": user_id,
            "lockTime": current_time,
            "isActive": True
        }
        save_field_states(session_code, states)
        print(f"[DEBUG] Lock granted - Field {field_id} locked by {user_id}")
        return True
    
    # 2. 이미 자신이 잠금한 경우 (갱신)
    if current_owner == user_id:
        states["fields"][field_id]["lockTime"] = current_time
        states["fields"][field_id]["isActive"] = True
        save_field_states(session_code, states)
        print(f"[DEBUG] Lock renewed - Field {field_id} by {user_id}")
        return True
    
    # 3. 다른 사용자의 잠금이지만 만료된 경우 (2분으로 단축)
    if current_time - lock_time > 120:  # 2분으로 단축
        states["fields"][field_id] = {
            "lockedBy": user_id,
            "lockTime": current_time,
            "isActive": True
        }
        save_field_states(session_code, states)
        print(f"[DEBUG] Lock expired - Field {field_id} taken by {user_id} from {current_owner}")
        return True
    
    # 4. 다른 사용자가 활성적으로 잠금 중
    print(f"[DEBUG] Lock denied - Field {field_id} locked by {current_owner}")
    return False


def unlock_field(session_code: str, field_id: str, user_id: str) -> None:
    """필드 잠금 해제 - 즉시 제거하고 강제 업데이트"""
    states = load_field_states(session_code)
    
    field_state = states["fields"].get(field_id, {})
    current_owner = field_state.get("lockedBy")
    
    print(f"[DEBUG] Unlock attempt - Field: {field_id}, User: {user_id}, Current owner: {current_owner}")
    
    # 무조건 즉시 제거 (unlock 이벤트 없이)
    if field_id in states["fields"]:
        del states["fields"][field_id]
        print(f"[DEBUG] Immediately removed field lock for {field_id}")
    
    # lastUpdate를 강제로 업데이트하여 클라이언트가 즉시 폴링하도록 함
    states["lastUpdate"] = int(time.time())
    
    save_field_states(session_code, states)
    print(f"[DEBUG] Field {field_id} unlocked by {user_id} - immediate removal")


def update_field_value(session_code: str, field_id: str, value: str, user_id: str) -> bool:
    """필드 값 업데이트"""
    states = load_field_states(session_code)
    
    # 잠금 확인
    field_state = states["fields"].get(field_id, {})
    if field_state.get("lockedBy") == user_id or not field_state.get("isActive"):
        # 값 업데이트
        if "values" not in states:
            states["values"] = {}
        states["values"][field_id] = {
            "value": value,
            "updatedBy": user_id,
            "updateTime": int(time.time())
        }
        save_field_states(session_code, states)
        return True
    
    return False


def get_field_updates(session_code: str, since: int = 0) -> Dict[str, Any]:
    """지정된 시간 이후 업데이트된 필드들 조회 - 단순화된 버전"""
    states = load_field_states(session_code)
    current_time = int(time.time())
    
    print(f"[DEBUG] get_field_updates - session: {session_code}, since: {since}")
    print(f"[DEBUG] Current field states: {states.get('fields', {})}")
    
    result = {
        "fields": states.get("fields", {}),  # 모든 활성 필드 상태 전송
        "values": {},
        "lastUpdate": states.get("lastUpdate", current_time)
    }
    
    # 업데이트된 값들만 전송
    for field_id, value_state in states.get("values", {}).items():
        update_time = value_state.get("updateTime", 0)
        if update_time > since:
            result["values"][field_id] = value_state
    
    # 디버깅을 위한 로깅
    if result["fields"]:
        print(f"[DEBUG] Sending active fields: {list(result['fields'].keys())}")
    else:
        print(f"[DEBUG] No active fields for session {session_code}")
    
    return result


def cleanup_expired_locks(session_code: str) -> None:
    """만료된 잠금들 정리"""
    states = load_field_states(session_code)
    current_time = int(time.time())
    
    fields_to_remove = []
    for field_id, field_state in states.get("fields", {}).items():
        lock_time = field_state.get("lockTime", 0)
        is_active = field_state.get("isActive", False)
        locked_by = field_state.get("lockedBy")
        
        # 만료되었거나 비활성화된 잠금 제거
        if (current_time - lock_time > 300) or (not is_active) or (not locked_by):
            fields_to_remove.append(field_id)
    
    # 만료된 잠금들을 완전히 제거 (unlock_field와 동일한 방식)
    for field_id in fields_to_remove:
        if field_id in states["fields"]:
            del states["fields"][field_id]
    
    if fields_to_remove:
        save_field_states(session_code, states)


def cleanup_all_stale_locks(session_code: str) -> int:
    """모든 비활성 상태 잠금들을 강제로 정리"""
    states = load_field_states(session_code)
    
    fields_to_remove = []
    for field_id, field_state in states.get("fields", {}).items():
        is_active = field_state.get("isActive", False)
        locked_by = field_state.get("lockedBy")
        
        # 비활성이거나 잠금자가 없는 경우 제거
        if not is_active or not locked_by:
            fields_to_remove.append(field_id)
    
    # 모든 스테일 잠금 제거
    for field_id in fields_to_remove:
        if field_id in states["fields"]:
            del states["fields"][field_id]
    
    if fields_to_remove:
        save_field_states(session_code, states)
    
    return len(fields_to_remove)