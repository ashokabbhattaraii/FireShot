"use client"
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function NotFound() {
  const router = useRouter()

  useEffect(() => {
    const t = setTimeout(() => router.replace('/'), 3000)
    return () => clearTimeout(t)
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md text-center">
        <div className="text-6xl">🎮</div>
        <h1 className="mt-4 text-2xl font-bold">Page Not Found</h1>
        <p className="mt-2 text-sm text-muted-foreground">Redirecting to home in 3 seconds...</p>
        <div className="mt-6">
          <button
            onClick={() => router.replace('/')}
            style={{
              marginTop: '1.5rem',
              background: '#E53935',
              color: 'white',
              padding: '12px 28px',
              borderRadius: '8px',
              border: 'none',
              fontWeight: 'bold',
              fontSize: '15px',
              cursor: 'pointer',
            }}
          >
            Go Home Now
          </button>
        </div>
      </div>
    </div>
  )
}
