import { Navbar } from './Navbar.jsx'

export function Layout ({ children }) {
  return (
    <div className="min-h-screen bg-cream flex flex-col">
      <Navbar />
      <main className="flex-1 w-full max-w-[1280px] mx-auto px-10 py-10">
        {children}
      </main>
    </div>
  )
}
