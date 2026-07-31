import type { Metadata } from "next";
import { defaultLocale, t } from "@/i18n";
import { getSiteUrl } from "@/lib/site-url";

const siteUrl = getSiteUrl();
const title = t("metadata.title");
const description = t("metadata.description");
const ogTitle = t("metadata.ogTitle");
const ogDescription = t("metadata.ogDescription");
const keywords = t("metadata.keywords");

export const rootMetadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: title,
    template: "%s · expire365",
  },
  description,
  keywords: keywords.split(",").map((k) => k.trim()),
  applicationName: t("common.appName"),
  authors: [{ name: "expire365", url: siteUrl }],
  creator: "expire365",
  publisher: "expire365",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: defaultLocale === "bg" ? "bg_BG" : "en_US",
    url: siteUrl,
    siteName: "expire365",
    title: ogTitle,
    description: ogDescription,
    images: [
      {
        url: "/icons/icon-512.png",
        width: 512,
        height: 512,
        alt: "expire365",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: ogTitle,
    description: ogDescription,
    images: ["/icons/icon-512.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: t("common.appName"),
  },
  icons: {
    icon: [
      { url: "/favicon.ico?v=10", sizes: "32x32" },
      { url: "/icons/icon-16.png?v=10", sizes: "16x16", type: "image/png" },
      { url: "/icons/icon-32.png?v=10", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png?v=10", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png?v=10", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/favicon.ico?v=10",
    apple: "/icons/apple-touch-icon.png?v=10",
  },
  formatDetection: {
    telephone: false,
  },
  category: "business",
};
