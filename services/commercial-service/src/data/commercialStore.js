/**
 * commercialStore
 * Datos en memoria de comerciales, asignaciones y pedidos sugeridos.
 *
 * Roles:
 * - COMMERCIAL → representante comercial con cartera de clientes
 * - ADMIN      → puede asignar/cambiar comerciales
 */

export const commercials = [
  {
    id: 'COM-001',
    name: 'Marta Soler',
    email: 'marta.soler@secretosdelagua.com',
    phone: '612 345 678',
    photoUrl: null,
    zone: 'Cataluña y Baleares',
    role: 'COMMERCIAL',
    active: true
  },
  {
    id: 'COM-002',
    name: 'Javier Ruiz',
    email: 'javier.ruiz@secretosdelagua.com',
    phone: '623 456 789',
    photoUrl: null,
    zone: 'Madrid y Centro',
    role: 'COMMERCIAL',
    active: true
  },
  {
    id: 'COM-003',
    name: 'Laura Pérez',
    email: 'laura.perez@secretosdelagua.com',
    phone: '634 567 890',
    photoUrl: null,
    zone: 'Levante y Andalucía',
    role: 'COMMERCIAL',
    active: true
  }
]

// Asignaciones cliente → comercial
export const assignments = [
  { sapCode: 'SDA-00423', commercialId: 'COM-001', assignedAt: '2022-03-15T00:00:00.000Z' },
  { sapCode: 'SDA-00521', commercialId: 'COM-001', assignedAt: '2020-05-03T00:00:00.000Z' },
  { sapCode: 'SDA-00387', commercialId: 'COM-002', assignedAt: '2022-07-20T00:00:00.000Z' },
  { sapCode: 'SDA-00187', commercialId: 'COM-003', assignedAt: '2021-11-10T00:00:00.000Z' },
  { sapCode: 'SDA-00098', commercialId: 'COM-003', assignedAt: '2023-01-18T00:00:00.000Z' },
]

// Pedidos sugeridos por el comercial — HU-45
export const suggestedOrders = [
  {
    id: 'SUG-001',
    sapCode: 'SDA-00423',
    commercialId: 'COM-001',
    commercialName: 'Marta Soler',
    message: 'Hola Rosa, te sugiero este pedido de reposición para el mes de abril. El Champú Restaurador está volando en temporada.',
    items: [
      { productCode: 'P-RT-001', name: 'Champú Restaurador Timeless', quantity: 6, unitPrice: 16.00 },
      { productCode: 'P-RT-002', name: 'Mascarilla Timeless',         quantity: 3, unitPrice: 19.00 },
    ],
    status: 'PENDING',
    createdAt: '2025-03-10T10:00:00.000Z',
    respondedAt: null
  }
]

let sugCounter = suggestedOrders.length + 1

export function getCommercialByCustomer (sapCode) {
  const assignment = assignments.find(a => a.sapCode === sapCode)
  if (!assignment) return null
  return commercials.find(c => c.id === assignment.commercialId) ?? null
}

export function getCustomersByCommercial (commercialId) {
  return assignments
    .filter(a => a.commercialId === commercialId)
    .map(a => ({ ...a }))
}

export function assign (sapCode, commercialId, adminId) {
  const existing = assignments.find(a => a.sapCode === sapCode)
  if (existing) {
    existing.commercialId = commercialId
    existing.assignedAt   = new Date().toISOString()
  } else {
    assignments.push({ sapCode, commercialId, assignedAt: new Date().toISOString() })
  }
  return { sapCode, commercialId, assignedAt: assignments.find(a => a.sapCode === sapCode).assignedAt }
}

export function createSuggestedOrder (sapCode, commercialId, commercialName, items, message) {
  const sug = {
    id: `SUG-${String(sugCounter++).padStart(3, '0')}`,
    sapCode, commercialId, commercialName, message, items,
    status: 'PENDING',
    createdAt: new Date().toISOString(),
    respondedAt: null
  }
  suggestedOrders.push(sug)
  return sug
}

export function respondSuggestedOrder (id, status) {
  const sug = suggestedOrders.find(s => s.id === id)
  if (!sug) return null
  sug.status      = status  // ACCEPTED | REJECTED
  sug.respondedAt = new Date().toISOString()
  return sug
}

export function getSuggestedOrdersByCustomer (sapCode) {
  return suggestedOrders.filter(s => s.sapCode === sapCode)
}

export function getSuggestedOrdersByCommercial (commercialId) {
  return suggestedOrders.filter(s => s.commercialId === commercialId)
}
