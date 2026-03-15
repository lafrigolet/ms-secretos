import { createContext, useContext, useEffect } from 'react'
import { useAuth } from './AuthContext.jsx'
import { useCart } from '../hooks/useCart.js'

const CartContext = createContext(null)

export function CartProvider ({ children }) {
  const { isAuthenticated } = useAuth()
  const cartState = useCart()

  // Cargar la cesta al autenticarse
  useEffect(() => {
    if (isAuthenticated) cartState.refresh()
  }, [isAuthenticated])

  return (
    <CartContext.Provider value={cartState}>
      {children}
    </CartContext.Provider>
  )
}

export function useCartContext () {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCartContext must be used within CartProvider')
  return ctx
}
