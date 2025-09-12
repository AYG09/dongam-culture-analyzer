export default async function handler(req, res) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Vercel 환경에서의 네트워크 정보 반환
    const networkInfo = {
      hostname: req.headers.host || 'vercel-app',
      local_ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown',
      network_ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown',
      api_url: '/api'
    };

    res.status(200).json(networkInfo);
  } catch (error) {
    console.error('Network info error:', error);
    res.status(500).json({ error: 'Failed to get network info' });
  }
}