import { describe, test, before } from 'node:test'
import assert from 'node:assert/strict'
import { login, get, patch, PORTS } from '../helpers/client.js'

const P = PORTS.profile

describe('customer-profile-service — integration', () => {
  let tokenCustomer
  let tokenAdmin

  before(async () => {
    tokenCustomer = await login('SDA-00423', 'demo1234')
    tokenAdmin    = await login('ADMIN-001', 'admin1234')
  })

  // ── Health ─────────────────────────────────────────────────────
  describe('GET /health', () => {
    test('returns 200', async () => {
      const { status, body } = await get(P, '/health')
      assert.equal(status, 200)
      assert.equal(body.status, 'ok')
    })
  })

  // ── HU-04 — GET /profile/me ────────────────────────────────────
  describe('GET /profile/me', () => {
    test('no token returns 401', async () => {
      const { status } = await get(P, '/profile/me')
      assert.equal(status, 401)
    })

    test('returns own profile', async () => {
      const { status, body } = await get(P, '/profile/me', { token: tokenCustomer })
      assert.equal(status, 200)
      assert.equal(body.sapCode, 'SDA-00423')
      assert.equal(body.profile, 'PREMIUM')
      assert.ok(body.name)
      assert.ok(body.businessName)
    })

    test('VIP user gets profile VIP', async () => {
      const tokenVip = await login('SDA-00521', 'demo1234')
      const { body } = await get(P, '/profile/me', { token: tokenVip })
      assert.equal(body.profile, 'VIP')
    })

    test('profile includes permissions array', async () => {
      const { body } = await get(P, '/profile/me', { token: tokenCustomer })
      assert.ok(Array.isArray(body.permissions))
    })
  })

  // ── GET /profile/:sapCode — admin only ─────────────────────────
  describe('GET /profile/:sapCode', () => {
    test('customer cannot access other profile — 403', async () => {
      const { status } = await get(P, '/profile/SDA-00387', { token: tokenCustomer })
      assert.equal(status, 403)
    })

    test('admin can access any profile', async () => {
      const { status, body } = await get(P, '/profile/SDA-00423', { token: tokenAdmin })
      assert.equal(status, 200)
      assert.equal(body.sapCode, 'SDA-00423')
    })

    test('unknown sapCode returns 404', async () => {
      const { status } = await get(P, '/profile/UNKNOWN-000', { token: tokenAdmin })
      assert.equal(status, 404)
    })
  })

  // ── GET /profile — admin list ──────────────────────────────────
  describe('GET /profile', () => {
    test('customer cannot list all profiles — 403', async () => {
      const { status } = await get(P, '/profile', { token: tokenCustomer })
      assert.equal(status, 403)
    })

    test('admin gets list of profiles', async () => {
      const { status, body } = await get(P, '/profile', { token: tokenAdmin })
      assert.equal(status, 200)
      assert.ok(Array.isArray(body))
      assert.ok(body.length > 0)
    })
  })

  // ── HU-05 — PATCH /profile/:sapCode ───────────────────────────
  describe('PATCH /profile/:sapCode', () => {
    test('customer cannot update profiles — 403', async () => {
      const { status } = await patch(P, '/profile/SDA-00387', { token: tokenCustomer, body: { profile: 'VIP' } })
      assert.equal(status, 403)
    })

    test('admin can update profile tier', async () => {
      const { status, body } = await patch(P, '/profile/SDA-00387', { token: tokenAdmin, body: { profile: 'PREMIUM' } })
      assert.equal(status, 200)
      assert.equal(body.profile, 'PREMIUM')
    })

    test('invalid profile value returns 400', async () => {
      const { status } = await patch(P, '/profile/SDA-00387', { token: tokenAdmin, body: { profile: 'INVALID' } })
      assert.equal(status, 400)
    })
  })
})
