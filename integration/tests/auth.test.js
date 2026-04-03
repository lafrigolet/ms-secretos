import { describe, test, before } from 'node:test'
import assert from 'node:assert/strict'
import { login, get, post, PORTS } from '../helpers/client.js'

const P = PORTS.auth

describe('auth-service — integration', () => {
  let token

  before(async () => {
    token = await login('SDA-00423', 'demo1234')
  })

  // ── Health ─────────────────────────────────────────────────────
  describe('GET /health', () => {
    test('returns 200 with status ok', async () => {
      const { status, body } = await get(P, '/health')
      assert.equal(status, 200)
      assert.equal(body.status, 'ok')
      assert.equal(body.service, 'sda-auth-service')
      assert.ok(body.uptime >= 0)
      assert.ok(body.timestamp)
    })
  })

  // ── HU-01 — Login ─────────────────────────────────────────────
  describe('POST /auth/login', () => {
    test('correct credentials return token + customer', async () => {
      const { status, body } = await post(P, '/auth/login', { body: { sapCode: 'SDA-00423', password: 'demo1234' } })
      assert.equal(status, 200)
      assert.ok(body.token)
      assert.ok(body.expiresIn)
      assert.equal(body.customer.sapCode, 'SDA-00423')
      assert.equal(body.customer.profile, 'PREMIUM')
      assert.equal(body.customer.role, 'CUSTOMER')
      assert.equal(body.customer.password, undefined)
    })

    test('VIP login returns profile VIP', async () => {
      const { status, body } = await post(P, '/auth/login', { body: { sapCode: 'SDA-00521', password: 'demo1234' } })
      assert.equal(status, 200)
      assert.equal(body.customer.profile, 'VIP')
    })

    test('admin login returns role ADMIN', async () => {
      const { status, body } = await post(P, '/auth/login', { body: { sapCode: 'ADMIN-001', password: 'admin1234' } })
      assert.equal(status, 200)
      assert.equal(body.customer.role, 'ADMIN')
    })

    test('wrong password returns 401 INVALID_CREDENTIALS', async () => {
      const { status, body } = await post(P, '/auth/login', { body: { sapCode: 'SDA-00423', password: 'wrong' } })
      assert.equal(status, 401)
      assert.equal(body.error, 'INVALID_CREDENTIALS')
    })

    test('unknown sapCode returns 401', async () => {
      const { status } = await post(P, '/auth/login', { body: { sapCode: 'UNKNOWN-000', password: 'demo1234' } })
      assert.equal(status, 401)
    })

    test('blocked account (DEBT) returns 403 ACCOUNT_BLOCKED', async () => {
      const { status, body } = await post(P, '/auth/login', { body: { sapCode: 'SDA-00187', password: 'demo1234' } })
      assert.equal(status, 403)
      assert.equal(body.error, 'ACCOUNT_BLOCKED')
      assert.equal(body.reason, 'DEBT')
      assert.ok(body.supportContact?.email)
    })

    test('blocked account (ADMIN) returns 403 with reason ADMIN', async () => {
      const { status, body } = await post(P, '/auth/login', { body: { sapCode: 'SDA-00098', password: 'demo1234' } })
      assert.equal(status, 403)
      assert.equal(body.reason, 'ADMIN')
    })

    test('missing fields returns 400 VALIDATION_ERROR', async () => {
      const { status, body } = await post(P, '/auth/login', { body: {} })
      assert.equal(status, 400)
      assert.equal(body.error, 'VALIDATION_ERROR')
      assert.ok(Array.isArray(body.details))
    })

    test('response never includes password', async () => {
      const { body } = await post(P, '/auth/login', { body: { sapCode: 'SDA-00423', password: 'demo1234' } })
      assert.ok(!JSON.stringify(body).includes('demo1234'))
    })
  })

  // ── GET /auth/me ───────────────────────────────────────────────
  describe('GET /auth/me', () => {
    test('no token returns 401', async () => {
      const { status } = await get(P, '/auth/me')
      assert.equal(status, 401)
    })

    test('valid token returns user data', async () => {
      const { status, body } = await get(P, '/auth/me', { token })
      assert.equal(status, 200)
      assert.equal(body.sapCode, 'SDA-00423')
      assert.equal(body.profile, 'PREMIUM')
      assert.equal(body.role, 'CUSTOMER')
      assert.ok(body.name)
    })

    test('fake token returns 401', async () => {
      const { status } = await get(P, '/auth/me', { token: 'fake.token.value' })
      assert.equal(status, 401)
    })
  })

  // ── POST /auth/verify ──────────────────────────────────────────
  describe('POST /auth/verify', () => {
    test('valid token returns valid:true + payload', async () => {
      const { status, body } = await post(P, '/auth/verify', { body: { token } })
      assert.equal(status, 200)
      assert.equal(body.valid, true)
      assert.equal(body.payload.sub, 'SDA-00423')
    })

    test('invalid token returns 401 valid:false', async () => {
      const { status, body } = await post(P, '/auth/verify', { body: { token: 'invalid.token.xyz' } })
      assert.equal(status, 401)
      assert.equal(body.valid, false)
    })

    test('missing token field returns 400', async () => {
      const { status } = await post(P, '/auth/verify', { body: {} })
      assert.equal(status, 400)
    })
  })

  // ── POST /auth/logout ──────────────────────────────────────────
  describe('POST /auth/logout', () => {
    test('valid token returns 200 with message', async () => {
      const { status, body } = await post(P, '/auth/logout', { token })
      assert.equal(status, 200)
      assert.ok(body.message)
    })

    test('no token returns 401', async () => {
      const { status } = await post(P, '/auth/logout')
      assert.equal(status, 401)
    })
  })
})
