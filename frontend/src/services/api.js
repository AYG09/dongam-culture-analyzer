import axios from 'axios';
import { createClient } from '@supabase/supabase-js'

// Vercel 환경에서는 상대 경로 사용, 로컬에서는 기존 방식 유지
const API_BASE = '/api';

const api = axios.create({ baseURL: API_BASE, timeout: 15000 });

// Supabase 클라이언트 (실시간 기능용)
const supabase = import.meta.env.VITE_SUPABASE_URL ? createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
) : null;

export async function getSpirits() {
  try {
    // Vercel Functions에서 동암정신 데이터 가져오기
    const { data } = await api.get('/generate-prompt');
    if (data && Array.isArray(data.spirits)) return data;
  } catch (err) {
    console.warn('API spirits failed, using fallback');
  }
  
  // 정적 파일 폴백
  try {
    const res = await fetch('/baseline/spirits_baseline.json', { cache: 'no-store' });
    const json = await res.json();
    return { spirits: Array.isArray(json?.spirits) ? json.spirits : [] };
  } catch (e) {
    console.error('getSpirits fallback error', e);
    return { spirits: [] };
  }
}

export async function generatePrompt(payload) {
  try {
    const { data } = await api.post('/generate-prompt', payload);
    return data;
  } catch (err) {
    console.error('generatePrompt error', err);
    throw err;
  }
}

// 아티팩트 관리 (Vercel Functions + Supabase)
export async function saveArtifact({ content, team, label, type, sessionCode }) {
  const body = { content, team, label, type, sessionCode };
  const { data } = await api.post('/artifacts', body);
  return data; // { id }
}

export async function listArtifacts(sessionCode) {
  const url = sessionCode ? `/artifacts?session=${sessionCode}` : '/artifacts';
  const { data } = await api.get(url);
  return data; // { items: [...] }
}

export async function getArtifact(id) {
  const { data } = await api.get(`/artifacts/${id}`);
  return data; // { id, content, ... }
}

export async function deleteArtifact(id) {
  const { data } = await api.delete(`/artifacts/${id}`);
  return data; // { ok: true }
}

// 세션 관리 (Vercel Functions + Supabase)
export async function createSession({ name, description }) {
  const { data } = await api.post('/sessions', { name, description });
  return data;
}

export async function getSessions() {
  const { data } = await api.get('/sessions');
  return data;
}

export async function getSession(sessionCode) {
  const { data } = await api.get(`/sessions/${sessionCode}`);
  return data;
}

// 실시간 필드 동기화 (Vercel Functions + Supabase)
export async function lockField(sessionCode, fieldId, userId) {
  const { data } = await api.post('/fields/lock', {
    sessionCode, fieldId, userId
  });
  return data;
}

export async function unlockField(sessionCode, fieldId, userId) {
  const { data } = await api.post('/fields/unlock', {
    sessionCode, fieldId, userId
  });
  return data;
}

export async function updateField(sessionCode, fieldId, value, userId) {
  const { data } = await api.post('/fields/update', {
    sessionCode, fieldId, value, userId
  });
  return data;
}

export async function getFieldUpdates(sessionCode, since = 0) {
  const { data } = await api.get(`/fields/${sessionCode}/updates?since=${since}`);
  return data;
}

// Supabase 실시간 구독 (선택적)
export function subscribeToFieldUpdates(sessionCode, callback) {
  if (!supabase) {
    console.warn('Supabase not configured, skipping realtime subscription');
    return null;
  }
  
  return supabase
    .channel(`field_updates_${sessionCode}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'field_states',
      filter: `session_code=eq.${sessionCode}`
    }, callback)
    .subscribe()
}

// Supabase 클라이언트 내보내기 (필요한 경우)
export { supabase };
