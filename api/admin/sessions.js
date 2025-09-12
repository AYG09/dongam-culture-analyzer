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
    // 인증 확인 (실제로는 JWT 토큰 검증해야 함)
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // 모든 세션 반환 (실제로는 데이터베이스에서 가져와야 함)
    const sessions = [];

    res.status(200).json({ sessions });
  } catch (error) {
    console.error('Admin sessions error:', error);
    res.status(500).json({ error: 'Failed to get sessions' });
  }
}