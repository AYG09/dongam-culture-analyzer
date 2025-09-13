// 네트워크 정보를 동적으로 가져오는 유틸리티

let cachedNetworkInfo = null;
let cacheExpiry = 0;
const CACHE_DURATION = 30000; // 30초 캐시
let warnedOnce = false; // 경고 스팸 방지

function isLocalhost(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

// 브라우저 fetch 타임아웃(AbortController 기반)
async function fetchWithTimeout(resource, options = {}) {
  const { timeoutMs = 3000, ...rest } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(resource, { ...rest, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

/**
 * 백엔드에서 현재 네트워크 정보를 가져옴
 */
export async function getNetworkInfo() {
  const now = Date.now();
  
  // 캐시된 정보가 있고 아직 유효한 경우
  if (cachedNetworkInfo && now < cacheExpiry) {
    return cachedNetworkInfo;
  }
  
  try {
    // SSR/테스트 환경 가드
    if (typeof window === 'undefined' || !window.location) {
      throw new Error('No window context - skip network info fetch');
    }

    // 개발 환경에서는 network-info API 호출 생략하고 바로 fallback 사용
    if (isLocalhost(window.location.hostname)) {
      throw new Error('Development environment - skip network info fetch');
    }

    const response = await fetchWithTimeout('/api/network-info', { timeoutMs: 3000 });
    
    if (response.ok) {
      const networkInfo = await response.json();
      
      // 캐시 업데이트
      cachedNetworkInfo = networkInfo;
      cacheExpiry = now + CACHE_DURATION;
      
      return networkInfo;
    }
  } catch (error) {
    if (!warnedOnce) {
      console.warn('Failed to fetch network info, using fallback:', error && error.message ? error.message : String(error));
      warnedOnce = true;
    }
  }
  
  // 실패 시 기본값 반환 (환경에 따라)
  const hostname = (typeof window !== 'undefined' && window.location) ? window.location.hostname : 'localhost';
  const fallback = isLocalhost(hostname)
    ? {
        hostname: 'localhost',
        local_ip: '127.0.0.1',
        network_ip: '127.0.0.1',
        api_url: '/api',
      }
    : {
        hostname,
        local_ip: hostname,
        network_ip: hostname,
        api_url: '/api',
      };
  
  cachedNetworkInfo = fallback;
  cacheExpiry = now + CACHE_DURATION;
  
  return fallback;
}

/**
 * 동적 API URL 가져오기
 */
export async function getApiUrl() {
  const networkInfo = await getNetworkInfo();
  return networkInfo.api_url;
}

/**
 * 네트워크 정보 캐시 초기화
 */
export function clearNetworkCache() {
  cachedNetworkInfo = null;
  cacheExpiry = 0;
}

/**
 * 현재 네트워크 IP가 변경되었는지 확인
 */
export async function checkNetworkChange() {
  const currentTime = Date.now();
  
  // 캐시를 무시하고 새로운 정보 가져오기
  clearNetworkCache();
  const newInfo = await getNetworkInfo();
  
  return newInfo;
}