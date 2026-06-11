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
    <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-surface via-surface to-elevated/40 px-4 py-4 md:px-5 md:py-5">
      <div className="absolute -top-14 -right-14 w-40 h-40 rounded-full bg-norge/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 -left-10 w-36 h-36 rounded-full bg-primary/8 blur-3xl pointer-events-none" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent pointer-events-none" />

      <div className="relative flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.18em] font-bold text-norge/80">
            <span className="w-1 h-1 rounded-full bg-norge/80" />
            Gutta · VM 2026
          </div>
          <h1 className="text-xl md:text-2xl lg:text-3xl font-extrabold tracking-tight leading-tight">
            {tittel}
          </h1>
          {undertittel && (
            <div className="text-muted text-[11px] md:text-xs mt-0.5">
              {undertittel}
            </div>
          )}
        </div>
        {høyre && <div className="flex-shrink-0">{høyre}</div>}
      </div>
    </div>
  );
}
