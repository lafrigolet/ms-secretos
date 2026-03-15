// ══════════════════════════════════════════════════════════════════
// Datos de prueba extraídos del prototipo HTML
// Representan lo que devolvería SAP en un entorno real
// ══════════════════════════════════════════════════════════════════

// ── Clientes ──────────────────────────────────────────────────────
export const CUSTOMERS = [
  {
    sapCode: 'SDA-00423',
    password: 'demo1234',
    name: 'Rosa Canals',
    businessName: 'Salón Canals Barcelona',
    email: 'rosa@saloncanals.com',
    phone: '+34 932 000 001',
    profile: 'PREMIUM',
    role: 'CUSTOMER',
    status: 'ACTIVE',
    creditLimit: 5000,
    paymentTerms: '30 días'
  },
  {
    sapCode: 'SDA-00387',
    password: 'demo1234',
    name: 'Jorge Martínez',
    businessName: 'Studio JM Madrid',
    email: 'jorge@studiojm.com',
    phone: '+34 912 000 002',
    profile: 'STANDARD',
    role: 'CUSTOMER',
    status: 'ACTIVE',
    creditLimit: 2000,
    paymentTerms: '15 días'
  },
  {
    sapCode: 'SDA-00187',
    password: 'demo1234',
    name: 'Ana Ferrer',
    businessName: 'Ferrer Beauty Valencia',
    email: 'ana@ferrerbeauty.com',
    phone: '+34 962 000 003',
    profile: 'STANDARD',
    role: 'CUSTOMER',
    status: 'BLOCKED',
    blockReason: 'DEBT',
    creditLimit: 2000,
    paymentTerms: '15 días'
  },
  {
    sapCode: 'SDA-00521',
    password: 'demo1234',
    name: 'Lidia Puig',
    businessName: 'Puig Estilistes Girona',
    email: 'lidia@puigestilistes.com',
    phone: '+34 972 000 004',
    profile: 'VIP',
    role: 'CUSTOMER',
    status: 'ACTIVE',
    creditLimit: 10000,
    paymentTerms: '60 días'
  },
  {
    sapCode: 'SDA-00098',
    password: 'demo1234',
    name: 'Marcos Gil',
    businessName: 'Gil Peluqueros Sevilla',
    email: 'marcos@gilpeluqueros.com',
    phone: '+34 954 000 005',
    profile: 'STANDARD',
    role: 'CUSTOMER',
    status: 'BLOCKED',
    blockReason: 'ADMIN',
    creditLimit: 1500,
    paymentTerms: '15 días'
  },
  {
    sapCode: 'ADMIN-001',
    password: 'admin1234',
    name: 'Administrador',
    businessName: 'Secretos del Agua',
    email: 'admin@secretosdelagua.com',
    phone: '+34 900 000 000',
    profile: 'ADMIN',
    role: 'ADMIN',
    status: 'ACTIVE',
    creditLimit: 0,
    paymentTerms: null
  }
]

// ── Familias de productos ─────────────────────────────────────────
export const FAMILIES = [
  { id: 'F01', name: 'Ritual Timeless',    description: 'Línea anti-edad de alta concentración' },
  { id: 'F02', name: 'Sensitivo',          description: 'Fórmulas suaves para cueros cabelludos sensibles' },
  { id: 'F03', name: 'Brillo & Nutrición', description: 'Aceites y tratamientos nutritivos' }
]

// ── Productos ─────────────────────────────────────────────────────
export const PRODUCTS = [
  // Familia: Ritual Timeless
  {
    sapCode: 'P-RT-001',
    familyId: 'F01',
    name: 'Champú Restaurador Timeless',
    description: 'Champú de alta concentración con activos anti-edad. Restaura la fibra capilar desde la primera aplicación.',
    format: '250ml',
    imageUrl: null,
    active: true
  },
  {
    sapCode: 'P-RT-002',
    familyId: 'F01',
    name: 'Mascarilla Timeless',
    description: 'Mascarilla nutritiva con extracto de caviar y proteínas de seda. Uso semanal recomendado.',
    format: '200ml',
    imageUrl: null,
    active: true
  },
  {
    sapCode: 'P-RT-003',
    familyId: 'F01',
    name: 'Pack Ritual Timeless',
    description: 'Pack completo con Champú Restaurador + Mascarilla + Sérum. Tratamiento completo anti-edad.',
    format: 'Pack 3 uds',
    imageUrl: null,
    active: true
  },
  {
    sapCode: 'P-RT-004',
    familyId: 'F01',
    name: 'Sérum Raíces Timeless',
    description: 'Sérum de aplicación directa en raíces. Estimula el crecimiento y fortalece desde la raíz.',
    format: '100ml',
    imageUrl: null,
    active: true
  },
  // Familia: Sensitivo
  {
    sapCode: 'P-SN-001',
    familyId: 'F02',
    name: 'Champú Sensitivo',
    description: 'Champú sin sulfatos ni parabenos. Fórmula calmante con aloe vera y manzanilla.',
    format: '250ml',
    imageUrl: null,
    active: true
  },
  {
    sapCode: 'P-SN-002',
    familyId: 'F02',
    name: 'Acondicionador Sensitivo',
    description: 'Acondicionador ultraligero para cueros cabelludos reactivos. Sin siliconas.',
    format: '200ml',
    imageUrl: null,
    active: true
  },
  // Familia: Brillo & Nutrición
  {
    sapCode: 'P-BN-001',
    familyId: 'F03',
    name: 'Aceite Brillo Argán',
    description: 'Aceite de argán puro de primera presión en frío. Aporta brillo intenso y controla el frizz.',
    format: '50ml',
    imageUrl: null,
    active: true
  },
  {
    sapCode: 'P-BN-002',
    familyId: 'F03',
    name: 'Mascarilla Nutrición Profunda',
    description: 'Mascarilla de manteca de karité y aceite de jojoba. Para cabellos muy secos o dañados.',
    format: '300ml',
    imageUrl: null,
    active: true
  }
]

