"use client";
import { useIsNativeApp } from "./useIsNativeApp";

type HapticFns = {
  light: () => Promise<void>;
  medium: () => Promise<void>;
  heavy: () => Promise<void>;
  success: () => Promise<void>;
  error: () => Promise<void>;
};

const noop = async () => {};

async function impact(style: "Light" | "Medium" | "Heavy") {
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    await Haptics.impact({ style: ImpactStyle[style] });
  } catch { /* ignore */ }
}

async function notification(type: "Success" | "Error") {
  try {
    const { Haptics, NotificationType } = await import("@capacitor/haptics");
    await Haptics.notification({ type: NotificationType[type] });
  } catch { /* ignore */ }
}

export function useHaptics(): HapticFns {
  const isNative = useIsNativeApp();
  if (!isNative) {
    return { light: noop, medium: noop, heavy: noop, success: noop, error: noop };
  }
  return {
    light: () => impact("Light"),
    medium: () => impact("Medium"),
    heavy: () => impact("Heavy"),
    success: () => notification("Success"),
    error: () => notification("Error"),
  };
}
