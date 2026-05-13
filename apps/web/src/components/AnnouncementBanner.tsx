'use client'

export function AnnouncementBanner({ text, color }: { text?: string; color?: string }) {
  if (!text) return null
  return (
    <div style={{ background: color || '#E53935' }} className="w-full px-3 py-1.5 text-center text-xs font-medium text-white">
      {text}
    </div>
  )
}
