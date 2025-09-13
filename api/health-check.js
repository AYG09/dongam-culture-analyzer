export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const envCheck = {
      hasSupabaseUrl: !!process.env.SUPABASE_URL,
      hasSupabaseKey: !!process.env.SUPABASE_ANON_KEY,
      hasAdminPassword: !!process.env.GATEWAY_ADMIN_PASSWORD,
      nodeEnv: process.env.NODE_ENV || 'unknown'
    }

    return res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: envCheck
    })
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      error: error.message
    })
  }
}