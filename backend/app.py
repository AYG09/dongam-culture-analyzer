from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import secrets
import hashlib
from modules.prompt_generator import build_prompt, load_spirits, get_spirit_by_id
from modules.artifact_store import save_artifact, list_artifacts, get_artifact, delete_artifact
from modules.session_manager import (
    create_session, get_session, list_sessions, delete_session, increment_participant_count, decrement_participant_count
)
from modules.session_artifact_store import (
    save_session_artifact, list_session_artifacts, get_session_artifact, 
    delete_session_artifact, save_culture_map_data, get_latest_culture_map_data
)
from modules.realtime_sync import (
    lock_field, unlock_field, update_field_value, get_field_updates, cleanup_expired_locks, cleanup_all_stale_locks
)
from pathlib import Path
from fastapi.staticfiles import StaticFiles
import time
from datetime import datetime, timedelta

app = FastAPI(title="동암정신 내재화 성과분석기 API", version="1.6")

# 관리자 계정 설정
ADMIN_PASSWORD = "WINTER09@!"
ADMIN_PASSWORD_HASH = hashlib.sha256(ADMIN_PASSWORD.encode()).hexdigest()

# 간단한 gw_* 토큰 저장소 (온프렘 전용 가벼운 메모리 보관)
_GW_TOKENS: Dict[str, float] = {}
_TEMP_PASSWORDS: set[str] = set()  # 필요 시 사전에 주입하거나 런타임 등록

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class GeneratePromptRequest(BaseModel):
	spiritId: str
	activityName: str
	coreText: Optional[str] = None  # 기본: 핵심 내용 및 느낀 점
	teamLeaderObservation: Optional[str] = None  # 팀장 활동 목격담 추가
	outcomes: Optional[str] = None  # 상세: 목표
	outputs: Optional[str] = None   # 상세: 실행/결과
	factors: Optional[str] = None   # 상세: Enabler/Blocker
	keyLearning: Optional[str] = None  # 상세: 교훈
	# 하위 호환: text가 넘어오면 coreText로 매핑
	text: Optional[str] = None


class SaveArtifactRequest(BaseModel):
	team: Optional[str] = None
	label: Optional[str] = None
	type: Optional[str] = None  # e.g., 'prompt' | 'result'
	content: str


class CreateSessionRequest(BaseModel):
	name: str
	description: Optional[str] = None


class SaveSessionArtifactRequest(BaseModel):
	sessionCode: str
	team: Optional[str] = None
	label: Optional[str] = None
	type: Optional[str] = None
	content: str


class SaveCultureMapRequest(BaseModel):
	sessionCode: str
	notes: List[Dict[str, Any]]
	connections: List[Dict[str, Any]]
	layerState: Dict[str, Any]


class FieldLockRequest(BaseModel):
	sessionCode: str
	fieldId: str
	userId: str


class FieldUpdateRequest(BaseModel):
	sessionCode: str
	fieldId: str
	value: str
	userId: str


class AdminLoginRequest(BaseModel):
	username: str
	password: str

class GatewayAuthRequest(BaseModel):
	password: Optional[str] = None
	tempPassword: Optional[str] = None
	userAgent: Optional[str] = None
	ipAddress: Optional[str] = None


# 업로드/추출 기능은 비활성화되었습니다. 외부 LLM 분석을 위한 사용자 설명 텍스트를 사용하세요.


@app.get("/api/spirits")
def get_spirits():
	return load_spirits()


