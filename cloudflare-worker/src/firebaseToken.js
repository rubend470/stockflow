export const GOOGLE_JWKS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0))
}

function decodeJwtPart(value) {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(value)))
}

async function fetchGoogleJwks(fetchImpl, bypassCache = false) {
  const response = await fetchImpl(GOOGLE_JWKS_URL, bypassCache
    ? {
        cache: 'no-store',
        cf: { cacheEverything: false, cacheTtl: 0 },
      }
    : {
        cf: { cacheEverything: true, cacheTtl: 3_600 },
      })

  if (!response.ok) throw new Error('No se pudieron validar las credenciales.')

  const jwks = await response.json()
  if (!jwks || !Array.isArray(jwks.keys)) {
    throw new Error('Respuesta de certificados de autenticación inválida.')
  }
  return jwks.keys
}

export async function findGoogleJwk(kid, fetchImpl = fetch) {
  const cachedKeys = await fetchGoogleJwks(fetchImpl)
  const cachedMatch = cachedKeys.find((key) => key?.kid === kid)
  if (cachedMatch) return cachedMatch

  // Google rotates signing keys. Retry outside Cloudflare's cache before rejecting a new kid.
  const refreshedKeys = await fetchGoogleJwks(fetchImpl, true)
  return refreshedKeys.find((key) => key?.kid === kid)
}

export async function verifyFirebaseToken(
  token,
  projectId,
  { fetchImpl = fetch, now = () => Date.now() } = {},
) {
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('Token inválido.')

  const header = decodeJwtPart(parts[0])
  const payload = decodeJwtPart(parts[1])
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') {
    throw new Error('Firma de token inválida.')
  }

  const jwk = await findGoogleJwk(header.kid, fetchImpl)
  if (!jwk) throw new Error('Certificado de autenticación desconocido.')

  const publicKey = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  )
  const validSignature = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    publicKey,
    decodeBase64Url(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
  )

  const currentTime = Math.floor(now() / 1_000)
  const validClaims =
    payload.aud === projectId &&
    payload.iss === `https://securetoken.google.com/${projectId}` &&
    typeof payload.sub === 'string' &&
    payload.sub.length > 0 &&
    typeof payload.exp === 'number' &&
    payload.exp > currentTime &&
    typeof payload.iat === 'number' &&
    payload.iat <= currentTime

  if (!validSignature || !validClaims) throw new Error('Sesión inválida o vencida.')
}
