"use client";
import { useEffect } from "react";
import { useIsNativeApp } from "@/hooks/useIsNativeApp";
import { useLocalNotifications } from "@/hooks/useLocalNotifications";
import { useAndroidBackButton } from "@/hooks/useAndroidBackButton";

const APP_ORIGIN = "https://fire-shot-web.vercel.app";

export function NativeBootstrap() {
  const isNative = useIsNativeApp();
  // Hooks must be called unconditionally; the hook itself no-ops on web.
  useLocalNotifications();
  useAndroidBackButton();

  useEffect(() => {
    if (!isNative) return;
    let removeUrlListener: (() => void) | undefined;
    (async () => {
      try {
        const [{ App }, { Browser }] = await Promise.all([
          import("@capacitor/app"),
          import("@capacitor/browser").catch(() => ({ Browser: null as any })),
        ]);
        const handle = await App.addListener("appUrlOpen", (event) => {
          try {
            const url = new URL(event.url);
            const appUrl = new URL(APP_ORIGIN);
            const path = url.pathname.replace(/\/+$/, "") || "/";
            if (url.host !== appUrl.host || path !== "/login") return;
            const closePromise = Browser?.close?.();
            closePromise?.catch?.(() => {});
            window.location.assign(`/login${url.search}${url.hash}`);
          } catch {
            // Ignore non-URL deep-link payloads.
          }
        });
        removeUrlListener = () => handle.remove();
      } catch {
        // Deep-link bridge is best effort; in-WebView OAuth still works.
      }
      try {
        const { StatusBar, Style } = await import("@capacitor/status-bar");
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: "#0f0f0f" });
      } catch { /* ignore */ }
      try {
        const { SplashScreen } = await import("@capacitor/splash-screen");
        await SplashScreen.hide();
      } catch { /* ignore */ }
    })();
    return () => removeUrlListener?.();
  }, [isNative]);

  return null;
}
