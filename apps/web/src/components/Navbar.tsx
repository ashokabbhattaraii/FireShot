"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  Bell,
  Flame,
  ListChecks,
  LogOut,
  Shield,
  Wallet,
} from "lucide-react";
import { ViewportToggle } from "./ViewportToggle";
import { api } from "@/lib/api";

export function Navbar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!user) return;
    api<any>("/wallet").then((d) => setWalletBalance(d?.wallet?.balanceNpr ?? 0)).catch(() => {});
    api<any[]>("/notifications").then((items) => setUnread(items.filter((n: any) => !n.read).length)).catch(() => {});
  }, [user]);

  if (pathname.startsWith('/admin')) return null;

  return (
    <header
      className="sticky top-0 z-40 border-b transition-all duration-200"
      style={{
        background: scrolled ? 'rgba(11,11,20,0.95)' : 'var(--fs-bg)',
        borderColor: 'var(--fs-border)',
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
        paddingTop: 'var(--fs-safe-top)',
      }}
    >
      <div className="flex items-center justify-between px-4" style={{ height: '56px' }}>
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: 'var(--fs-red-glow)' }}>
            <Flame size={20} style={{ color: 'var(--fs-red)' }} />
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-base font-bold" style={{ color: 'var(--fs-text-1)' }}>FireSlot</span>
            <span className="text-[10px] font-bold" style={{ color: 'var(--fs-red)' }}>NEPAL</span>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          <ViewportToggle compact />
          {user && walletBalance !== null && (
            <Link
              href="/wallet"
              className="flex items-center gap-1 rounded-full px-3 py-1.5"
              style={{ background: 'var(--fs-gold-dim)', border: '1px solid rgba(255,215,0,0.2)' }}
            >
              <span style={{ color: 'var(--fs-gold)', fontSize: '12px' }}>₹</span>
              <span className="text-xs font-bold" style={{ color: 'var(--fs-gold)' }}>{walletBalance}</span>
            </Link>
          )}
          {user ? (
            <>
              <Link
                href="/notifications"
                className="relative flex h-9 w-9 items-center justify-center rounded-lg"
                style={{ background: 'var(--fs-surface-2)', border: '1px solid var(--fs-border)' }}
                aria-label="Notifications"
              >
                <Bell size={17} style={{ color: 'var(--fs-text-2)' }} />
                {unread > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ background: 'var(--fs-red)' }}>
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </Link>
              <Link
                href="/my-matches"
                className="flex h-9 w-9 items-center justify-center rounded-lg"
                style={{ background: 'var(--fs-surface-2)', border: '1px solid var(--fs-border)' }}
                aria-label="My Matches"
              >
                <ListChecks size={17} style={{ color: 'var(--fs-text-2)' }} />
              </Link>
              {user.role !== "PLAYER" && (
                <Link
                  href="/admin"
                  className="flex h-9 w-9 items-center justify-center rounded-lg"
                  style={{ background: 'var(--fs-amber-dim)', border: '1px solid rgba(255,143,0,0.3)' }}
                  aria-label="Admin"
                >
                  <Shield size={17} style={{ color: 'var(--fs-amber)' }} />
                </Link>
              )}
              <NavAvatar src={user.avatarUrl} />
              <button
                onClick={logout}
                className="flex h-9 w-9 items-center justify-center rounded-lg"
                style={{ background: 'var(--fs-surface-2)', border: '1px solid var(--fs-border)' }}
                aria-label="Logout"
              >
                <LogOut size={17} style={{ color: 'var(--fs-text-3)' }} />
              </button>
            </>
          ) : (
            <Link href="/login" className="fs-btn fs-btn-primary fs-btn-sm">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

function NavAvatar({ src }: { src?: string | null }) {
  const [bad, setBad] = useState(false);
  if (!src || bad) return null;
  return (
    <img
      src={src}
      alt=""
      onError={() => setBad(true)}
      className="h-9 w-9 rounded-lg object-cover"
      style={{ border: '1px solid var(--fs-border)' }}
    />
  );
}
