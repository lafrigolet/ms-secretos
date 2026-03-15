import { SapIntegrationClient } from './sapIntegrationClient.js'

/**
 * AuthService
 * Contiene la lógica de negocio de autenticación.
 * Delega la verificación de credenciales y estado de cuenta al SAP Integration Service.
 */
export class AuthService {
  constructor (fastify) {
    this.log = fastify.log
    this.sapClient = new SapIntegrationClient()
  }

  /**
   * Intenta autenticar a un responsable de tienda con su código SAP.
   * @returns {object} resultado con { success, blocked, customer, message, reason, supportContact }
   */
  async login (sapCode, password) {
    this.log.info({ sapCode }, 'Intento de login')

    let customerData
    try {
      customerData = await this.sapClient.verifyCredentials(sapCode, password)
    } catch (err) {
      this.log.error({ sapCode, err: err.message }, 'Error al contactar SAP Integration Service')
      throw new Error('SAP_INTEGRATION_UNAVAILABLE')
    }

    // HU-02: cuenta bloqueada en SAP
    if (customerData.status === 'BLOCKED') {
      this.log.warn({ sapCode, reason: customerData.blockReason }, 'Acceso bloqueado')
      return {
        success: false,
        blocked: true,
        // HU-03: mensaje claro + contacto de soporte
        message: this.#buildBlockMessage(customerData.blockReason),
        reason: customerData.blockReason,
        supportContact: {
          email: 'soporte@secretosdel agua.com',
          phone: '+34 900 000 000',
          hours: 'L-V 9:00-18:00'
        }
      }
    }

    // Credenciales incorrectas
    if (!customerData.authenticated) {
      this.log.warn({ sapCode }, 'Credenciales incorrectas')
      return { success: false, blocked: false }
    }

    // HU-01: login correcto
    this.log.info({ sapCode, profile: customerData.profile }, 'Login correcto')
    return {
      success: true,
      blocked: false,
      customer: {
        sapCode: customerData.sapCode,
        name: customerData.name,
        businessName: customerData.businessName,
        profile: customerData.profile,   // 'STANDARD' | 'PREMIUM' | 'VIP'
        role: customerData.role ?? 'CUSTOMER'
      }
    }
  }

  // ── Privado ───────────────────────────────────────────

  /**
   * HU-03: construye un mensaje legible según el motivo del bloqueo.
   */
  #buildBlockMessage (reason) {
    const messages = {
      DEBT: 'Tu cuenta tiene pagos pendientes. Para regularizar la situación y recuperar el acceso, contacta con nuestro equipo de administración.',
      ADMIN: 'Tu cuenta ha sido suspendida temporalmente por el administrador. Contacta con soporte para más información.',
      SUSPENDED: 'Tu cuenta está inactiva. Por favor, contacta con tu representante comercial.',
      DEFAULT: 'Tu cuenta no está habilitada para realizar pedidos en este momento. Contacta con soporte.'
    }
    return messages[reason] ?? messages.DEFAULT
  }
}
