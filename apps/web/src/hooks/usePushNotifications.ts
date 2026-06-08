"use client";
import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export function usePushNotifications() {
  const { user } = useAuth();
  const registered = useRef(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !user || registered.current) return;

    const init = async () => {
      try {
        const { PushNotifications } = await import("@capacitor/push-notifications");

        const perm = await PushNotifications.requestPermissions();
        if (perm.receive !== "granted") return;

        await PushNotifications.register();

        PushNotifications.addListener("registration", async ({ value: token }) => {
          if (!token) return;
          registered.current = true;
          try {
            await api("/users/push-token", {
              method: "POST",
              body: JSON.stringify({ token, platform: "android" }),
            });
          } catch {
            // Token registration is best-effort
          }
        });

        PushNotifications.addListener("registrationError", (err) => {
          console.warn("Push registration failed:", err);
        });

        // Foreground notification - show as local notification
        PushNotifications.addListener("pushNotificationReceived", async (notification) => {
          try {
            const { LocalNotifications } = await import("@capacitor/local-notifications");
            await LocalNotifications.schedule({
              notifications: [
                {
                  id: Date.now(),
                  title: notification.title ?? "FireSlot Nepal",
                  body: notification.body ?? "",
                  smallIcon: "ic_stat_notification",
                },
              ],
            });
          } catch {
            // Fallback: silently ignore if local notifications unavailable
          }
        });

        // Tap on notification - navigate
        PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
          const route = action.notification.data?.route;
          if (route && typeof window !== "undefined") {
            window.location.assign(route);
          }
        });
      } catch (e) {
        console.warn("Push init failed:", e);
      }
    };

    init();
  }, [user]);
}
