"use client"

import { useEffect, useState } from 'react'
import { GoogleAuthPanel } from '@/components/GoogleAuthPanel'
import { config } from '@/lib/config'
import { Flame } from 'lucide-react'

export default function LoginPage() {
  const [ready, setReady] = useState(!!config.googleClientId)

  useEffect(() => {
    if (ready) return
    let tries = 0
    const check = () => {
      const id = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? ''
      if (id) { setReady(true); return }
      if (++tries < 5) setTimeout(check, 600)
      else setReady(true)
    }
    check()
  }, [ready])

  if (!ready) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div
            className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl animate-pulse"
            style={{ background: 'var(--fs-red-glow)' }}
          >
            <Flame size={24} style={{ color: 'var(--fs-red)' }} />
          </div>
          <p className="mt-4 text-sm" style={{ color: 'var(--fs-text-3)' }}>Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full" style={{ maxWidth: '380px' }}>
        <div className="text-center mb-6">
          <div
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl"
            style={{ background: 'var(--fs-red-glow)' }}
          >
            <Flame size={28} style={{ color: 'var(--fs-red)' }} />
          </div>
          <h1 className="fs-h1 mt-4">Sign in to FireSlot</h1>
          <p className="fs-body mt-2" style={{ color: 'var(--fs-text-3)' }}>
            Nepal&apos;s #1 Free Fire tournament platform
          </p>
        </div>

        <div className="fs-divider" />

        <div className="mt-6">
          <GoogleAuthPanel title="" next="/dashboard" />
        </div>

        <p className="mt-6 text-center text-[11px]" style={{ color: 'var(--fs-text-3)' }}>
          By signing in you agree to our Terms & Privacy Policy
        </p>
      </div>
    </div>
  )
}
