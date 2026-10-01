"use client";

import type { ThemeProviderProps } from "next-themes";

import * as React from "react";
import { HeroUIProvider } from "@heroui/system";
import { useRouter } from "next/navigation";
import { ThemeProvider as NextThemesProvider } from "next-themes";

export interface ProvidersProps {
  children: React.ReactNode;
  themeProps?: ThemeProviderProps;
}

declare module "@react-types/shared" {
  interface RouterConfig {
    routerOptions: NonNullable<
      Parameters<ReturnType<typeof useRouter>["push"]>[1]
    >;
  }
}

import { Toaster } from "react-hot-toast";

import { PwaServiceWorkerRegistration } from "@/components/PwaServiceWorkerRegistration";

export function Providers({ children, themeProps }: ProvidersProps) {
  const router = useRouter();

  return (
    <HeroUIProvider locale="en-GB" navigate={router.push}>
      <NextThemesProvider {...themeProps}>
        <PwaServiceWorkerRegistration />
        {children}
        <Toaster position="top-center" reverseOrder={false} />
      </NextThemesProvider>
    </HeroUIProvider>
  );
}
