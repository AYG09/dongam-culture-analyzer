from __future__ import annotations

import json
import time
import uuid
from pathlib import Path
from typing import Dict, Any, List, Optional


BASE_DIR = Path(__file__).resolve().parent.parent  # backend/
STORE_DIR = BASE_DIR.parent / "uploads" / "workshop"  # project/uploads/workshop
STORE_DIR.mkdir(parents=True, exist_ok=True)


def _index_path() -> Path:
    return STORE_DIR / "index.json"


def _load_index() -> Dict[str, Any]:
    p = _index_path()
    if not p.exists():
        return {"items": []}
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return {"items": []}


def _save_index(data: Dict[str, Any]) -> None:
    p = _index_path()
    p.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def save_artifact(*, content: str, team: Optional[str], label: Optional[str], type_: Optional[str]) -> Dict[str, Any]:
    now = int(time.time())
    art_id = uuid.uuid4().hex[:10]
    filename = f"{now}_{art_id}.txt"
    file_path = STORE_DIR / filename
    file_path.write_text(content, encoding="utf-8")

    meta = {
        "id": art_id,
        "team": team or None,
        "label": label or None,
        "type": type_ or None,
        "filename": filename,
        "size": len(content.encode("utf-8")),
        "createdAt": now,
    }

    idx = _load_index()
    idx_items: List[Dict[str, Any]] = idx.get("items", [])
    idx_items.append(meta)
    idx["items"] = idx_items[-1000:]  # keep last 1000
    _save_index(idx)
    return meta


def list_artifacts() -> List[Dict[str, Any]]:
    idx = _load_index()
    items: List[Dict[str, Any]] = idx.get("items", [])
    # newest first
    return sorted(items, key=lambda x: x.get("createdAt", 0), reverse=True)


def get_artifact(artifact_id: str) -> Optional[Dict[str, Any]]:
    items = list_artifacts()
    for it in items:
        if it.get("id") == artifact_id:
            p = STORE_DIR / it["filename"]
            content = p.read_text(encoding="utf-8") if p.exists() else ""
            out = dict(it)
            out["content"] = content
            return out
    return None


def delete_artifact(artifact_id: str) -> bool:
    idx = _load_index()
    items: List[Dict[str, Any]] = idx.get("items", [])
    kept: List[Dict[str, Any]] = []
    deleted = False
    for it in items:
        if it.get("id") == artifact_id:
            p = STORE_DIR / it.get("filename", "")
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
        _save_index(idx)
    return deleted
