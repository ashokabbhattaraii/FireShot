import "./globals.css";
import type { Metadata } from "next";
import Script from "next/script";
import { Navbar } from "@/components/Navbar";
import { Providers } from "./providers";
import { AppShell } from "@/components/AppShell";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { NativeBootstrap } from "@/components/NativeBootstrap";
import dynamic from 'next/dynamic'
import { RootClient } from '@/components/RootClient'

const ApkTestPanel = dynamic(() => import('@/components/admin/ApkTestPanel'), { ssr: false })

export const metadata: Metadata = {
  title: "FireSlot Nepal — Free Fire Tournaments",
  description:
    "Join paid Free Fire tournaments in NPR. Compete. Win. Withdraw.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return (
    <html lang="en" className="dark">
      <head>
        <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,viewport-fit=cover" />
        <meta name="theme-color" content="#0B0B14" />
        <script dangerouslySetInnerHTML={{ __html: `if(!window.CSS||!CSS.supports('overscroll-behavior','none'))document.documentElement.style.overflow='hidden'` }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        {apiUrl && <link rel="preconnect" href={new URL(apiUrl).origin} crossOrigin="" />}
        {supaUrl && <link rel="preconnect" href={supaUrl} crossOrigin="" />}
        {supaUrl && <link rel="dns-prefetch" href={supaUrl} />}
      </head>
      <body>
        <Script id="sw-register" strategy="afterInteractive">
          {`
            var isNative = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
            var isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            var isProdWeb = !isLocalhost && window.location.protocol === 'https:';
            if (!isNative && 'serviceWorker' in navigator) {
              window.addEventListener('load', function () {
                if (isProdWeb) {
                  navigator.serviceWorker.register('/sw.js').catch(function () {});
                  return;
                }

                // Dev safety: clear old SW/caches so Next dev chunks are never served stale.
                navigator.serviceWorker.getRegistrations().then(function (regs) {
                  regs.forEach(function (reg) { reg.unregister(); });
                }).catch(function () {});

                if ('caches' in window) {
                  caches.keys().then(function (keys) {
                    keys.forEach(function (key) { caches.delete(key); });
                  }).catch(function () {});
                }
              });
            }
          `}
        </Script>
        <Providers>
          <NativeBootstrap />
          <AppShell>
            <Navbar />
            <RootClient>
              <main className="fs-page fs-pb-safe">
                {children}
              </main>
            </RootClient>
            <MobileBottomNav />
            <ApkTestPanel />
          </AppShell>
        </Providers>
      </body>
    </html>
  );
}
