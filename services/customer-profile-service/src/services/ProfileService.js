import { SapIntegrationClient } from '../clients/SapIntegrationClient.js'

// Permisos por perfil — define qué puede hacer cada tipo de cliente
const PROFILE_PERMISSIONS = {
  STANDARD: ['ORDER', 'VIEW_PRICES'],
  PREMIUM:  ['ORDER', 'VIEW_PROMOTIONS', 'VIEW_PRICES'],
  VIP:      ['ORDER', 'VIEW_PROMOTIONS', 'VIEW_PRICES', 'SPECIAL_CONDITIONS'],
  ADMIN:    ['ORDER', 'VIEW_PROMOTIONS', 'VIEW_PRICES', 'SPECIAL_CONDITIONS', 'MANAGE_PROFILES', 'MANAGE_PROMOTIONS']
}

const VALID_PROFILES = ['STANDARD', 'PREMIUM', 'VIP']

/**
 * ProfileService
 * HU-04 — Catálogo personalizado según perfil SAP
 * HU-05 — Gestión de permisos de perfil por el administrador SAP
 */
export class ProfileService {
  constructor (log) {
    this.log = log
    this.sap = new SapIntegrationClient()
  }

  /**
   * HU-04 — Obtiene el perfil completo de un cliente.
   * Incluye permisos calculados según su perfil SAP.
   */
  async getProfile (sapCode) {
    const customer = await this.sap.getCustomer(sapCode)
    if (!customer) return null

    return this.#buildProfile(customer)
  }

  /**
   * Obtiene todos los perfiles — usado por el panel de administración.
   */
  async getAllProfiles () {
    const customers = await this.sap.getAllCustomers()
    return customers.map(c => this.#buildProfile(c))
  }

  /**
   * HU-05 — Actualiza el perfil de un cliente.
   * Solo puede ejecutarlo un usuario con rol ADMIN.
   */
  async updateProfile (sapCode, newProfile, requestedBy) {
    this.log.info({ sapCode, newProfile, requestedBy }, 'Actualizando perfil')

    if (!VALID_PROFILES.includes(newProfile)) {
      return { success: false, error: 'INVALID_PROFILE', message: `Perfil no válido. Valores permitidos: ${VALID_PROFILES.join(', ')}` }
    }

    const customer = await this.sap.getCustomer(sapCode)
    if (!customer) {
      return { success: false, error: 'CUSTOMER_NOT_FOUND', message: 'Cliente no encontrado' }
    }

    const updated = await this.sap.updateProfile(sapCode, newProfile)
    this.log.info({ sapCode, oldProfile: customer.profile, newProfile }, 'Perfil actualizado')

    return {
      success: true,
      profile: this.#buildProfile(updated)
    }
  }

  /**
   * Verifica si un cliente tiene un permiso concreto.
   * Usado internamente por otros microservicios.
   */
  async hasPermission (sapCode, permission) {
    const customer = await this.sap.getCustomer(sapCode)
    if (!customer || customer.status !== 'ACTIVE') return false
    const permissions = PROFILE_PERMISSIONS[customer.profile] ?? []
    return permissions.includes(permission)
  }

  // ── Privado ────────────────────────────────────────────────────

  #buildProfile (customer) {
    const permissions = PROFILE_PERMISSIONS[customer.profile] ?? PROFILE_PERMISSIONS.STANDARD
    return {
      sapCode:      customer.sapCode,
      name:         customer.name,
      businessName: customer.businessName,
      email:        customer.email,
      profile:      customer.profile,
      role:         customer.role,
      status:       customer.status,
      permissions,
      // Flags de conveniencia para el frontend
      canOrder:              permissions.includes('ORDER'),
      canViewPromotions:     permissions.includes('VIEW_PROMOTIONS'),
      hasSpecialConditions:  permissions.includes('SPECIAL_CONDITIONS'),
      isAdmin:               customer.role === 'ADMIN'
    }
  }
}
