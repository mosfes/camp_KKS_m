import "@/styles/globals.css";
import { Metadata, Viewport } from "next";
import clsx from "clsx";

import { Providers } from "./providers";

import AppAuthProvider from "@/components/AppAuthProvider";
import { siteConfig } from "@/config/site";
import { fontSans } from "@/config/fonts";

export const metadata: Metadata = {
  applicationName: "KKS Camp",
  title: {
    default: siteConfig.name,
    template: `%s - ${siteConfig.name}`,
  },
  description: siteConfig.description,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "KKS Camp",
  },
  icons: {
    icon: "/images/logoKKS.png",
    apple: "/apple-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#5d7c6f",
};
export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html suppressHydrationWarning lang="th">
      <head>
        <link
          crossOrigin="anonymous"
          href="https://res.cloudinary.com"
          rel="preconnect"
        />
      </head>
      <body
        className={clsx(
          "min-h-screen text-foreground bg-[#f5f5f2] font-sans antialiased",
          fontSans.variable,
        )}
      >
        <AppAuthProvider>
          <Providers
            themeProps={{
              attribute: "class",
              defaultTheme: "light",
              forcedTheme: "light",
            }}
          >
            {children}
          </Providers>
        </AppAuthProvider>
      </body>
    </html>
  );
}
