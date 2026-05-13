"use client";
import { Capacitor } from "@capacitor/core";

export const useIsNativeApp = () => {
  if (typeof window === "undefined") return false;
  try {
    if (Capacitor.isNativePlatform()) return true;
  } catch {}
  // Fallback: detect Android WebView user agent when Capacitor bridge isn't ready
  const ua = navigator.userAgent || "";
  if (ua.includes("wv") || (ua.includes("Android") && ua.includes("Version/"))) return true;
  return false;
};

export const isAndroid = () => {
  if (typeof window === "undefined") return false;
  try { return Capacitor.getPlatform() === "android"; } catch {}
  return /Android/i.test(navigator.userAgent || "");
};
