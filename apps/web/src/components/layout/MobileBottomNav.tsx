"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Home, ListChecks, Trophy, Swords, UserCircle } from "lucide-react";
import { useIsNativeApp } from "@/hooks/useIsNativeApp";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { useUserRealtime } from "@/hooks/useUserRealtime";

const TABS = [
  { href: "/", label: "Home", Icon: Home },
  { href: "/tournaments", label: "Tournaments", Icon: Trophy },
  { href: "/challenges", label: "Challenges", Icon: Swords },
  { href: "/my-matches", label: "My Matches", Icon: ListChecks },
  { href: "/dashboard", label: "Profile", Icon: UserCircle },
];

export function MobileBottomNav() {
  const isNative = useIsNativeApp();
  const pathname = usePathname();
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) return;
    api<any[]>("/notifications")
      .then((items) => setUnread(items.filter((n: any) => !n.read).length))
      .catch(() => {});
  }, [user, pathname]);

  useUserRealtime({
    onNotification: () => setUnread((n) => n + 1),
  });

  if (pathname.startsWith('/admin')) return null;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 grid grid-cols-5"
      style={{
        background: 'rgba(11,11,20,0.97)',
        backdropFilter: 'blur(12px)',
        borderTop: '0.5px solid var(--fs-border)',
        paddingBottom: isNative ? 'env(safe-area-inset-bottom, 16px)' : '4px',
        height: isNative ? 'calc(60px + env(safe-area-inset-bottom, 16px))' : '64px',
      }}
    >
      {TABS.map((t) => {
        const { Icon } = t;
        const active = t.href === "/" ? pathname === "/" : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className="relative flex flex-col items-center justify-center gap-0.5"
            style={{ minHeight: '44px' }}
          >
            {active && (
              <span
                className="absolute top-0 left-1/2 -translate-x-1/2 h-[3px] w-5 rounded-full"
                style={{ background: 'var(--fs-red)' }}
              />
            )}
            <Icon size={20} style={{ color: active ? 'var(--fs-red)' : 'var(--fs-text-3)' }} />
            <span
              className="text-[10px] font-medium"
              style={{ color: active ? 'var(--fs-red)' : 'var(--fs-text-3)' }}
            >
              {t.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