// ── Precios por perfil ────────────────────────────────────────────
// SAP gestiona tarifas distintas por perfil de cliente
export const PRICES = {
  'P-RT-001': { STANDARD: 18.50, PREMIUM: 16.00, VIP: 14.50 },
  'P-RT-002': { STANDARD: 22.00, PREMIUM: 19.00, VIP: 17.00 },
  'P-RT-003': { STANDARD: 55.00, PREMIUM: 48.00, VIP: 43.00 },
  'P-RT-004': { STANDARD: 28.00, PREMIUM: 24.00, VIP: 21.50 },
  'P-SN-001': { STANDARD: 15.00, PREMIUM: 13.00, VIP: 11.50 },
  'P-SN-002': { STANDARD: 14.00, PREMIUM: 12.00, VIP: 10.50 },
  'P-BN-001': { STANDARD: 24.00, PREMIUM: 21.00, VIP: 18.50 },
  'P-BN-002': { STANDARD: 19.00, PREMIUM: 16.50, VIP: 14.50 }
}

// ── Stock ─────────────────────────────────────────────────────────
export const STOCK = {
  'P-RT-001': 240,
  'P-RT-002': 180,
  'P-RT-003': 95,
  'P-RT-004': 120,
  'P-SN-001': 310,
  'P-SN-002': 275,
  'P-BN-001': 160,
  'P-BN-002': 200
}

// ── Pedidos ───────────────────────────────────────────────────────
export const ORDERS = [
  {
    orderId: 'SDA-2025-0890',
    sapCode: 'SDA-00423',
    date: '2025-03-08',
    status: 'SHIPPED',
    items: [
      { productCode: 'P-RT-001', name: 'Champú Restaurador', quantity: 6, unitPrice: 16.00 },
      { productCode: 'P-RT-002', name: 'Mascarilla Timeless', quantity: 2, unitPrice: 19.00 }
    ],
    subtotal: 134.00,
    shipping: 0,
    total: 134.00,
    invoiceId: 'FAC-2025-0890'
  },
  {
    orderId: 'SDA-2025-0812',
    sapCode: 'SDA-00423',
    date: '2025-02-21',
    status: 'DELIVERED',
    items: [
      { productCode: 'P-RT-003', name: 'Pack Ritual Timeless', quantity: 3, unitPrice: 48.00 },
      { productCode: 'P-BN-001', name: 'Aceite Brillo Argán', quantity: 6, unitPrice: 21.00 },
      { productCode: 'P-RT-002', name: 'Mascarilla Timeless', quantity: 1, unitPrice: 19.00 }
    ],
    subtotal: 289.00,
    shipping: 0,
    total: 289.00,
    invoiceId: 'FAC-2025-0812'
  },
  {
    orderId: 'SDA-2025-0744',
    sapCode: 'SDA-00423',
    date: '2025-02-05',
    status: 'DELIVERED',
    items: [
      { productCode: 'P-SN-001', name: 'Champú Sensitivo', quantity: 12, unitPrice: 13.00 },
      { productCode: 'P-RT-004', name: 'Sérum Raíces', quantity: 4, unitPrice: 24.00 }
    ],
    subtotal: 252.00,
    shipping: 0,
    total: 252.00,
    invoiceId: 'FAC-2025-0744'
  },
  {
    orderId: 'SDA-2025-0651',
    sapCode: 'SDA-00423',
    date: '2025-01-10',
    status: 'DELIVERED',
    items: [
      { productCode: 'P-RT-003', name: 'Pack Ritual Timeless', quantity: 2, unitPrice: 48.00 },
      { productCode: 'P-RT-002', name: 'Mascarilla Timeless', quantity: 6, unitPrice: 19.00 },
      { productCode: 'P-BN-002', name: 'Mascarilla Nutrición', quantity: 3, unitPrice: 16.50 }
    ],
    subtotal: 303.50,
    shipping: 0,
    total: 303.50,
    invoiceId: 'FAC-2025-0651'
  },
  {
    orderId: 'SDA-2024-1203',
    sapCode: 'SDA-00423',
    date: '2024-12-12',
    status: 'DELIVERED',
    items: [
      { productCode: 'P-RT-001', name: 'Champú Restaurador', quantity: 6, unitPrice: 16.00 },
      { productCode: 'P-BN-001', name: 'Aceite Brillo Argán', quantity: 4, unitPrice: 21.00 }
    ],
    subtotal: 180.00,
    shipping: 0,
    total: 180.00,
    invoiceId: 'FAC-2024-1203'
  }
]