@app.post("/api/generate-prompt")
def generate_prompt(body: GeneratePromptRequest):
	try:
		spirits = load_spirits()
		spirit = get_spirit_by_id(spirits, body.spiritId)
		if spirit is None:
			raise HTTPException(status_code=404, detail="Unknown spiritId")
		# normalize
		core = (body.coreText or body.text or "").strip()
		if not core:
			raise HTTPException(status_code=400, detail="coreText is required")
		payload = {
			"activityName": body.activityName,
			"coreText": core,
			"teamLeaderObservation": body.teamLeaderObservation,
			"outcomes": body.outcomes,
			"outputs": body.outputs,
			"factors": body.factors,
			"keyLearning": body.keyLearning,
		}
		prompt = build_prompt(payload, spirit)
		return {"prompt": prompt}
	except HTTPException:
		raise
	except Exception as e:
		raise HTTPException(status_code=400, detail=f"Failed to build prompt: {e}")


	@app.post("/api/gateway-auth")
	def gateway_auth(body: GatewayAuthRequest):
		try:
			is_admin = False
			now = time.time()
			expires_at = now + 24 * 3600  # 24h

			# 1) 관리자 비밀번호
			if body.password:
				if hashlib.sha256(body.password.encode()).hexdigest() == ADMIN_PASSWORD_HASH or body.password == ADMIN_PASSWORD:
					is_admin = True
				else:
					# 2) 임시 비밀번호 (온프렘 완화: 임시 저장소 없이도 길이 기준으로 허용)
					if body.tempPassword and len(body.tempPassword) >= 3:
						is_admin = False
					else:
						return {"success": False, "error": "Invalid credentials"}
			else:
				# password 미제공 시 tempPassword만 검사 (온프렘 완화)
				if body.tempPassword and len(body.tempPassword) >= 3:
					is_admin = False
				else:
					return {"success": False, "error": "Invalid credentials"}

			# gw_* 토큰 발급
			token = f"gw_{secrets.token_urlsafe(32)}"
			_GW_TOKENS[token] = expires_at

			return {
				"success": True,
				"sessionToken": token,
				"isAdmin": is_admin,
				"expiresAt": int(expires_at)
			}
		except Exception as e:
			raise HTTPException(status_code=500, detail=f"Gateway auth failed: {e}")


@app.post("/api/artifacts")
def create_artifact(body: SaveArtifactRequest):
	try:
		art = save_artifact(
			content=body.content,
			team=body.team,
			label=body.label,
			type_=body.type,
		)
		return {"id": art["id"]}
	except Exception as e:
		raise HTTPException(status_code=400, detail=f"Failed to save artifact: {e}")


@app.get("/api/artifacts")
def get_artifacts():
	return {"items": list_artifacts()}


@app.get("/api/artifacts/{artifact_id}")
def read_artifact(artifact_id: str):
	art = get_artifact(artifact_id)
	if not art:
		raise HTTPException(status_code=404, detail="artifact not found")
	return art


@app.delete("/api/artifacts/{artifact_id}")
def remove_artifact(artifact_id: str):
	ok = delete_artifact(artifact_id)
	if not ok:
		raise HTTPException(status_code=404, detail="artifact not found")
	return {"ok": True}


# ==============================================================================
# Session Management APIs
# ==============================================================================

@app.post("/api/sessions")
def create_new_session(body: CreateSessionRequest):
	try:
		session = create_session(name=body.name, description=body.description)
		return session
	except Exception as e:
		raise HTTPException(status_code=400, detail=f"Failed to create session: {e}")


@app.get("/api/sessions")
def get_all_sessions():
	return {"sessions": list_sessions()}


@app.get("/api/sessions/{session_code}")
def get_session_info(session_code: str):
	session = get_session(session_code)
	if not session:
		raise HTTPException(status_code=404, detail="Session not found")
	return session


@app.post("/api/sessions/{session_code}/join")
def join_session(session_code: str):
	session = get_session(session_code)
	if not session:
		raise HTTPException(status_code=404, detail="Session not found")
	increment_participant_count(session_code)
	return {"message": "Joined session successfully", "session": session}


