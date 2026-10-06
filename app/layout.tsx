import type { Metadata } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import "./globals.css";

const sans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});

const serif = Fraunces({
  subsets: ["latin"],
  variable: "--font-serif",
});

export const metadata: Metadata = {
  title: "Kōkua Counter",
  description: "Fund a meal for a Hawaiʻi student. Students redeem a meal pass at participating eateries.",
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
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
