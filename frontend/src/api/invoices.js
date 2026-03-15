import { api } from './client.js'

export const invoicesApi = {
  getInvoices:  ()            => api.get('/invoices/'),
  getInvoice:   (invoiceId)   => api.get(`/invoices/${invoiceId}`),
  download:     (invoiceId)   => api.get(`/invoices/${invoiceId}/download`),
}
