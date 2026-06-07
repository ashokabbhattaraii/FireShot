"use client";

import { useSearchParams } from "next/navigation";
import { GoogleAuthPanel } from "@/components/GoogleAuthPanel";

export default function RegisterPage() {
  const params = useSearchParams();
  const refCode = params.get("ref") ?? "";

  return (
    <div className="mx-auto max-w-md">
      <GoogleAuthPanel
        title="Create your FireSlot account"
        next="/dashboard/profile"
        showReferral
        initialReferralCode={refCode}
      />
    </div>
  );
}
