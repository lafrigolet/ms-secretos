/**
 * sustainabilityStore
 * Datos de sostenibilidad: fichas de origen, cálculo de huella de carbono
 * y preferencias de agrupación de pedidos.
 */

// ── HU-53 — Fichas de origen e ingredientes ───────────────────────
export const productSustainability = {
  'P-RT-001': {
    productCode: 'P-RT-001',
    name: 'Champú Restaurador Timeless',
    origin: {
      country: 'España',
      region: 'Andalucía',
      supplier: 'Cosméticos Naturales del Sur, S.L.',
      certifications: ['COSMOS Organic', 'Cruelty Free', 'Vegan Society']
    },
    ingredients: [
      { name: 'Aqua',                   percentage: 72.0, origin: 'Fuente natural filtrada, Andalucía', natural: true  },
      { name: 'Aceite de Argán',        percentage: 8.5,  origin: 'Marruecos — cooperativa certificada Fairtrade', natural: true },
      { name: 'Proteína de Seda',       percentage: 4.0,  origin: 'Italia — producción sostenible',  natural: true  },
      { name: 'Pantenol (Pro-Vit B5)',  percentage: 2.0,  origin: 'Síntesis vegetal certificada',    natural: true  },
      { name: 'Extracto de Romero',     percentage: 1.5,  origin: 'Agricultura ecológica, España',  natural: true  },
      { name: 'Conservante natural',    percentage: 0.8,  origin: 'Derivado vegetal',               natural: true  },
      { name: 'Fragancia natural',      percentage: 0.7,  origin: 'Esencias certificadas IFRA',     natural: true  },
    ],
    naturalPercentage: 98.5,
    packaging: { material: 'HDPE reciclado 70%', recyclable: true, refillable: false },
    carbonFootprintKg: 0.42,
    sustainabilityScore: 88,
    ecoLabels: ['🌿 COSMOS Organic', '🐰 Cruelty Free', '🌱 Vegan']
  },
  'P-RT-002': {
    productCode: 'P-RT-002',
    name: 'Mascarilla Timeless',
    origin: {
      country: 'España',
      region: 'Catalunya',
      supplier: 'Lab Naturals BCN, S.A.',
      certifications: ['COSMOS Organic', 'Cruelty Free']
    },
    ingredients: [
      { name: 'Aqua',                    percentage: 65.0, origin: 'Agua de montaña filtrada, Pirineos', natural: true },
      { name: 'Manteca de Karité',       percentage: 12.0, origin: 'Ghana — cooperativa certificada',   natural: true },
      { name: 'Aceite de Jojoba',        percentage: 8.0,  origin: 'Israel — cultivo sostenible',       natural: true },
      { name: 'Proteína de Trigo',       percentage: 5.0,  origin: 'Agricultura ecológica europea',     natural: true },
      { name: 'Extracto de Aloe Vera',   percentage: 3.0,  origin: 'Agricultura ecológica, Canarias',  natural: true },
      { name: 'Cera de Abejas Ecológica',percentage: 2.5,  origin: 'Apicultura sostenible, España',    natural: true },
      { name: 'Vitamina E',              percentage: 1.5,  origin: 'Extracción vegetal certificada',   natural: true },
    ],
    naturalPercentage: 97.0,
    packaging: { material: 'Tarro de vidrio reciclado', recyclable: true, refillable: true },
    carbonFootprintKg: 0.61,
    sustainabilityScore: 92,
    ecoLabels: ['🌿 COSMOS Organic', '🐰 Cruelty Free', '♻ Envase recargable']
  },
  'P-SN-001': {
    productCode: 'P-SN-001',
    name: 'Champú Sensitivo',
    origin: {
      country: 'España',
      region: 'Comunidad Valenciana',
      supplier: 'Laboratorio Sens Natural, S.L.',
      certifications: ['Hypoallergenic', 'Dermatologically Tested', 'Vegan Society']
    },
    ingredients: [
      { name: 'Aqua',                   percentage: 78.0, origin: 'Agua purificada osmosis inversa', natural: true },
      { name: 'Tensioactivo vegetal',   percentage: 10.0, origin: 'Derivado de coco, certificado',  natural: true },
      { name: 'Glicerina vegetal',      percentage: 5.0,  origin: 'Palma sostenible certificada',   natural: true },
      { name: 'Extracto de Caléndula', percentage: 2.0,  origin: 'Agricultura ecológica, España',  natural: true },
      { name: 'Alantoína',             percentage: 1.0,  origin: 'Síntesis natural',              natural: true },
    ],
    naturalPercentage: 99.2,
    packaging: { material: 'PET reciclado 90%', recyclable: true, refillable: false },
    carbonFootprintKg: 0.38,
    sustainabilityScore: 85,
    ecoLabels: ['🐰 Cruelty Free', '🌱 Vegan', '♾ Hipoalergénico']
  }
}

