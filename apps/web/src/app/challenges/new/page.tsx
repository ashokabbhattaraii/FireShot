"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function NewChallenge() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/challenges/create");
  }, [router]);

  return null;
}
