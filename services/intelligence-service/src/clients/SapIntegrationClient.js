import { HttpClient } from './HttpClient.js'

// Datos STUB con historial extendido para cálculos de inteligencia comercial
const STUB_ORDERS = {
  'SDA-00423': [
    // Periodo actual (últimos 90 días desde ref. 2025-03-15)
    { orderId: 'SDA-2025-0890', date: '2025-03-08', total: 96.00,  items: [{ productCode: 'P-RT-001', name: 'Champú Restaurador', quantity: 6, unitPrice: 16.00 }] },
    { orderId: 'SDA-2025-0812', date: '2025-02-21', total: 289.00, items: [{ productCode: 'P-RT-002', name: 'Mascarilla Timeless', quantity: 6, unitPrice: 19.00 }, { productCode: 'P-RT-003', name: 'Aceite Acabado', quantity: 5, unitPrice: 31.00 }] },
    { orderId: 'SDA-2025-0744', date: '2025-01-30', total: 156.00, items: [{ productCode: 'P-SN-001', name: 'Champú Sensitivo', quantity: 12, unitPrice: 13.00 }] },
    // Periodo anterior (90-180 días atrás)
    { orderId: 'SDA-2024-1102', date: '2024-12-18', total: 224.00, items: [{ productCode: 'P-RT-001', name: 'Champú Restaurador', quantity: 6, unitPrice: 16.00 }, { productCode: 'P-RT-002', name: 'Mascarilla Timeless', quantity: 6, unitPrice: 19.00 }] },
    { orderId: 'SDA-2024-1045', date: '2024-11-25', total: 78.00,  items: [{ productCode: 'P-BN-001', name: 'Aceite Brillo Argán', quantity: 3, unitPrice: 26.00 }] },
    { orderId: 'SDA-2024-0987', date: '2024-10-30', total: 182.00, items: [{ productCode: 'P-RT-003', name: 'Aceite Acabado', quantity: 5, unitPrice: 31.00 }, { productCode: 'P-SN-001', name: 'Champú Sensitivo', quantity: 3, unitPrice: 13.00 }] },
  ],
  'SDA-00521': [
    { orderId: 'SDA-2025-0901', date: '2025-03-12', total: 512.00, items: [{ productCode: 'P-RT-001', name: 'Champú Restaurador', quantity: 12, unitPrice: 16.00 }, { productCode: 'P-RT-002', name: 'Mascarilla Timeless', quantity: 12, unitPrice: 19.00 }] },
    { orderId: 'SDA-2024-1120', date: '2024-12-05', total: 390.00, items: [{ productCode: 'P-RT-003', name: 'Aceite Acabado', quantity: 12, unitPrice: 31.00 }] },
  ],
  'SDA-00387': [
    { orderId: 'SDA-2025-0788', date: '2025-02-10', total: 104.00, items: [{ productCode: 'P-SN-001', name: 'Champú Sensitivo', quantity: 8, unitPrice: 13.00 }] },
    { orderId: 'SDA-2024-0956', date: '2024-10-20', total: 130.00, items: [{ productCode: 'P-SN-001', name: 'Champú Sensitivo', quantity: 10, unitPrice: 13.00 }] },
  ]
}

// Beneficios acumulados STUB — HU-43
const STUB_BENEFITS = {
  'SDA-00423': [
    { date: '2025-03-08', promoName: 'Promo Otoño — Ritual Timeless', benefit: { type: 'SAMPLE', description: 'Muestra Sérum Raíces 15ml' } },
    { date: '2025-02-21', promoName: 'Tester Aceite Brillo ≥250€',    benefit: { type: 'GIFT',   description: 'Tester Aceite Brillo Argán 30ml' } },
    { date: '2025-01-30', promoName: 'Promo Otoño — Ritual Timeless', benefit: { type: 'SAMPLE', description: 'Muestra Sérum Raíces 15ml' } },
  ],
  'SDA-00521': [
    { date: '2025-03-12', promoName: 'Tester Aceite Brillo ≥250€',    benefit: { type: 'GIFT',   description: 'Tester Aceite Brillo Argán 30ml' } },
    { date: '2025-03-12', promoName: 'Promo Otoño — Ritual Timeless', benefit: { type: 'SAMPLE', description: 'Muestra Sérum Raíces 15ml' } },
  ],
  'SDA-00387': []
}

/**
 * SapIntegrationClient — intelligence-service
 * Obtiene el historial completo de pedidos para cálculos de inteligencia comercial.
 */
export class SapIntegrationClient {
  constructor () {
    this.http = new HttpClient(
      process.env.SAP_INTEGRATION_URL ?? 'http://sap-integration-service:3010',
      { timeout: 5000 }
    )
  }

  async getOrders (sapCode) {
    if (process.env.NODE_ENV !== 'production') {
      return STUB_ORDERS[sapCode] ?? []
    }
    return this.http.get(`/internal/orders/${sapCode}`) ?? []
  }

  async getBenefits (sapCode) {
    if (process.env.NODE_ENV !== 'production') {
      return STUB_BENEFITS[sapCode] ?? []
    }
    return this.http.get(`/internal/orders/${sapCode}/benefits`) ?? []
  }
}
