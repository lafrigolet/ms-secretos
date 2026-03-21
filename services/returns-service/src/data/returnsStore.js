/**
 * returnsStore
 * Almacén en memoria de solicitudes de devolución.
 * En producción se persistiría en base de datos.
 *
 * Estados del ciclo de vida:
 * PENDING   → recibida, pendiente de revisión
 * REVIEWING → el administrador la está revisando
 * APPROVED  → aprobada, pendiente de abono en SAP
 * REJECTED  → rechazada con motivo
 * RESOLVED  → abono generado en SAP (HU-35)
 */

export const RETURN_REASONS = [
  { code: 'DAMAGED',   label: 'Producto dañado o defectuoso' },
  { code: 'WRONG',     label: 'Producto incorrecto recibido' },
  { code: 'MISSING',   label: 'Faltaban unidades en el pedido' },
  { code: 'DUPLICATE', label: 'Pedido duplicado por error' },
  { code: 'OTHER',     label: 'Otro motivo' },
]

export const RETURN_STATUSES = ['PENDING', 'REVIEWING', 'APPROVED', 'REJECTED', 'RESOLVED']

// Datos de ejemplo precargados
export const returns = [
  {
    id: 'RET-2025-001',
    sapCode: 'SDA-00423',
    orderId: 'SDA-2025-0812',
    reason: 'DAMAGED',
    reasonLabel: 'Producto dañado o defectuoso',
    notes: 'Mascarilla Timeless llegó con el envase roto',
    items: [
      { productCode: 'P-RT-002', name: 'Mascarilla Timeless', quantity: 1, unitPrice: 19.00 }
    ],
    status: 'REVIEWING',
    createdAt: '2025-03-10T10:30:00.000Z',
    updatedAt: '2025-03-11T09:00:00.000Z',
    adminNotes: null,
    creditNoteId: null
  },
  {
    id: 'RET-2025-002',
    sapCode: 'SDA-00423',
    orderId: 'SDA-2025-0744',
    reason: 'WRONG',
    reasonLabel: 'Producto incorrecto recibido',
    notes: 'Recibí Champú Restaurador en lugar de Sensitivo',
    items: [
      { productCode: 'P-SN-001', name: 'Champú Sensitivo', quantity: 6, unitPrice: 13.00 }
    ],
    status: 'APPROVED',
    createdAt: '2025-02-20T14:00:00.000Z',
    updatedAt: '2025-02-22T11:30:00.000Z',
    adminNotes: 'Aprobada. Proceder con abono.',
    creditNoteId: null
  }
]

let counter = 3

export function createReturn ({ sapCode, orderId, reason, notes, items }) {
  const reasonData = RETURN_REASONS.find(r => r.code === reason)
  const ret = {
    id: `RET-${new Date().getFullYear()}-${String(counter++).padStart(3, '0')}`,
    sapCode,
    orderId,
    reason,
    reasonLabel: reasonData?.label ?? reason,
    notes: notes ?? '',
    items,
    status: 'PENDING',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    adminNotes: null,
    creditNoteId: null
  }
  returns.push(ret)
  return ret
}

export function updateReturn (id, { status, adminNotes, creditNoteId }) {
  const ret = returns.find(r => r.id === id)
  if (!ret) return null
  if (status)       ret.status      = status
  if (adminNotes)   ret.adminNotes  = adminNotes
  if (creditNoteId) ret.creditNoteId = creditNoteId
  ret.updatedAt = new Date().toISOString()
  return ret
}

export function getReturnsByCustomer (sapCode) {
  return returns.filter(r => r.sapCode === sapCode)
}

export function getReturnById (id) {
  return returns.find(r => r.id === id) ?? null
}

export function getAllReturns () {
  return [...returns].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
}
