import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "planoo",
  description: "UI-to-DB traceability — Figma ekranlarını veritabanı şemanızla eşleştirin.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="tr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <div aria-hidden className="app-canvas-bg">
          <span className="smoke-blob smoke-blob-1" />
          <span className="smoke-blob smoke-blob-2" />
          <span className="smoke-blob smoke-blob-3" />
          <span className="smoke-blob smoke-blob-4" />
        </div>
        {children}
      </body>
    </html>
  );
}
