export function Logo ({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 90" fill="none">
      <polygon points="50,5 95,27.5 95,72.5 50,95 5,72.5 5,27.5" fill="#4A5740" />
      <circle cx="50" cy="51" r="6" fill="#C8D4BE" />
    </svg>
  )
}
