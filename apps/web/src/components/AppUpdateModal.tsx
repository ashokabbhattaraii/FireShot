"use client";

import { useState } from "react";
import { Download, AlertCircle, Check } from "lucide-react";

interface AppUpdateModalProps {
  isVisible: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseNotes?: string | null;
  isForce?: boolean;
  isInstalling?: boolean;
  onInstall: () => Promise<void>;
  onDismiss: () => void;
}

export function AppUpdateModal({
  isVisible,
  currentVersion,
  latestVersion,
  releaseNotes,
  isForce = false,
  isInstalling = false,
  onInstall,
  onDismiss,
}: AppUpdateModalProps) {
  const [isLoading, setIsLoading] = useState(false);

  if (!isVisible) return null;

  const handleInstall = async () => {
    setIsLoading(true);
    try {
      await onInstall();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
      <div className="w-full sm:w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl p-6 space-y-4 shadow-xl animate-in slide-in-from-bottom-5 sm:zoom-in-95">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-100 rounded-full">
              <Download className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="font-bold text-lg">App Update Available</h2>
              <p className="text-sm text-gray-600">
                {currentVersion} → <span className="font-semibold text-green-600">{latestVersion}</span>
              </p>
            </div>
          </div>

          {/* Force update indicator */}
          {isForce && (
            <div className="flex items-center gap-1 px-2 py-1 bg-orange-100 rounded-full text-xs font-semibold text-orange-700">
              <AlertCircle className="w-3 h-3" />
              Required
            </div>
          )}
        </div>

        {/* Release notes */}
        {releaseNotes && (
          <div className="bg-gray-50 rounded-lg p-3 max-h-40 overflow-y-auto">
            <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{releaseNotes}</p>
          </div>
        )}

        {/* Info message */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-900">
            {isForce
              ? "This update is required to continue using the app."
              : "Update recommended for the best experience."}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          {!isForce && (
            <button
              onClick={onDismiss}
              disabled={isLoading || isInstalling}
              className="flex-1 px-4 py-3 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              Later
            </button>
          )}
          <button
            onClick={handleInstall}
            disabled={isLoading || isInstalling}
            className="flex-1 px-4 py-3 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold hover:shadow-lg disabled:opacity-50 transition-all flex items-center justify-center gap-2"
          >
            {isLoading || isInstalling ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                Downloading...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Update Now
              </>
            )}
          </button>
        </div>

        {/* Footer info */}
        <p className="text-xs text-center text-gray-500 pt-2">
          {isForce
            ? "You cannot dismiss this update"
            : "You can update anytime from here"}
        </p>
      </div>
    </div>
  );
}
