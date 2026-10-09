import type { ReactNode } from "react";

/** Rounded, scrollable wrapper for data tables; pair with <TableHead> cells below. */
export function TableShell({ children, minWidth = "32rem" }: { children: ReactNode; minWidth?: string }) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card shadow-soft">
      <table className="w-full text-left text-sm" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}
