import { useState, useEffect } from 'react'

const MOBILE_BREAKPOINT = 768

const isIPad = () =>
  /iPad/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

export function useIsMobile () {
  const [isMobile, setIsMobile] = useState(
    () => window.innerWidth < MOBILE_BREAKPOINT || isIPad()
  )

  useEffect(() => {
    if (isIPad()) {
      setIsMobile(true)
      return
    }
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const handler = (e) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    setIsMobile(mq.matches)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return isMobile
}
