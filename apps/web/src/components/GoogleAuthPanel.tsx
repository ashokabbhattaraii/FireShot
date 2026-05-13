"use client";

import { useGoogleLogin } from "@react-oauth/google";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, auth, API_BASE } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { InlineLoading } from "@/components/ui";
import { useIsNativeApp } from "@/hooks/useIsNativeApp";

const LOGIN_LOG_KEY = "fireslot_login_logs";

function isAndroidWebView(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return ua.includes("wv") || (ua.includes("Android") && ua.includes("Version/"));
}

function loginLog(event: string, details: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  const entry = {
    event,
    details,
    at: new Date().toISOString(),
    native: isAndroidWebView(),
    href: window.location.href,
  };
  try {
    const current = JSON.parse(localStorage.getItem(LOGIN_LOG_KEY) || "[]");
    localStorage.setItem(LOGIN_LOG_KEY, JSON.stringify([entry, ...current].slice(0, 25)));
  } catch {
    localStorage.setItem(LOGIN_LOG_KEY, JSON.stringify([entry]));
  }
  fetch(`${API_BASE}/app/client-log`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry),
    keepalive: true,
  }).catch(() => {});
}

function userFriendlyGoogleError(error: string) {
  if (error.includes("redirect_uri_mismatch")) {
    return "Google sign-in is blocked because the APK redirect URL is not allowed in Google Console. Update the OAuth redirect URI and try again.";
  }
  if (error.startsWith("Invalid `") || error.includes("PrismaClient")) {
    return "Sign-in service is updating. Please try again in a moment.";
  }
  return error;
}

