"use client";

import React, { createContext, useContext, ReactNode } from "react";
import { useAppUpdates } from "@/hooks/useAppUpdates";
import { AppUpdateModal } from "@/components/AppUpdateModal";

interface UpdateContextType {
  updateAvailable: boolean;
  latestVersion: string;
  currentVersion: string;
  forceUpdate: boolean;
  releaseNotes: string | null;
  dismissUpdate: () => void;
}

const UpdateContext = createContext<UpdateContextType | undefined>(undefined);

export function UpdateProvider({ children }: { children: ReactNode }) {
  const updates = useAppUpdates();

  // Don't show update modal if update is not available
  const showModal = updates.updateAvailable || updates.forceUpdate;

  return (
    <UpdateContext.Provider
      value={{
        updateAvailable: updates.updateAvailable,
        latestVersion: updates.latestVersion,
        currentVersion: updates.currentVersion,
        forceUpdate: updates.forceUpdate,
        releaseNotes: updates.releaseNotes,
        dismissUpdate: updates.dismissUpdate,
      }}
    >
      {children}

      {/* Update Modal */}
      <AppUpdateModal
        isVisible={showModal}
        currentVersion={updates.currentVersion}
        latestVersion={updates.latestVersion}
        releaseNotes={updates.releaseNotes}
        isForce={updates.forceUpdate}
        isInstalling={false}
        onInstall={updates.installUpdate}
        onDismiss={updates.dismissUpdate}
      />
    </UpdateContext.Provider>
  );
}

export function useUpdateContext() {
  const context = useContext(UpdateContext);
  if (!context) {
    throw new Error("useUpdateContext must be used within UpdateProvider");
  }
  return context;
}
