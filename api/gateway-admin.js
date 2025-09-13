import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  try {
    // 인증 확인
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '인증이 필요합니다.' })
    }

    const token = authHeader.substring(7)
    if (token !== process.env.GATEWAY_ADMIN_PASSWORD) {
      return res.status(403).json({ error: '관리자 권한이 필요합니다.' })
    }

    switch (req.method) {
      case 'GET': {
        // 임시 비밀번호 목록 조회
        const { data, error } = await supabase
          .from('temp_passwords')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50)

        if (error) {
          console.error('임시 비밀번호 조회 오류:', error)
          return res.status(500).json({ error: '데이터베이스 오류가 발생했습니다.' })
        }

        return res.status(200).json({ 
          tempPasswords: data || [],
          total: (data || []).length
        })
      }

      case 'POST': {
        // 새 임시 비밀번호 생성
        const { password, expiresAt, expireHours, description, maxUses } = req.body

        if (!password) {
          return res.status(400).json({ error: '비밀번호를 입력해주세요.' })
        }

        // 만료일 설정 (expireHours 우선, 기본: 24시간 후)
        let expiry
        if (expiresAt) {
          expiry = new Date(expiresAt)
        } else if (expireHours) {
          expiry = new Date(Date.now() + expireHours * 60 * 60 * 1000)
        } else {
          expiry = new Date(Date.now() + 24 * 60 * 60 * 1000)
        }

        const { data, error } = await supabase
          .from('temp_passwords')
          .insert([
            {
              password: password,
              expires_at: expiry.toISOString(),
              is_active: true,
              created_at: new Date().toISOString(),
              description: description || null,
              max_uses: maxUses ? parseInt(maxUses) : null
            }
          ])
          .select()
          .single()

        if (error) {
          console.error('임시 비밀번호 생성 오류:', error)
          return res.status(500).json({ error: '임시 비밀번호 생성에 실패했습니다.' })
        }

        return res.status(201).json({ 
          message: '임시 비밀번호가 생성되었습니다.',
          tempPassword: data
        })
      }

      case 'DELETE': {
        // 임시 비밀번호 삭제
        const { password } = req.query

        if (!password) {
          return res.status(400).json({ error: '삭제할 비밀번호를 지정해주세요.' })
        }

        // 먼저 해당 비밀번호가 존재하는지 확인
        const { data: existingPassword, error: checkError } = await supabase
          .from('temp_passwords')
          .select('id, password')
          .eq('password', password)
          .single()

        if (checkError || !existingPassword) {
          console.error('비밀번호 확인 오류:', checkError)
          return res.status(404).json({ error: '해당 비밀번호를 찾을 수 없습니다.' })
        }

        // 삭제 실행
        const { error: deleteError } = await supabase
          .from('temp_passwords')
          .delete()
          .eq('password', password)

        if (deleteError) {
          console.error('임시 비밀번호 삭제 오류:', deleteError)
          return res.status(500).json({ error: '임시 비밀번호 삭제에 실패했습니다.' })
        }

        return res.status(200).json({ 
          message: `임시 비밀번호 '${password}'가 삭제되었습니다.`
        })
      }

      default: {
        return res.status(405).json({ error: '지원하지 않는 HTTP 메서드입니다.' })
      }
    }

  } catch (error) {
    console.error('Gateway Admin API 오류:', error)
    return res.status(500).json({ 
      error: '서버 내부 오류가 발생했습니다.',
      details: error.message
    })
  }
}
