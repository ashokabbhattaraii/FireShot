'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { API_BASE } from '@/lib/api'

export function SplashScreen({ onComplete }: { onComplete: () => void }) {
  const [banner, setBanner] = useState<any>(null)
  const [phase, setPhase] = useState<'enter' | 'hold' | 'exit'>('enter')

  useEffect(() => {
    fetch(`${API_BASE}/banners/splash`)
      .then((r) => r.json())
      .then((b) => setBanner(b))
      .catch(() => {})

    const t1 = setTimeout(() => setPhase('hold'), 400)
    return () => clearTimeout(t1)
  }, [])

  const handleExit = () => {
    setPhase('exit')
    setTimeout(onComplete, 350)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg">
      <div className="text-center">
        <div className="text-6xl">🔥</div>
        <h1 className="font-display text-3xl mt-2">FireSlot NEPAL</h1>
        {banner?.imageUrl && (
          <div className="mt-4">
            <img src={banner.imageUrl} alt={banner.title || 'splash'} className="max-w-xs mx-auto" />
            {banner.title && <div className="mt-2 font-semibold">{banner.title}</div>}
          </div>
        )}
        <div className="mt-6 text-sm text-white/60">Initializing...</div>
        <div className="mt-4">
          <button className="btn-primary mt-4" onClick={handleExit}>Continue</button>
        </div>
      </div>
    </div>
  )
}
