"use client";

import { GoogleOAuthProvider } from "@react-oauth/google";
import { AuthProvider } from "@/lib/auth-context";
import { ViewportProvider } from "@/lib/viewport-context";
import { ToastProvider } from "@/lib/toast";
import { SWRProvider } from "@/lib/swr-config";
import { UpdateProvider } from "@/lib/update-context";
import { AppConfigGate } from "@/components/AppConfigGate";

export function Providers({ children }: { children: React.ReactNode }) {
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <SWRProvider>
        <AuthProvider>
          <ViewportProvider>
            <ToastProvider>
              <UpdateProvider>
                <AppConfigGate>{children}</AppConfigGate>
              </UpdateProvider>
            </ToastProvider>
          </ViewportProvider>
        </AuthProvider>
      </SWRProvider>
    </GoogleOAuthProvider>
  );
}
