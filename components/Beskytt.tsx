"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, ReactNode } from "react";

export default function Beskytt({ children }: { children: ReactNode }) {
  const { user, laster } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!laster && !user) {
      router.replace("/logg-inn");
    }
  }, [laster, user, router]);

  if (laster) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted text-sm">Laster…</div>
      </div>
    );
  }

  if (!user) return null;
  return <>{children}</>;
}
