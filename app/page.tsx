"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function Hjem() {
  const { user, laster } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (laster) return;
    if (!user) router.replace("/logg-inn");
    else router.replace("/kamper");
  }, [user, laster, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-muted text-sm">Laster…</div>
    </div>
  );
}