@app.post("/api/sessions/{session_code}/leave")
def leave_session(session_code: str):
	session = get_session(session_code)
	if not session:
		raise HTTPException(status_code=404, detail="Session not found")
	
	decrement_participant_count(session_code)
	
	# 참가자가 0명이 되면 세션을 자동으로 정리
	updated_session = get_session(session_code, update_access_time=False)
	if updated_session and updated_session.get("participantCount", 0) <= 0:
		print(f"[INFO] Auto-deleting empty session: {session_code}")
		delete_session(session_code)
		return {"message": "Left session successfully - session deleted (empty)"}
	
	return {"message": "Left session successfully"}


@app.delete("/api/sessions/{session_code}")
def remove_session(session_code: str):
	success = delete_session(session_code)
	if not success:
		raise HTTPException(status_code=404, detail="Session not found")
	return {"ok": True}


@app.post("/api/sessions/cleanup-all")
def cleanup_all_sessions():
	"""모든 세션을 정리하는 관리용 API"""
	try:
		from modules.session_manager import _load_sessions_index, _save_sessions_index
		import shutil
		from pathlib import Path
		
		# 모든 세션 디렉토리 삭제
		sessions_dir = Path(__file__).resolve().parent.parent / "uploads" / "sessions"
		removed_count = 0
		
		idx = _load_sessions_index()
		sessions = idx.get("sessions", [])
		
		for session in sessions:
			session_dir = sessions_dir / session["code"]
			if session_dir.exists():
				try:
					shutil.rmtree(session_dir)
					removed_count += 1
					print(f"[INFO] Removed session directory: {session['code']}")
				except Exception as e:
					print(f"[ERROR] Failed to remove session {session['code']}: {e}")
		
		# 세션 인덱스 파일 초기화
		_save_sessions_index({"sessions": []})
		
		print(f"[INFO] Cleaned up {removed_count} sessions")
		return {"removed": removed_count, "message": f"Cleaned up {removed_count} sessions"}
		
	except Exception as e:
		print(f"[ERROR] Failed to cleanup all sessions: {e}")
		raise HTTPException(status_code=500, detail=f"Failed to cleanup sessions: {e}")


@app.post("/api/sessions/reset-participant-counts")
def reset_participant_counts():
	"""모든 세션의 참가자 수를 0으로 초기화"""
	try:
		from modules.session_manager import _load_sessions_index, _save_sessions_index
		
		idx = _load_sessions_index()
		sessions = idx.get("sessions", [])
		
		updated_count = 0
		for session in sessions:
			if session.get("participantCount", 0) > 0:
				session["participantCount"] = 0
				updated_count += 1
		
		_save_sessions_index(idx)
		
		print(f"[INFO] Reset participant counts for {updated_count} sessions")
		return {"updated": updated_count, "message": f"Reset participant counts for {updated_count} sessions"}
		
	except Exception as e:
		print(f"[ERROR] Failed to reset participant counts: {e}")
		raise HTTPException(status_code=500, detail=f"Failed to reset participant counts: {e}")


# ==============================================================================
# Session-specific Artifact APIs
# ==============================================================================

@app.post("/api/session-artifacts")
def create_session_artifact(body: SaveSessionArtifactRequest):
	try:
		artifact = save_session_artifact(
			session_code=body.sessionCode,
			content=body.content,
			team=body.team,
			label=body.label,
			type_=body.type,
		)
		if not artifact:
			raise HTTPException(status_code=404, detail="Session not found")
		return {"id": artifact["id"]}
	except HTTPException:
		raise
	except Exception as e:
		raise HTTPException(status_code=400, detail=f"Failed to save session artifact: {e}")


@app.get("/api/session-artifacts/{session_code}")
def get_session_artifacts(session_code: str):
	session = get_session(session_code)
	if not session:
		raise HTTPException(status_code=404, detail="Session not found")
	return {"items": list_session_artifacts(session_code)}


@app.get("/api/session-artifacts/{session_code}/{artifact_id}")
def read_session_artifact(session_code: str, artifact_id: str):
	artifact = get_session_artifact(session_code, artifact_id)
	if not artifact:
		raise HTTPException(status_code=404, detail="Artifact not found")
	return artifact


