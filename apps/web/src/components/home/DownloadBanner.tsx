"use client";
import { useEffect, useState } from "react";
import { Download, Smartphone } from "lucide-react";
import { useIsNativeApp } from "@/hooks/useIsNativeApp";
import { api, FILE_BASE } from "@/lib/api";

interface LatestRelease {
  version: string;
  downloadUrl: string;
  releaseNotes?: string | null;
}

const FALLBACK_FILENAME = "fireslot-nepal.apk";
const FALLBACK_VERSION = "1.0.0";

export function DownloadBanner() {
  const isNative = useIsNativeApp();
  const [release, setRelease] = useState<LatestRelease | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [cacheBust] = useState(() => Date.now().toString());

  useEffect(() => {
    if (isNative) return;
    let cancelled = false;

    (async () => {
      // 1) Try the registered release in the DB.
      try {
        const r = await api<LatestRelease | null>("/app/latest-release");
        if (r?.downloadUrl && !cancelled) {
          setRelease(r);
          return;
        }
      } catch {
        /* fall through */
      }

      // 2) Fall back to the canonical static path on the API host.
      const fallbackUrl = `${FILE_BASE}/downloads/${FALLBACK_FILENAME}`;
      try {
        const head = await fetch(fallbackUrl, { method: "HEAD" });
        if (!cancelled && head.ok) {
          setRelease({
            version: FALLBACK_VERSION,
            downloadUrl: `/downloads/${FALLBACK_FILENAME}`,
          });
        }
      } catch {
        /* keep release null */
      }
    })().finally(() => !cancelled && setLoaded(true));

    return () => { cancelled = true; };
  }, [isNative]);

  if (isNative) return null;

  const rawDownloadHref = release?.downloadUrl
    ? release.downloadUrl.startsWith("http")
      ? release.downloadUrl
      : `${FILE_BASE}${release.downloadUrl}`
    : `${FILE_BASE}/downloads/${FALLBACK_FILENAME}`;
  const downloadHref = withDownloadVersion(rawDownloadHref, release?.version ?? cacheBust);

  return (
    <section className="rounded-lg border border-neon/40 bg-gradient-to-r from-neon/10 via-surface to-neon-cyan/10 p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-neon/20 text-neon">
            <Smartphone size={24} />
          </div>
          <div className="min-w-0">
            <h3 className="font-display text-base text-white">FireSlot Nepal</h3>
            <p className="text-sm text-white/70">Play on Android</p>
            <p className="text-xs text-neon-cyan">
              Free Download
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <div className="flex items-center gap-2">
            <a
              href={downloadHref}
              download
              className="btn-primary text-xs flex items-center gap-1"
            >
              <Download size={14} /> Download APK
            </a>
            <span className="rounded-md border border-border bg-surface px-2 py-0.5 text-[10px] text-white/50">
              Play Store · Soon
            </span>
          </div>
          <p className="text-[10px] text-white/40">
            {loaded && release
              ? `v${release.version} • Android 7.0+ • 15MB`
              : "Android 7.0+ • APK"}
          </p>
        </div>
      </div>
    </section>
  );
}

function withDownloadVersion(url: string, version: string) {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}v=${encodeURIComponent(version)}`;
}
