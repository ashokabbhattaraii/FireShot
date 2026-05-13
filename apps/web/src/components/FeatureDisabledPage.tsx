"use client";

export function FeatureDisabledPage({ name }: { name: string }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center" style={{ maxWidth: 340 }}>
        <div
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl text-3xl"
          style={{ background: "var(--fs-surface-2)" }}
        >
          🚧
        </div>
        <h1 className="fs-h1 mt-4">{name} Unavailable</h1>
        <p
          className="mt-2 text-sm"
          style={{ color: "var(--fs-text-3)" }}
        >
          This feature is temporarily disabled. Please check back soon.
        </p>
      </div>
    </div>
  );
}