@app.delete("/api/session-artifacts/{session_code}/{artifact_id}")
def remove_session_artifact(session_code: str, artifact_id: str):
	success = delete_session_artifact(session_code, artifact_id)
	if not success:
		raise HTTPException(status_code=404, detail="Artifact not found")
	return {"ok": True}


# ==============================================================================
# Culture Map Data APIs
# ==============================================================================

@app.post("/api/culture-map")
def save_culture_map(body: SaveCultureMapRequest):
	try:
		session = get_session(body.sessionCode)
		if not session:
			raise HTTPException(status_code=404, detail="Session not found")
		
		artifact = save_culture_map_data(
			session_code=body.sessionCode,
			notes=body.notes,
			connections=body.connections,
			layer_state=body.layerState
		)
		
		if not artifact:
			raise HTTPException(status_code=500, detail="Failed to save culture map")
		
		return {"id": artifact["id"], "message": "Culture map saved successfully"}
	except HTTPException:
		raise
	except Exception as e:
		raise HTTPException(status_code=400, detail=f"Failed to save culture map: {e}")


@app.get("/api/culture-map/{session_code}")
def get_culture_map(session_code: str):
	session = get_session(session_code)
	if not session:
		raise HTTPException(status_code=404, detail="Session not found")
	
	culture_map_data = get_latest_culture_map_data(session_code)
	if not culture_map_data:
		return {"notes": [], "connections": [], "layerState": None}
	
	return culture_map_data


# ==============================================================================
# Realtime Sync APIs
# ==============================================================================

@app.post("/api/fields/lock")
def lock_input_field(body: FieldLockRequest):
	try:
		print(f"[DEBUG] Lock request - sessionCode: {body.sessionCode}, fieldId: {body.fieldId}, userId: {body.userId}")
		# 잠금 요청이므로 접근 시간은 업데이트하지 않음
		session = get_session(body.sessionCode, update_access_time=False)
		print(f"[DEBUG] Session lookup result: {session}")
		if not session:
			print(f"[WARNING] Session not found during field lock for code: {body.sessionCode}")
			return {"success": False, "message": "Session not found"}
		
		success = lock_field(body.sessionCode, body.fieldId, body.userId)
		print(f"[DEBUG] Lock field result: {success}")
		return {"success": success, "message": "Field locked" if success else "Field is locked by another user"}
	except Exception as e:
		print(f"[ERROR] Failed to lock field: {e}")
		import traceback
		traceback.print_exc()
		return {"success": False, "message": f"Failed to lock field: {e}"}


@app.post("/api/fields/unlock")
def unlock_input_field(body: FieldLockRequest):
	try:
		print(f"[DEBUG] Unlock request - sessionCode: {body.sessionCode}, fieldId: {body.fieldId}, userId: {body.userId}")
		# 잠금 해제 요청이므로 접근 시간은 업데이트하지 않음
		session = get_session(body.sessionCode, update_access_time=False)
		print(f"[DEBUG] Session lookup result: {session}")
		if not session:
			print(f"[WARNING] Session not found during field unlock for code: {body.sessionCode}")
			return {"success": True, "message": "Field unlocked (session not found)"}
		
		unlock_field(body.sessionCode, body.fieldId, body.userId)
		return {"success": True, "message": "Field unlocked"}
	except Exception as e:
		print(f"[ERROR] Failed to unlock field: {e}")
		import traceback
		traceback.print_exc()
		return {"success": True, "message": f"Unlock attempted despite error: {e}"}


