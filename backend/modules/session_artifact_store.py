from __future__ import annotations

import json
import time
import uuid
from pathlib import Path
from typing import Dict, Any, List, Optional
from .session_manager import get_session_dir


def _get_session_store_dir(session_code: str) -> Optional[Path]:
    """세션별 artifact 저장 디렉토리 반환"""
    session_dir = get_session_dir(session_code)
    if not session_dir:
        return None
    
    store_dir = session_dir / "artifacts"
    store_dir.mkdir(exist_ok=True)
    return store_dir


def _session_index_path(session_code: str) -> Optional[Path]:
    """세션별 artifact 인덱스 파일 경로"""
    store_dir = _get_session_store_dir(session_code)
    if not store_dir:
        return None
    return store_dir / "index.json"


def _load_session_index(session_code: str) -> Dict[str, Any]:
    """세션별 artifact 인덱스 로드"""
    p = _session_index_path(session_code)
    if not p or not p.exists():
        return {"items": []}
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return {"items": []}


def _save_session_index(session_code: str, data: Dict[str, Any]) -> None:
    """세션별 artifact 인덱스 저장"""
    p = _session_index_path(session_code)
    if not p:
        return
    p.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def save_session_artifact(*, session_code: str, content: str, team: Optional[str], 
                         label: Optional[str], type_: Optional[str]) -> Optional[Dict[str, Any]]:
    """세션별 artifact 저장"""
    store_dir = _get_session_store_dir(session_code)
    if not store_dir:
        return None
    
    now = int(time.time())
    art_id = uuid.uuid4().hex[:10]
    filename = f"{now}_{art_id}.txt"
    file_path = store_dir / filename
    file_path.write_text(content, encoding="utf-8")

    meta = {
        "id": art_id,
        "sessionCode": session_code,
        "team": team or None,
        "label": label or None,
        "type": type_ or None,
        "filename": filename,
        "size": len(content.encode("utf-8")),
        "createdAt": now,
    }

    idx = _load_session_index(session_code)
    idx_items: List[Dict[str, Any]] = idx.get("items", [])
    idx_items.append(meta)
    idx["items"] = idx_items[-1000:]  # keep last 1000
    _save_session_index(session_code, idx)
    return meta


def list_session_artifacts(session_code: str) -> List[Dict[str, Any]]:
    """세션별 artifact 목록 조회"""
    idx = _load_session_index(session_code)
    items: List[Dict[str, Any]] = idx.get("items", [])
    # newest first
    return sorted(items, key=lambda x: x.get("createdAt", 0), reverse=True)


def get_session_artifact(session_code: str, artifact_id: str) -> Optional[Dict[str, Any]]:
    """세션별 artifact 조회"""
    store_dir = _get_session_store_dir(session_code)
    if not store_dir:
        return None
    
    items = list_session_artifacts(session_code)
    for it in items:
        if it.get("id") == artifact_id:
            p = store_dir / it["filename"]
            content = p.read_text(encoding="utf-8") if p.exists() else ""
            out = dict(it)
            out["content"] = content
            return out
    return None


def delete_session_artifact(session_code: str, artifact_id: str) -> bool:
    """세션별 artifact 삭제"""
    store_dir = _get_session_store_dir(session_code)
    if not store_dir:
        return False
    
    idx = _load_session_index(session_code)
    items: List[Dict[str, Any]] = idx.get("items", [])
    kept: List[Dict[str, Any]] = []
    deleted = False
    
    for it in items:
        if it.get("id") == artifact_id:
            p = store_dir / it.get("filename", "")
            try:
                if p.exists():
                    p.unlink()
            except Exception:
                pass
            deleted = True
            continue
        kept.append(it)
    
    if deleted:
        idx["items"] = kept
        _save_session_index(session_code, idx)
    
    return deleted


def save_culture_map_data(session_code: str, *, notes: List[Dict], connections: List[Dict], 
                         layer_state: Dict) -> Optional[Dict[str, Any]]:
    """컬처맵 데이터를 세션별로 저장"""
    culture_map_data = {
        "notes": notes,
        "connections": connections,
        "layerState": layer_state,
        "timestamp": int(time.time())
    }
    
    content = json.dumps(culture_map_data, ensure_ascii=False, indent=2)
    return save_session_artifact(
        session_code=session_code,
        content=content,
        team=None,
        label="Culture Map Data",
        type_="culture_map"
    )


def get_latest_culture_map_data(session_code: str) -> Optional[Dict[str, Any]]:
    """세션의 최신 컬처맵 데이터 조회"""
    artifacts = list_session_artifacts(session_code)
    
    # culture_map 타입의 가장 최신 artifact 찾기
    for artifact in artifacts:
        if artifact.get("type") == "culture_map":
            full_artifact = get_session_artifact(session_code, artifact["id"])
            if full_artifact and full_artifact.get("content"):
                try:
                    return json.loads(full_artifact["content"])
                except Exception:
                    continue
    
    return None