export function GoogleAuthPanel({
  title = "Continue with Google",
  next = "/dashboard",
  showReferral = false,
}: {
  title?: string;
  next?: string;
  showReferral?: boolean;
}) {
  const router = useRouter();
  const { refresh } = useAuth();
  const isNative = useIsNativeApp();
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [referralCode, setReferralCode] = useState("");

  const signIn = useCallback(async (payload: { credential?: string; accessToken?: string }) => {
    if (!payload.credential && !payload.accessToken) {
      setErr("Google sign-in did not return a token");
      return;
    }
    setErr(null);
    setLoading(true);
    try {
      const normalizedReferral = referralCode
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "");
      if (showReferral && normalizedReferral && !/^[A-Z0-9]{6}$/.test(normalizedReferral)) {
        setErr("Referral code must be exactly 6 letters or digits");
        setLoading(false);
        return;
      }

      const res: any = await api("/auth/google", {
        method: "POST",
        body: JSON.stringify({
          ...payload,
          referralCode: showReferral ? normalizedReferral || undefined : undefined,
        }),
      });
      const nextToken = res?.token ?? res?.accessToken ?? res?.jwt ?? res?.data?.token;
      if (!nextToken) {
        throw new Error("Google sign-in succeeded but no auth token was returned");
      }
      auth.setToken(nextToken);
      await refresh();

      if (res?.needsReferralOnboarding) {
        router.push(`/onboarding/referral?next=${encodeURIComponent(next)}`);
        return;
      }

      const roleName = String(res?.user?.roleRef?.name ?? res?.user?.role ?? "").toUpperCase();
      const roleLanding =
        roleName === "SUPPORT"
          ? "/admin/support"
          : roleName === "FINANCE"
            ? "/admin/payments"
            : roleName && roleName !== "PLAYER"
              ? "/admin"
              : next;
      router.push(roleLanding);
    } catch (e: any) {
      const message = userFriendlyGoogleError(e.message ?? "Google sign-in failed");
      loginLog("google_api_error", { message });
      setErr(message);
    } finally {
      setLoading(false);
    }
  }, [next, referralCode, refresh, router, showReferral]);

  // Handle OAuth redirect — token comes back in URL hash fragment
  useEffect(() => {
    if (typeof window === "undefined") return;
    const current = new URL(window.location.href);
    const oauthError =
      current.searchParams.get("error") ||
      new URLSearchParams(window.location.hash.replace(/^#/, "")).get("error");
    if (oauthError) {
      const description =
        current.searchParams.get("error_description") ||
        new URLSearchParams(window.location.hash.replace(/^#/, "")).get("error_description") ||
        oauthError;
      const cleanUrl = `${window.location.pathname}`;
      window.history.replaceState({}, document.title, cleanUrl);
      loginLog("google_redirect_error", { error: oauthError, description });
      setErr(userFriendlyGoogleError(description));
      return;
    }
    if (!window.location.hash.includes("access_token")) return;

    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const token = params.get("access_token");
    if (!token) return;

    const cleanUrl = `${window.location.pathname}${window.location.search}`;
    window.history.replaceState({}, document.title, cleanUrl);
    loginLog("google_redirect_token_received");
    void signIn({ accessToken: token });
  }, [signIn]);

  // Popup-based login — works in Capacitor WebView (no iframe)
  const googleLogin = useGoogleLogin({
    onSuccess: (tokenResponse) => signIn({ accessToken: tokenResponse.access_token }),
    onError: () => setErr("Google sign-in failed or was cancelled"),
    flow: "implicit",
  });

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const startNativeGoogleLogin = () => {
    if (!clientId || typeof window === "undefined") return;

    const configuredRedirect = (process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI || "")
      .trim()
      .replace(/\/+$/, "");
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
    const origin = appUrl || window.location.origin.replace(/\/$/, "");
    const redirectUri = configuredRedirect || `${origin}/login`;

    const oauthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    oauthUrl.searchParams.set("client_id", clientId);
    oauthUrl.searchParams.set("redirect_uri", redirectUri);
    oauthUrl.searchParams.set("response_type", "token");
    oauthUrl.searchParams.set("scope", "openid email profile");
    oauthUrl.searchParams.set("prompt", "select_account");
    oauthUrl.searchParams.set("include_granted_scopes", "true");
    oauthUrl.searchParams.set("state", crypto.randomUUID?.() ?? String(Date.now()));

    loginLog("google_native_start", { redirectUri, origin });
    window.location.assign(oauthUrl.toString());
  };

  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-xl space-y-4">
      {title && (
        <div>
          <p className="label">Google Account Required</p>
          <h1 className="font-display text-2xl neon-text">{title}</h1>
        </div>
      )}
      {showReferral && (
        <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-3">
          <label className="label">Referral code (6 letters/digits)</label>
          <input
            className="input mt-2 font-mono uppercase tracking-[0.2em]"
            maxLength={6}
            placeholder="ABC123"
            autoComplete="off"
            value={referralCode}
            onChange={(e) => setReferralCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
          />
          <p className="mt-2 text-xs text-amber-100/80">
            Paste a friend&apos;s 6-character code now to get Rs 10. This only works during first signup.
          </p>
        </div>
      )}
      {clientId ? (
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              if (loading) return;
              if (isNative) {
                startNativeGoogleLogin();
                return;
              }
              googleLogin();
            }}
            disabled={loading}
            className="flex w-full items-center justify-center gap-3 rounded-md bg-white px-4 py-3 text-sm font-semibold text-gray-800 shadow transition hover:bg-gray-50 active:scale-95 disabled:opacity-60"
            style={{ minHeight: 44 }}
          >
            {/* Google "G" logo */}
            <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
              <g fill="none" fillRule="evenodd">
                <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </g>
            </svg>
            {loading ? "Signing in..." : "Continue with Google"}
          </button>
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center rounded-md bg-black/50">
              <InlineLoading label="Signing you in..." />
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-md border border-neon-orange/40 bg-neon-orange/10 px-3 py-6 text-sm text-neon-orange text-center">
          <div className="mb-2">Loading sign-in configuration...</div>
          <div className="text-xs text-white/60">If this persists, contact the app maintainer.</div>
        </div>
      )}
      {err && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs leading-relaxed text-red-200">
          {err}
        </div>
      )}
    </div>
  );
}
