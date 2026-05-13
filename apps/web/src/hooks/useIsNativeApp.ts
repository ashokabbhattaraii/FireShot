"use client";
import { Capacitor } from "@capacitor/core";

export const useIsNativeApp = () => {
  if (typeof window === "undefined") return false;
  try {
    return Capacitor.isNativePlatform();
  } catch {}
  return false;
};

export const isAndroid = () => {
  if (typeof window === "undefined") return false;
  try { return Capacitor.getPlatform() === "android"; } catch {}
  return /Android/i.test(navigator.userAgent || "");
};
