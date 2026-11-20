import { verifyFirebaseToken } from './firebaseToken.js'

const MAX_SIGNING_REQUEST_LENGTH = 100_000

function jsonResponse(body, status, origin, allowedOrigins) {
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    Vary: 'Origin',
  }

  if (allowedOrigins.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin
    headers['Access-Control-Allow-Headers'] = 'Authorization, Content-Type'
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
  }

  return new Response(JSON.stringify(body), { status, headers })
}

function pemToBytes(pem) {
  const base64 = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '')
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0))
}

async function signRequest(dataToSign, privateKeyPem) {
  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    pemToBytes(privateKeyPem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-512' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    new TextEncoder().encode(dataToSign),
  )

  return btoa(String.fromCharCode(...new Uint8Array(signature)))
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || ''
    const allowedOrigins = new Set(
      env.ALLOWED_ORIGINS.split(',').map((value) => value.trim()),
    )

    if (!allowedOrigins.has(origin)) {
      return jsonResponse({ error: 'Origen no autorizado.' }, 403, origin, allowedOrigins)
    }
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Headers': 'Authorization, Content-Type',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          Vary: 'Origin',
        },
      })
    }
    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Método no permitido.' }, 405, origin, allowedOrigins)
    }

    const authorization = request.headers.get('Authorization') || ''
    if (!authorization.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Debes iniciar sesión.' }, 401, origin, allowedOrigins)
    }

    try {
      await verifyFirebaseToken(
        authorization.slice('Bearer '.length),
        env.FIREBASE_PROJECT_ID,
      )

      const body = await request.json()
      const dataToSign = body?.request
      if (
        typeof dataToSign !== 'string' ||
        dataToSign.length === 0 ||
        dataToSign.length > MAX_SIGNING_REQUEST_LENGTH
      ) {
        return jsonResponse({ error: 'Solicitud de firma inválida.' }, 400, origin, allowedOrigins)
      }

      const signature = await signRequest(dataToSign, env.QZ_PRIVATE_KEY)
      return jsonResponse({ signature }, 200, origin, allowedOrigins)
    } catch (error) {
      console.error('QZ signing failed', error)
      return jsonResponse(
        { error: error instanceof Error ? error.message : 'No se pudo firmar la solicitud.' },
        401,
        origin,
        allowedOrigins,
      )
    }
  },
}
