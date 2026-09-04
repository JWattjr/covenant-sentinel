"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";

import { WalletProvider } from "@/lib/genlayer/WalletProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 5_000, refetchOnWindowFocus: true, retry: 1 },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <WalletProvider>{children}</WalletProvider>
      <Toaster position="top-right" theme="dark" richColors closeButton />
    </QueryClientProvider>
  );
}
