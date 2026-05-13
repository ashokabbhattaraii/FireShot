'use client'

export function MaintenanceScreen({ message }: { message?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-6">
      <div className="card max-w-md text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-neon-cyan/40 bg-neon-cyan/10 text-neon-cyan">
          🔧
        </div>
        <h1 className="font-display text-2xl text-white">Under Maintenance</h1>
        <p className="mt-3 text-white/70">{message || 'FireSlot Nepal is being updated. Please try again soon.'}</p>
      </div>
    </div>
  )
}
