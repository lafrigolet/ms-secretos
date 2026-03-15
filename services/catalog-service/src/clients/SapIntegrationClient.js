import { HttpClient } from './HttpClient.js'

/**
 * SapIntegrationClient — catalog-service
 * Obtiene productos, familias, precios y stock desde el SAP Integration Service.
 */
export class SapIntegrationClient {
  constructor () {
    this.http = new HttpClient(
      process.env.SAP_INTEGRATION_URL ?? 'http://sap-integration-service:3010',
      { timeout: 5000 }
    )
  }

  getFamilies ()                        { return this.http.get('/internal/catalog/families') }
  getProducts (familyId = null)         { return this.http.get(`/internal/catalog/products${familyId ? `?familyId=${familyId}` : ''}`) }
  getProduct (sapCode)                  { return this.http.get(`/internal/catalog/products/${sapCode}`) }
  getPricesForProfile (profile)         { return this.http.get(`/internal/catalog/prices/${profile}`) }
  getPrice (profile, productCode)       { return this.http.get(`/internal/catalog/prices/${profile}/${productCode}`) }
  getAllStock ()                         { return this.http.get('/internal/catalog/stock') }
  getStock (productCode)                { return this.http.get(`/internal/catalog/stock/${productCode}`) }
}
