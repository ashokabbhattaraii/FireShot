import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:gap-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="label">{eyebrow}</p>}
        <h1 className="break-words font-display text-2xl text-white sm:text-3xl md:text-4xl">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/60">{description}</p>
        )}
      </div>
      {action ? <div className="w-full md:w-auto md:max-w-[50%]">{action}</div> : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  href,
  action,
}: {
  title: string;
  description?: string;
  href?: string;
  action?: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-surface/50 p-8 text-center">
      <p className="font-semibold text-white">{title}</p>
      {description && (
        <p className="mx-auto mt-2 max-w-md text-sm text-white/60">
          {description}
        </p>
      )}
      {href && action && (
        <Link href={href} className="btn-outline mt-4">
          {action}
        </Link>
      )}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "LIVE" ||
    status === "APPROVED" ||
    status === "PAID" ||
    status === "CREDIT"
      ? "border-neon-green/50 bg-neon-green/10 text-neon-green"
      : status === "REJECTED" || status === "CANCELLED" || status === "DEBIT"
        ? "border-red-400/50 bg-red-500/10 text-red-300"
        : status === "PENDING" || status === "UPCOMING" || status === "OPEN" || status === "PENDING_RESULTS"
          ? "border-neon-orange/50 bg-neon-orange/10 text-neon-orange"
          : "border-white/20 bg-white/5 text-white/60";

  return (
    <span
      className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-semibold ${tone}`}
    >
      {status}
    </span>
  );
}

export function LoadingState({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card/70 p-6 text-sm text-white/60">
      <InlineLoading label={label} />
    </div>
  );
}

export function InlineLoading({ label = "Loading..." }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-white/60">
      <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white/20 border-t-neon-cyan" />
      <span>{label}</span>
    </span>
  );
}

export function ButtonLoading({
  loading,
  children,
  loadingText = "Working...",
}: {
  loading?: boolean;
  children: ReactNode;
  loadingText?: string;
}) {
  if (!loading) return <>{children}</>;
  return <InlineLoading label={loadingText} />;
}

export function PageLoading({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex min-h-[45vh] items-center justify-center">
      <LoadingState label={label} />
    </div>
  );
}

export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="rounded-lg border border-border bg-card/70 p-4">
      <div className="h-4 w-1/3 animate-pulse rounded bg-white/10" />
      <div className="mt-4 space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="h-3 animate-pulse rounded bg-white/10"
            style={{ width: `${90 - i * 14}%` }}
          />
        ))}
      </div>
    </div>
  );
}

export function CardGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} lines={4} />
      ))}
    </div>
  );
}

export function TableLoading({
  columns = 4,
  rows = 5,
}: {
  columns?: number;
  rows?: number;
}) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>
              {Array.from({ length: columns }).map((__, c) => (
                <td key={c}>
                  <div className="h-3 w-full animate-pulse rounded bg-white/10" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
