// Vercel + Supabase 환경을 위한 API 클라이언트 수정
import axios from 'axios';

// Vercel 환경에서는 상대 경로 사용
const API_BASE = process.env.NODE_ENV === 'production' 
  ? '/api'  // Vercel Functions
  : 'http://127.0.0.1:65432/api';  // 로컬 개발

const api = axios.create({ baseURL: API_BASE, timeout: 15000 });

// Supabase 실시간 구독을 위한 클라이언트
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

// 기존 API 함수들 (Vercel Functions로 라우팅)
export async function getSpirits() {
  try {
    const { data } = await api.get('/spirits');
    if (data && Array.isArray(data.spirits)) return data;
  } catch (err) {
    console.warn('API spirits fallback to static');
  }
  
  // 정적 파일 폴백
  try {
    const res = await fetch('/baseline/spirits_baseline.json');
    const json = await res.json();
    return { spirits: Array.isArray(json?.spirits) ? json.spirits : [] };
  } catch (e) {
    console.error('getSpirits fallback error', e);
    return { spirits: [] };
  }
}

export async function generatePrompt(payload) {
  const { data } = await api.post('/generate-prompt', payload);
  return data;
}

// 세션 관리 (Supabase 직접 연결)
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

// 아티팩트 관리
export async function saveArtifact({ content, team, label, type, sessionCode }) {
  const body = { content, team, label, type, sessionCode };
  const { data } = await api.post('/artifacts', body);
  return data;
}

export async function listArtifacts(sessionCode) {
  const url = sessionCode ? `/artifacts?session=${sessionCode}` : '/artifacts';
  const { data } = await api.get(url);
  return data;
}

// 실시간 기능 (Supabase Realtime 활용)
export function subscribeToFieldUpdates(sessionCode, callback) {
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

export { supabase };