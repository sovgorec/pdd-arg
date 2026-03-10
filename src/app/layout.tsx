import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ErrorFallback } from "@/components/ErrorFallback";
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
  title: "ПДД Аргентина",
  description: "Изучение экзаменационных вопросов ПДД Аргентины",
  manifest: "/site.webmanifest",
  appleWebApp: { capable: true, title: "ПДД AR" },
  icons: {
    icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  themeColor: "#1c1917",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className="light" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-stone-100 text-stone-900`}
      >
        <ErrorFallback>{children}</ErrorFallback>
      </body>
    </html>
  );
}
