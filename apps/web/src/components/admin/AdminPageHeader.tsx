import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";

export function AdminPageHeader({
  back,
  backLabel = "Back",
  eyebrow,
  title,
  subtitle,
  action,
}: {
  back?: string;
  backLabel?: string;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6">
      {back && (
        <Link
          href={back}
          className="mb-3 inline-flex items-center gap-1 text-sm text-white/50 hover:text-white transition-colors"
        >
          <ChevronLeft size={16} />
          {backLabel}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && (
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-white/40">
              {eyebrow}
            </p>
          )}
          <h1 className="text-2xl font-bold text-white">{title}</h1>
          {subtitle && (
            <p className="mt-1 text-sm text-white/55">{subtitle}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="mt-4 h-px bg-white/[0.07]" />
    </div>
  );
}
