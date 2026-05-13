import { App } from "@capacitor/app";

export interface UpdateCheckResult {
  updateAvailable: boolean;
  currentVersion: string;
  latestVersion: string;
  downloadUrl: string | null;
  forceUpdate: boolean;
  releaseNotes: string | null;
}

let _versionCache: string | null = null;

/**
 * Get the current app version from the APK filename or fallback
 */
export async function getCurrentAppVersion(): Promise<string> {
  if (_versionCache) return _versionCache;

  try {
    // Try to get version from native app info
    const appInfo = await App.getInfo();
    _versionCache = appInfo.version;
    return appInfo.version;
  } catch (e) {
    // Fallback to 0.0.0 if running in browser
    return "0.0.0";
  }
}

/**
 * Parse version string into comparable parts
 * E.g., "1.0.86-129a789" -> { major: 1, minor: 0, patch: 86, prerelease: "129a789" }
 */
function parseVersion(version: string) {
  const [main, prerelease] = version.split("-");
  const [major = 0, minor = 0, patch = 0] = main.split(".").map(Number);
  return { major, minor, patch, prerelease: prerelease || null };
}

/**
 * Compare two versions: returns 1 if v1 > v2, -1 if v1 < v2, 0 if equal
 */
export function compareVersions(v1: string, v2: string): number {
  const p1 = parseVersion(v1);
  const p2 = parseVersion(v2);

  if (p1.major !== p2.major) return p1.major > p2.major ? 1 : -1;
  if (p1.minor !== p2.minor) return p1.minor > p2.minor ? 1 : -1;
  if (p1.patch !== p2.patch) return p1.patch > p2.patch ? 1 : -1;

  return 0; // Ignore prerelease for now
}

/**
 * Check for app updates by calling the backend config endpoint
 */
export async function checkForUpdates(
  apiUrl: string = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001",
): Promise<UpdateCheckResult> {
  const currentVersion = await getCurrentAppVersion();

  try {
    const response = await fetch(`${apiUrl}/app/config`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch app config: ${response.statusText}`);
    }

    const data = await response.json();
    const latestVersion = data.update?.latestVersion || currentVersion;
    const downloadUrl = normalizeDownloadUrl(data.update?.downloadUrl || null, apiUrl);
    const forceUpdate = data.update?.force || false;
    const releaseNotes = data.releaseNotes || null;

    const versionComparison = compareVersions(latestVersion, currentVersion);

    return {
      updateAvailable: versionComparison > 0,
      currentVersion,
      latestVersion,
      downloadUrl,
      forceUpdate,
      releaseNotes,
    };
  } catch (error) {
    console.error("Error checking for updates:", error);
    return {
      updateAvailable: false,
      currentVersion,
      latestVersion: currentVersion,
      downloadUrl: null,
      forceUpdate: false,
      releaseNotes: null,
    };
  }
}

/**
 * Download APK and open in system for installation
 * On Android, this will trigger the native APK installer
 */
export async function downloadAndInstallAPK(
  downloadUrl: string,
): Promise<void> {
  try {
    // For web, open the download URL in a new window
    window.open(downloadUrl, "_blank");

    // On native Android, we could use FileOpener or just open the URL
    // The native intent handler will take care of installation
  } catch (error) {
    console.error("Error downloading APK:", error);
    throw error;
  }
}

function normalizeDownloadUrl(downloadUrl: string | null, apiUrl: string): string | null {
  if (!downloadUrl) return null;
  if (/^https?:\/\//i.test(downloadUrl)) return downloadUrl;
  const apiBase = apiUrl.replace(/\/+$/, "").replace(/\/api$/, "");
  const cleanPath = downloadUrl.replace(/^\/+/, "").replace(/^(downloads\/)+/, "");
  return `${apiBase}/downloads/${cleanPath}`;
}

/**
 * Periodically check for updates (call this in a useEffect)
 */
export async function startUpdateCheckInterval(
  callback: (result: UpdateCheckResult) => void,
  intervalMs: number = 6 * 60 * 60 * 1000, // 6 hours
): Promise<() => void> {
  const checkAndNotify = async () => {
    const result = await checkForUpdates();
    callback(result);
  };

  // Check immediately on start
  await checkAndNotify();

  // Then check periodically
  const intervalId = setInterval(checkAndNotify, intervalMs);

  // Return cleanup function
  return () => clearInterval(intervalId);
}
