import crypto from 'crypto';

// 관리자 비밀번호 (실제로는 환경 변수로 관리해야 함)
const ADMIN_PASSWORD = "WINTER09@!";
const ADMIN_PASSWORD_HASH = crypto.createHash('sha256').update(ADMIN_PASSWORD).digest('hex');

export default async function handler(req, res) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password required' });
    }

    // 비밀번호 해시 생성 및 비교
    const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
    
    if (passwordHash !== ADMIN_PASSWORD_HASH) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    // 로그인 성공
    const response = {
      message: 'Login successful',
      token: 'admin-token', // 실제로는 JWT 토큰 생성해야 함
      username: 'ADMIN'
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
}