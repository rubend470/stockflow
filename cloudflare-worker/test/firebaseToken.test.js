import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { verifyFirebaseToken } from '../src/firebaseToken.js'

const projectId = 'stockflow-749ad'
const fixedNowSeconds = 1_800_000_000
let privateKey
let publicJwk

function encodeBase64Url(value) {
  const bytes = typeof value === 'string'
    ? new TextEncoder().encode(value)
    : new Uint8Array(value)
  return Buffer.from(bytes).toString('base64url')
}

async function createToken({
  kid = 'current-google-key',
  audience = projectId,
  issuerProject = projectId,
  expiresAt = fixedNowSeconds + 3_600,
  issuedAt = fixedNowSeconds - 60,
} = {}) {
  const header = encodeBase64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid }))
  const payload = encodeBase64Url(JSON.stringify({
    aud: audience,
    iss: `https://securetoken.google.com/${issuerProject}`,
    sub: 'synthetic-user',
    exp: expiresAt,
    iat: issuedAt,
  }))
  const signingInput = `${header}.${payload}`
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    new TextEncoder().encode(signingInput),
  )
  return `${signingInput}.${encodeBase64Url(signature)}`
}

function createJwksFetch(responses, calls = []) {
  return async (_url, options) => {
    calls.push(options)
    const keys = responses[Math.min(calls.length - 1, responses.length - 1)]
    return new Response(JSON.stringify({ keys }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

describe('verifyFirebaseToken', () => {
  before(async () => {
    const pair = await crypto.subtle.generateKey(
      {
        name: 'RSASSA-PKCS1-v1_5',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256',
      },
      true,
      ['sign', 'verify'],
    )
    privateKey = pair.privateKey
    publicJwk = await crypto.subtle.exportKey('jwk', pair.publicKey)
    publicJwk.kid = 'current-google-key'
    publicJwk.alg = 'RS256'
    publicJwk.use = 'sig'
  })

  it('reproduces the old array lookup and accepts a valid token with kid search', async () => {
    const jwks = { keys: [publicJwk] }
    assert.equal(jwks['current-google-key'], undefined)
    assert.equal(jwks.keys.find((key) => key.kid === 'current-google-key'), publicJwk)

    const token = await createToken()
    await assert.doesNotReject(() => verifyFirebaseToken(
      token,
      projectId,
      {
        fetchImpl: createJwksFetch([[publicJwk]]),
        now: () => fixedNowSeconds * 1_000,
      },
    ))
  })

  it('rejects an expired token', async () => {
    const token = await createToken({ expiresAt: fixedNowSeconds - 1 })
    await assert.rejects(
      verifyFirebaseToken(token, projectId, {
        fetchImpl: createJwksFetch([[publicJwk]]),
        now: () => fixedNowSeconds * 1_000,
      }),
      /Sesión inválida o vencida/,
    )
  })

  it('rejects a token issued for another Firebase project', async () => {
    const token = await createToken({ audience: 'other-project', issuerProject: 'other-project' })
    await assert.rejects(
      verifyFirebaseToken(token, projectId, {
        fetchImpl: createJwksFetch([[publicJwk]]),
        now: () => fixedNowSeconds * 1_000,
      }),
      /Sesión inválida o vencida/,
    )
  })

  it('rejects an unknown signing key after an uncached refresh', async () => {
    const token = await createToken({ kid: 'unknown-key' })
    const calls = []
    await assert.rejects(
      verifyFirebaseToken(token, projectId, {
        fetchImpl: createJwksFetch([[publicJwk], [publicJwk]], calls),
        now: () => fixedNowSeconds * 1_000,
      }),
      /Certificado de autenticación desconocido/,
    )
    assert.equal(calls.length, 2)
    assert.equal(calls[1].cache, 'no-store')
    assert.equal(calls[1].cf.cacheTtl, 0)
  })

  it('accepts a rotated key after bypassing a stale cached JWKS response', async () => {
    const token = await createToken()
    const calls = []
    await assert.doesNotReject(() => verifyFirebaseToken(token, projectId, {
      fetchImpl: createJwksFetch([[{ ...publicJwk, kid: 'old-key' }], [publicJwk]], calls),
      now: () => fixedNowSeconds * 1_000,
    }))
    assert.equal(calls.length, 2)
    assert.equal(calls[1].cache, 'no-store')
  })
})
