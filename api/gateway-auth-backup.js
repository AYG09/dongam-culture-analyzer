import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { password } = req.body
    const clientIp = req.headers['x-forwarded-for'] || 'unknown'

    if (!password) {
      return res.status(400).json({ 
        success: false, 
        error: '비밀번호를 입력해주세요.' 
      })
    }

    // 관리자 비밀번호 확인
    if (password === process.env.GATEWAY_ADMIN_PASSWORD) {
      return res.status(200).json({
        success: true,
        isAdmin: true,
        sessionToken: generateToken(),
        message: '관리자로 로그인되었습니다.',
        expiresAt: Date.now() + 24 * 60 * 60 * 1000
      })
    }

    // 임시 비밀번호 확인
    const { data, error } = await supabase
      .from('temp_passwords')
      .select('*')
      .eq('password', password)
      .eq('is_active', true)
      .single()

    if (error || !data) {
      return res.status(401).json({
        success: false,
        error: '잘못된 비밀번호입니다.'
      })
    }

    // 만료 확인
    if (new Date() > new Date(data.expires_at)) {
      return res.status(401).json({
        success: false,
        error: '만료된 비밀번호입니다.'
      })
    }

    // 사용 횟수 업데이트
    await supabase
      .from('temp_passwords')
      .update({ 
        used_count: data.used_count + 1,
        last_used_at: new Date().toISOString(),
        last_used_ip: clientIp
      })
      .eq('id', data.id)

    return res.status(200).json({
      success: true,
      isAdmin: false,
      sessionToken: generateToken(),
      message: '임시 비밀번호로 로그인되었습니다.',
      expiresAt: new Date(data.expires_at).getTime()
    })

  } catch (error) {
    console.error('Gateway auth error:', error)
    return res.status(500).json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    })
  }
}

function generateToken() {
  return 'gw_' + Date.now() + '_' + Math.random().toString(36).substring(2)
}