// ── HU-54 — Factores de huella de carbono ─────────────────────────
// kg CO₂ por kg de paquete según modalidad de envío
const EMISSION_FACTORS = {
  STANDARD:   0.52,   // camión (kg CO₂ / kg paquete)
  EXPRESS:    1.85,   // avión + furgoneta
  ECO:        0.28,   // ruta optimizada baja emisión
  PICKUP:     0.05,   // recogida en punto de conveniencia
}

// Peso medio por unidad de producto en kg
const PRODUCT_WEIGHTS = {
  'P-RT-001': 0.30,
  'P-RT-002': 0.25,
  'P-RT-003': 0.18,
  'P-SN-001': 0.30,
  'P-BN-001': 0.15,
  DEFAULT:    0.25
}

export function estimateCarbonFootprint (items, shippingMethod = 'STANDARD') {
  const factor = EMISSION_FACTORS[shippingMethod] ?? EMISSION_FACTORS.STANDARD

  const totalWeightKg = items.reduce((sum, item) => {
    const unitWeight = PRODUCT_WEIGHTS[item.productCode] ?? PRODUCT_WEIGHTS.DEFAULT
    return sum + unitWeight * item.quantity
  }, 0)

  // Peso de embalaje (~15% del contenido)
  const packagingWeightKg = totalWeightKg * 0.15
  const grossWeightKg     = totalWeightKg + packagingWeightKg

  const co2Kg     = +(grossWeightKg * factor).toFixed(3)
  const treeHours = +(co2Kg * 10).toFixed(1)  // horas de absorción de un árbol adulto

  return {
    shippingMethod,
    totalWeightKg:   +totalWeightKg.toFixed(2),
    grossWeightKg:   +grossWeightKg.toFixed(2),
    co2Kg,
    treeHours,
    alternatives: Object.entries(EMISSION_FACTORS)
      .filter(([m]) => m !== shippingMethod)
      .map(([method, f]) => ({
        method,
        co2Kg:   +(grossWeightKg * f).toFixed(3),
        savings: +(co2Kg - grossWeightKg * f).toFixed(3)
      }))
      .sort((a, b) => a.co2Kg - b.co2Kg)
  }
}

// ── HU-55 — Preferencias de agrupación de pedidos ─────────────────
const groupingPreferences = {}

export function getGroupingPreference (sapCode) {
  return groupingPreferences[sapCode] ?? {
    sapCode,
    acceptDelay:   false,
    maxDelayDays:  3,
    updatedAt:     null
  }
}

export function updateGroupingPreference (sapCode, { acceptDelay, maxDelayDays }) {
  groupingPreferences[sapCode] = {
    sapCode,
    acceptDelay:  acceptDelay ?? false,
    maxDelayDays: maxDelayDays ?? 3,
    updatedAt:    new Date().toISOString()
  }
  return groupingPreferences[sapCode]
}
