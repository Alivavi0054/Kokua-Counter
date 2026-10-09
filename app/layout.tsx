import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { DM_Sans, Fraunces } from "next/font/google";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import "./globals.css";

const sans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

const serif = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
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
        className={`${sans.variable} ${serif.variable} flex min-h-screen flex-col font-sans`}
      >
        <SiteHeader />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">{children}</main>
        <SiteFooter />
        <Analytics />
      </body>
    </html>
  );
}
