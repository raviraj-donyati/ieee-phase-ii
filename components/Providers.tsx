"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { useState } from "react";
import { SessionProvider } from "next-auth/react";
import { Provider as JotaiProvider } from "jotai";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <JotaiProvider>
      <SessionProvider>
        <QueryClientProvider client={queryClient}>
          {children}
          <Toaster richColors closeButton position="top-right" />
        </QueryClientProvider>
      </SessionProvider>
    </JotaiProvider>
  );
}
