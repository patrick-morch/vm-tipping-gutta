import { ReactNode } from "react";

export default function SideHeader({
  tittel,
  undertittel,
  høyre,
}: {
  tittel: string;
  undertittel?: ReactNode;
  høyre?: ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-surface to-elevated/40 px-4 py-3.5">
      <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-norge/8 blur-3xl pointer-events-none" />

      <div className="relative flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[9px] uppercase tracking-[0.18em] font-bold text-norge/80">
            Gutta · VM 2026
          </div>
          <h1 className="text-xl font-semibold leading-tight">{tittel}</h1>
          {undertittel && (
            <div className="text-muted text-[11px] mt-0.5">{undertittel}</div>
          )}
        </div>
        {høyre && <div className="flex-shrink-0">{høyre}</div>}
      </div>
    </div>
  );
}
