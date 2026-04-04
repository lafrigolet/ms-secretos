export const PLANS = [
  {
    id: 'plan-basic',
    name: 'Basic',
    price: 29.99,
    currency: 'EUR',
    interval: 'month',
    features: [
      'Acceso al catálogo completo',
      'Gestión de pedidos',
      'Historial de facturas',
      'Soporte por email'
    ],
    active: true
  },
  {
    id: 'plan-pro',
    name: 'Pro',
    price: 79.99,
    currency: 'EUR',
    interval: 'month',
    features: [
      'Todo en Basic',
      'Inteligencia de negocio',
      'Promociones exclusivas',
      'Gestión de devoluciones prioritaria',
      'Soporte prioritario'
    ],
    active: true
  },
  {
    id: 'plan-enterprise',
    name: 'Enterprise',
    price: 199.99,
    currency: 'EUR',
    interval: 'month',
    features: [
      'Todo en Pro',
      'Integración SAP directa',
      'Gestor comercial dedicado',
      'SLA garantizado',
      'Soporte 24/7'
    ],
    active: true
  }
]

export function getPlan (id) {
  return PLANS.find(p => p.id === id && p.active) ?? null
}
