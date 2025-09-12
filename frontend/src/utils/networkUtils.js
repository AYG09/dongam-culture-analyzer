// 네트워크 정보를 동적으로 가져오는 유틸리티

let cachedNetworkInfo = null;
let cacheExpiry = 0;
const CACHE_DURATION = 30000; // 30초 캐시

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
    // 먼저 localhost로 시도
    const response = await fetch('http://localhost:65432/api/network-info', {
      timeout: 3000
    });
    
    if (response.ok) {
      const networkInfo = await response.json();
      
      // 캐시 업데이트
      cachedNetworkInfo = networkInfo;
      cacheExpiry = now + CACHE_DURATION;
      
      return networkInfo;
    }
  } catch (error) {
    console.warn('Failed to fetch network info from localhost:', error);
  }
  
  // 실패 시 기본값 반환
  const fallback = {
    hostname: 'localhost',
    local_ip: '127.0.0.1',
    network_ip: '127.0.0.1', 
    api_url: 'http://localhost:65432/api'
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