@app.post("/api/fields/update")
def update_input_field(body: FieldUpdateRequest):
	try:
		print(f"[DEBUG] Update request - sessionCode: {body.sessionCode}, fieldId: {body.fieldId}, userId: {body.userId}")
		# 필드 업데이트는 실제 사용자 작업이므로 접근 시간 업데이트
		session = get_session(body.sessionCode, update_access_time=True)
		print(f"[DEBUG] Session lookup result: {session}")
		if not session:
			print(f"[WARNING] Session not found during field update for code: {body.sessionCode}")
			return {"success": False, "message": "Session not found"}
		
		success = update_field_value(body.sessionCode, body.fieldId, body.value, body.userId)
		print(f"[DEBUG] Update field result: {success}")
		return {"success": success, "message": "Field updated" if success else "Field is locked by another user"}
	except Exception as e:
		print(f"[ERROR] Failed to update field: {e}")
		import traceback
		traceback.print_exc()
		return {"success": False, "message": f"Failed to update field: {e}"}


@app.get("/api/fields/{session_code}/updates")
def get_field_updates_api(session_code: str, since: int = 0):
	try:
		# 폴링 요청이므로 접근 시간은 업데이트하지 않음
		session = get_session(session_code, update_access_time=False)
		if not session:
			# 폴링 요청에서 세션을 찾을 수 없는 경우, 빈 응답을 반환하여 클라이언트가 계속 폴링할 수 있도록 함
			print(f"[WARNING] Session {session_code} not found during polling, returning empty response")
			return {"fields": {}, "values": {}, "lastUpdate": since}
		
		# 만료된 잠금들 정리
		cleanup_expired_locks(session_code)
		
		updates = get_field_updates(session_code, since)
		return updates
	except HTTPException:
		# HTTPException은 다시 던짐 (예: 다른 엔드포인트에서 호출된 경우)
		raise
	except Exception as e:
		print(f"[ERROR] Failed to get field updates for session {session_code}: {e}")
		import traceback
		traceback.print_exc()
		# 폴링 요청에서는 500 대신 빈 응답을 반환하여 클라이언트가 계속 시도할 수 있도록 함
		return {"fields": {}, "values": {}, "lastUpdate": since}


@app.post("/api/fields/{session_code}/cleanup")
def cleanup_stale_locks_api(session_code: str):
	try:
		# 정리 요청이므로 접근 시간은 업데이트하지 않음
		session = get_session(session_code, update_access_time=False)
		if not session:
			raise HTTPException(status_code=404, detail="Session not found")
		
		removed_count = cleanup_all_stale_locks(session_code)
		return {"removed": removed_count, "message": f"Cleaned up {removed_count} stale locks"}
	except Exception as e:
		print(f"[ERROR] Failed to cleanup stale locks for session {session_code}: {e}")
		import traceback
		traceback.print_exc()
		raise HTTPException(status_code=400, detail=f"Failed to cleanup stale locks: {e}")


# ==============================================================================
# Admin APIs
# ==============================================================================

@app.post("/api/admin/login")
def admin_login(body: AdminLoginRequest):
	try:
		if body.username != "ADMIN":
			raise HTTPException(status_code=401, detail="Invalid credentials")
		
		# 비밀번호 해시 확인
		password_hash = hashlib.sha256(body.password.encode()).hexdigest()
		if password_hash != ADMIN_PASSWORD_HASH:
			raise HTTPException(status_code=401, detail="Invalid credentials")
		
		# 간단한 토큰 생성 (실제 운영에서는 JWT 등을 사용 권장)
		token = secrets.token_urlsafe(32)
		
		return {
			"token": token,
			"username": "ADMIN",
			"message": "Login successful"
		}
	except HTTPException:
		raise
	except Exception as e:
		raise HTTPException(status_code=500, detail=f"Login failed: {e}")


@app.get("/api/admin/sessions")
def admin_get_all_sessions():
	"""관리자용 모든 세션 조회 (추가 정보 포함)"""
	try:
		sessions = list_sessions()
		# 각 세션에 대한 추가 정보를 포함할 수 있음
		for session in sessions:
			# 세션별 아티팩트 수 등 추가 정보
			try:
				artifacts = list_session_artifacts(session.get("code", ""))
				session["artifactCount"] = len(artifacts)
			except:
				session["artifactCount"] = 0
		
		return {"sessions": sessions}
	except Exception as e:
		raise HTTPException(status_code=500, detail=f"Failed to get sessions: {e}")


