import { HttpClient } from './HttpClient.js'

const STUB_MODE = process.env.NODE_ENV !== 'production'

const STUB_ORDERS = {
  'SDA-00423': [
    { orderId: 'SDA-2025-0890', sapCode: 'SDA-00423', date: '2025-03-08', status: 'DELIVERED', total: 96.00,  invoiceId: 'FAC-2025-0890' },
    { orderId: 'SDA-2025-0812', sapCode: 'SDA-00423', date: '2025-02-21', status: 'DELIVERED', total: 289.00, invoiceId: 'FAC-2025-0812' }
  ]
}

const STUB_INVOICES = {
  'FAC-2025-0890': {
    invoiceId: 'FAC-2025-0890', orderId: 'SDA-2025-0890', sapCode: 'SDA-00423',
    date: '2025-03-08', total: 96.00,
    items: [{ productCode: 'P-RT-001', name: 'Champú Restaurador', quantity: 6, unitPrice: 16.00 }],
    pdfUrl: '/invoices/FAC-2025-0890/download'
  },
  'FAC-2025-0812': {
    invoiceId: 'FAC-2025-0812', orderId: 'SDA-2025-0812', sapCode: 'SDA-00423',
    date: '2025-02-21', total: 289.00,
    items: [
      { productCode: 'P-RT-002', name: 'Mascarilla Timeless', quantity: 6, unitPrice: 19.00 },
      { productCode: 'P-RT-003', name: 'Aceite Acabado',      quantity: 5, unitPrice: 31.00 }
    ],
    pdfUrl: '/invoices/FAC-2025-0812/download'
  }
}

export class SapIntegrationClient {
  constructor () {
    this.http = new HttpClient(
      process.env.SAP_INTEGRATION_URL ?? 'http://sap-integration-service:3010',
      { timeout: 5000 }
    )
  }

  getOrders (sapCode) {
    if (STUB_MODE) return Promise.resolve(STUB_ORDERS[sapCode] ?? [])
    return this.http.get(`/internal/orders/${sapCode}`)
  }

  getInvoice (invoiceId) {
    if (STUB_MODE) return Promise.resolve(STUB_INVOICES[invoiceId] ?? null)
    return this.http.get(`/internal/orders/invoice/${invoiceId}`)
  }
}
