import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { I18nProvider } from "@/components/i18n-provider";
import { PwaRegister } from "@/components/pwa-register";
import { defaultLocale, t } from "@/i18n";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: t("metadata.title"),
  description: t("metadata.description"),
  applicationName: t("common.appName"),
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: t("common.appName"),
  },
  icons: {
    icon: [
      { url: "/favicon.ico?v=4", sizes: "32x32" },
      { url: "/icons/icon-16.png?v=4", sizes: "16x16", type: "image/png" },
      { url: "/icons/icon-32.png?v=4", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png?v=4", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png?v=4", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/favicon.ico?v=4",
    apple: "/icons/apple-touch-icon.png?v=4",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#0d9488",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang={defaultLocale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full min-w-0 flex-col overflow-x-clip bg-background text-foreground">
        <I18nProvider locale={defaultLocale}>{children}</I18nProvider>
        <PwaRegister />
      </body>
    </html>
  );
}
