// ── Login ─────────────────────────────────────────────────────────────────────
export const loginSchema = {
  description: 'Inicio de sesión con código SAP (HU-01)',
  tags: ['auth'],
  body: {
    type: 'object',
    required: ['sapCode', 'password'],
    properties: {
      sapCode: {
        type: 'string',
        minLength: 3,
        maxLength: 20,
        description: 'Código de cliente SAP (ej: SDA-00423)'
      },
      password: {
        type: 'string',
        minLength: 4,
        maxLength: 64,
        description: 'Contraseña del responsable de tienda'
      }
    }
  },
  response: {
    200: {
      description: 'Login correcto',
      type: 'object',
      properties: {
        token: { type: 'string' },
        expiresIn: { type: 'string' },
        customer: {
          type: 'object',
          properties: {
            sapCode: { type: 'string' },
            name: { type: 'string' },
            businessName: { type: 'string' },
            profile: { type: 'string', enum: ['STANDARD', 'PREMIUM', 'VIP', 'ADMIN'] },
            role: { type: 'string', enum: ['CUSTOMER', 'ADMIN'] }
          }
        }
      }
    },
    401: {
      description: 'Credenciales incorrectas',
      type: 'object',
      properties: {
        error: { type: 'string' },
        message: { type: 'string' }
      }
    },
    403: {
      description: 'Cuenta bloqueada (HU-02, HU-03)',
      type: 'object',
      properties: {
        error: { type: 'string' },
        message: { type: 'string' },
        reason: { type: 'string', enum: ['DEBT', 'ADMIN', 'SUSPENDED'] },
        supportContact: {
          type: 'object',
          properties: {
            email: { type: 'string' },
            phone: { type: 'string' },
            hours: { type: 'string' }
          }
        }
      }
    }
  }
}

// ── Me ────────────────────────────────────────────────────────────────────────
export const meSchema = {
  description: 'Devuelve los datos del usuario autenticado',
  tags: ['auth'],
  security: [{ bearerAuth: [] }],
  response: {
    200: {
      type: 'object',
      properties: {
        sapCode: { type: 'string' },
        name: { type: 'string' },
        profile: { type: 'string' },
        role: { type: 'string' }
      }
    }
  }
}

// ── Refresh ───────────────────────────────────────────────────────────────────
export const refreshSchema = {
  description: 'Renueva el JWT antes de que expire',
  tags: ['auth'],
  security: [{ bearerAuth: [] }]
}
