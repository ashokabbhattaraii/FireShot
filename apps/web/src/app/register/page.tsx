"use client";

import { GoogleAuthPanel } from "@/components/GoogleAuthPanel";

export default function RegisterPage() {
  return (
    <div className="mx-auto max-w-md">
      <GoogleAuthPanel
        title="Create your FireSlot account"
        next="/dashboard/profile"
        showReferral
      />
    </div>
  );
}