@app.delete("/api/admin/sessions/{session_code}")
def admin_delete_session(session_code: str):
	"""관리자용 세션 강제 삭제"""
	try:
		success = delete_session(session_code)
		if not success:
			raise HTTPException(status_code=404, detail="Session not found")
		return {"message": f"Session {session_code} deleted successfully"}
	except HTTPException:
		raise
	except Exception as e:
		raise HTTPException(status_code=500, detail=f"Failed to delete session: {e}")


# ==============================================================================
# Gateway (on-prem parity for Vercel Functions)
# ==============================================================================

def _is_authorized_gateway(bearer: Optional[str]) -> Dict[str, Any]:
	"""Return { allowed: bool, isAdmin: bool, reason?: str }"""
	if not bearer:
		return {"allowed": False, "isAdmin": False, "reason": "missing token"}
	# Admin password direct
	if bearer == ADMIN_PASSWORD:
		return {"allowed": True, "isAdmin": True}
	# Relaxed acceptance: any gw_* token is allowed (non-admin)
	if bearer.startswith("gw_"):
		# Optional: check in-memory tokens and expiry if we want stricter mode
		exp = _GW_TOKENS.get(bearer)
		if exp is None or exp > time.time():
			return {"allowed": True, "isAdmin": False}
		# expired token: still allow (fully relaxed)
		return {"allowed": True, "isAdmin": False}
	return {"allowed": False, "isAdmin": False, "reason": "invalid token"}


@app.get("/api/gateway-admin")
def gateway_admin(request: Request, type: Optional[str] = None):
	try:
		auth = request.headers.get("authorization") or request.headers.get("Authorization")
		bearer = None
		if auth and auth.lower().startswith("bearer "):
			bearer = auth.split(" ", 1)[1].strip()

		verdict = _is_authorized_gateway(bearer)
		if not verdict.get("allowed"):
			raise HTTPException(status_code=403, detail="Forbidden")

		if type == "sessions" or type is None:
			sessions = list_sessions()
			return {"sessions": sessions, "total": len(sessions)}

		# Unknown type - return minimal info
		return {"ok": True}
	except HTTPException:
		raise
	except Exception as e:
		raise HTTPException(status_code=500, detail=f"Gateway admin failed: {e}")


@app.get("/healthz")
def healthz():
	return {"ok": True}

@app.get("/api/network-info")
def get_network_info():
	"""현재 서버의 네트워크 정보를 반환"""
	import socket
	try:
		# 현재 활성화된 IP 주소 가져오기
		hostname = socket.gethostname()
		local_ip = socket.gethostbyname(hostname)
		
		# 더 정확한 네트워크 IP 가져오기 (외부 연결 시뮬레이션)
		with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
			s.connect(("8.8.8.8", 80))
			network_ip = s.getsockname()[0]
		
		return {
			"hostname": hostname,
			"local_ip": local_ip,
			"network_ip": network_ip,
			"api_url": f"http://{network_ip}:65432/api"
		}
	except Exception as e:
		return {
			"hostname": "localhost",
			"local_ip": "127.0.0.1", 
			"network_ip": "127.0.0.1",
			"api_url": "http://127.0.0.1:65432/api",
			"error": str(e)
		}

# Optionally serve built frontend if available (workshop/prod convenience)
try:
	backend_dir = Path(__file__).resolve().parent
	dist_dir = backend_dir.parent / "frontend" / "dist"
	if dist_dir.exists():
		app.mount("/", StaticFiles(directory=str(dist_dir), html=True), name="frontend")
except Exception:
	# static mounting is optional; ignore failures
	pass

