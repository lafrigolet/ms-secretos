import { useState, useCallback } from 'react'
import { cartApi } from '../api/index.js'

/**
 * useCart — gestiona el estado de la cesta y expone las acciones.
 * Se usa en el contexto global para que el badge del navbar esté actualizado.
 */
export function useCart () {
  const [cart, setCart]       = useState({ items: [], subtotal: 0, shipping: 0, total: 0 })
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const data = await cartApi.getCart()
      setCart(data)
    } catch {}
  }, [])

  const addItem = useCallback(async (product, quantity = 1) => {
    setLoading(true)
    try {
      const data = await cartApi.addItem(product.sapCode, product.name, quantity, product.price)
      setCart(data)
      return data
    } finally { setLoading(false) }
  }, [])

  const updateItem = useCallback(async (productCode, quantity) => {
    try {
      const data = await cartApi.updateItem(productCode, quantity)
      setCart(data)
    } catch {
      console.error('updateItem failed')
    }
  }, [])

  const removeItem = useCallback(async (productCode) => {
    try {
      const data = await cartApi.removeItem(productCode)
      setCart(data)
    } catch {
      console.error('removeItem failed')
    }
  }, [])

  const clearCart = useCallback(async () => {
    const data = await cartApi.clearCart()
    setCart(data)
  }, [])

  const itemCount = cart.items?.reduce((s, i) => s + i.quantity, 0) ?? 0

  return { cart, loading, itemCount, refresh, addItem, updateItem, removeItem, clearCart }
}
