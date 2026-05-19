"use client";

import { useEffect, useContext, createContext, useState, useCallback } from "react";

// ── Context ──────────────────────────────────────────────────────────────────

interface HeaderSlot {
  breadcrumbs: React.ReactNode;
  actions?: React.ReactNode;
}

interface AdminHeaderContextValue {
  slot: HeaderSlot | null;
  setSlot: (slot: HeaderSlot | null) => void;
}

export const AdminHeaderContext = createContext<AdminHeaderContextValue>({
  slot: null,
  setSlot: () => {},
});

// ── Provider (used inside AdminShell) ────────────────────────────────────────

export function AdminHeaderProvider({ children }: { children: React.ReactNode }) {
  const [slot, setSlot] = useState<HeaderSlot | null>(null);
  const set = useCallback((s: HeaderSlot | null) => setSlot(s), []);
  return (
    <AdminHeaderContext.Provider value={{ slot, setSlot: set }}>
      {children}
    </AdminHeaderContext.Provider>
  );
}

// ── Page-level component — renders nothing, just registers into context ───────

export function AdminPageHeader({ breadcrumbs, actions }: HeaderSlot) {
  const { setSlot } = useContext(AdminHeaderContext);

  useEffect(() => {
    setSlot({ breadcrumbs, actions });
    return () => setSlot(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
