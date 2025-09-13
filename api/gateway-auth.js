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
    const { password, tempPassword } = req.body
    const clientIp = req.headers['x-forwarded-for'] || 'unknown'
    const actualPassword = password || tempPassword

    if (!actualPassword) {
      return res.status(400).json({ 
        success: false, 
        error: '비밀번호를 입력해주세요.' 
      })
    }

    // 관리자 비밀번호 확인
    if (actualPassword === process.env.GATEWAY_ADMIN_PASSWORD) {
      const sessionToken = generateToken()
      
      // TODO: 로그인 기록 저장 (테이블 생성 후 활성화)
      // logAccess(clientIp, req.headers['user-agent'], 'admin', actualPassword, true, null, sessionToken).catch(err => {
      //   console.error('Admin login log failed:', err)
      // })
      
      return res.status(200).json({
        success: true,
        isAdmin: true,
        sessionToken,
        message: '관리자로 로그인되었습니다.'
      })
    }

    // 임시 비밀번호 확인
    const { data, error } = await supabase
      .from('temp_passwords')
      .select('*')
      .eq('password', actualPassword)
      .eq('is_active', true)
      .single()

    if (error || !data) {
      // TODO: 로그인 기록 저장 (테이블 생성 후 활성화)
      // logAccess(clientIp, req.headers['user-agent'], 'unknown', actualPassword, false, '잘못된 비밀번호', null).catch(err => {
      //   console.error('Unknown password log failed:', err)
      // })
      return res.status(401).json({
        success: false,
        error: '잘못된 비밀번호입니다.'
      })
    }

    // 만료 확인
    if (new Date() > new Date(data.expires_at)) {
      // TODO: 로그인 기록 저장 (테이블 생성 후 활성화)
      // logAccess(clientIp, req.headers['user-agent'], 'temp', actualPassword, false, '만료된 비밀번호', null).catch(err => {
      //   console.error('Expired password log failed:', err)
      // })
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

    const sessionToken = generateToken()
    
    // TODO: 로그인 기록 저장 (테이블 생성 후 활성화)
    // logAccess(clientIp, req.headers['user-agent'], 'temp', actualPassword, true, null, sessionToken).catch(err => {
    //   console.error('Temp password login log failed:', err)
    // })

    return res.status(200).json({
      success: true,
      isAdmin: false,
      sessionToken,
      message: '임시 비밀번호로 로그인되었습니다.',
      expiresAt: new Date(data.expires_at).getTime()
    })

  } catch (error) {
    console.error('Gateway auth error:', error)
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      actualPassword,
      clientIp,
      envCheck: {
        hasSupabaseUrl: !!process.env.SUPABASE_URL,
        hasSupabaseKey: !!process.env.SUPABASE_ANON_KEY,
        hasAdminPassword: !!process.env.GATEWAY_ADMIN_PASSWORD
      }
    })
    // TODO: 로그인 기록 저장 (테이블 생성 후 활성화)
    // logAccess(clientIp, req.headers['user-agent'], 'error', actualPassword || 'unknown', false, error.message, null).catch(err => {
    //   console.error('Error log failed:', err)
    // })
    return res.status(500).json({
      success: false,
      error: '서버 오류가 발생했습니다.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
}

function generateToken() {
  return 'gw_' + Date.now() + '_' + Math.random().toString(36).substring(2)
}

// 접근 로그 저장 함수
async function logAccess(ipAddress, userAgent, passwordType, passwordUsed, success, failureReason, sessionToken) {
  try {
    // 테이블이 존재하는지 먼저 확인하고 없으면 생성
    const { data, error } = await supabase
      .from('gateway_access_logs')
      .insert({
        ip_address: ipAddress,
        user_agent: userAgent,
        password_type: passwordType,
        password_used: passwordUsed,
        success: success,
        failure_reason: failureReason,
        session_token: sessionToken,
        created_at: new Date().toISOString(),
        metadata: {}
      })
    
    if (error) {
      console.error('Failed to log access:', error)
      // 테이블이 없는 경우 생성 시도
      if (error.code === '42P01') { // relation does not exist
        console.log('gateway_access_logs 테이블이 없습니다. 테이블 생성이 필요합니다.')
      }
    }
  } catch (error) {
    console.error('Failed to log access (catch):', error)
  }
}
