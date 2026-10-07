import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { DM_Sans } from "next/font/google";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import "./globals.css";

const sans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Kōkua Counter", template: "%s | Kōkua Counter" },
  description: "Fund a meal for a Hawaiʻi student. Students redeem a meal pass at participating eateries.",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${sans.variable} flex min-h-screen flex-col font-sans`}
      >
        <SiteHeader />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
        <SiteFooter />
        <Analytics />
      </body>
    </html>
  );
}
