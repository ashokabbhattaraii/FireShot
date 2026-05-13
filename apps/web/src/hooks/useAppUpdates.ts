"use client";

import { useEffect, useState, useCallback } from "react";
import { UpdateCheckResult, checkForUpdates, downloadAndInstallAPK } from "@/lib/update-checker";
import { useToast } from "@/lib/toast";

interface UseAppUpdatesReturn {
  updateAvailable: boolean;
  latestVersion: string;
  currentVersion: string;
  downloadUrl: string | null;
  forceUpdate: boolean;
  releaseNotes: string | null;
  installUpdate: () => Promise<void>;
  dismissUpdate: () => void;
  isChecking: boolean;
  error: string | null;
}

/**
 * Hook to manage app update checking and installation
 */
export function useAppUpdates(): UseAppUpdatesReturn {
  const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const { success, error: showError } = useToast();

  const checkUpdates = useCallback(async () => {
    try {
      setIsChecking(true);
      setError(null);
      const result = await checkForUpdates();
      setUpdateResult(result);

      if (result.updateAvailable && !dismissed) {
        success(`Update available: ${result.latestVersion}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to check for updates";
      setError(message);
      showError(message);
    } finally {
      setIsChecking(false);
    }
  }, [success, showError, dismissed]);

  const installUpdate = useCallback(async () => {
    if (!updateResult?.downloadUrl) {
      showError("Download URL not available");
      return;
    }

    try {
      setIsInstalling(true);
      await downloadAndInstallAPK(updateResult.downloadUrl);
      success("Opening download...");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to download update";
      showError(message);
    } finally {
      setIsInstalling(false);
    }
  }, [updateResult?.downloadUrl, success, showError]);

  const dismissUpdate = useCallback(() => {
    setDismissed(true);
    setUpdateResult(null);
  }, []);

  // Check for updates on mount and set up periodic checks
  useEffect(() => {
    // Initial check
    checkUpdates();

    // Periodic check every 6 hours
    const intervalId = setInterval(checkUpdates, 6 * 60 * 60 * 1000);

    return () => clearInterval(intervalId);
  }, [checkUpdates]);

  return {
    updateAvailable: updateResult?.updateAvailable && !dismissed ? true : false,
    latestVersion: updateResult?.latestVersion || "unknown",
    currentVersion: updateResult?.currentVersion || "unknown",
    downloadUrl: updateResult?.downloadUrl || null,
    forceUpdate: updateResult?.forceUpdate || false,
    releaseNotes: updateResult?.releaseNotes || null,
    installUpdate,
    dismissUpdate,
    isChecking,
    error,
  };
}
