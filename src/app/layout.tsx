import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Knowledge Assistant",
    template: "%s | Knowledge Assistant",
  },
  description:
    "AI-powered company knowledge assistant — find answers from your internal documents instantly.",
  keywords: ["knowledge base", "AI assistant", "company docs", "RAG"],
  authors: [{ name: "Your Company" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    title: "Company Knowledge Assistant",
    description: "AI-powered answers from your company knowledge base.",
    siteName: "Knowledge Assistant",
  },
  robots: {
    index: false, // Internal tool — don't index
    follow: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
          {children}
          <Toaster />
          <Analytics />
          <SpeedInsights />
        </body>
      </html>
    </ClerkProvider>
  );
}
