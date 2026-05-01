import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ToastProvider } from "@/components/ui/toast";
import { ChatBot } from "@/components/chat/chatbot";
import { CookieConsent } from "@/components/ui/cookie-consent";
import { RegisterServiceWorker } from "@/components/pwa/register-sw";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
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
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://genesisstudio.app"),
  title: {
    default: "Genesis Studio | AI Video Generation Platform",
    template: "%s | Genesis Studio",
  },
  description:
    "Create AI videos in seconds. Text to video, dance transfer, short films with audio. 10+ AI models, 50 free credits. Made in South Africa.",
  keywords: [
    "AI video generator",
    "AI video maker",
    "text to video",
    "image to video",
    "AI dance video",
    "Genesis Studio",
    "Mimic Studio",
    "Brain Studio",
    "AI video South Africa",
    "create AI videos free",
    "TikTok video maker",
    "AI content creator",
    "motion transfer AI",
    "AI short film maker",
  ],
  openGraph: {
    title: "Genesis Studio — AI Video Creation Platform",
    description:
      "Create AI videos in seconds. Text to video, dance transfer, short films with audio. 10+ models. 50 free credits. Made in South Africa.",
    type: "website",
    siteName: "Genesis Studio",
    locale: "en_ZA",
  },
  twitter: {
    card: "summary_large_image",
    title: "Genesis Studio — Create AI Videos in Seconds",
    description:
      "Text to video, dance transfer, short films with audio. 10+ AI models. 50 free credits.",
  },
  robots: {
    index: true,
    follow: true,
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Genesis Studio",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: "#7c3aed",
          colorBackground: "#0A0A0F",
          colorInputBackground: "#111118",
          colorInputText: "#ededed",
        },
      }}
    >
      <html
        lang="en"
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
      >
        <head>
          <meta name="theme-color" content="#7c3aed" />
          <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        </head>
        <body className="min-h-full flex flex-col bg-[#0A0A0F] text-white" suppressHydrationWarning>
          <ToastProvider>{children}</ToastProvider>
          <ChatBot />
          <CookieConsent />
          <RegisterServiceWorker />
          <Analytics />
          <SpeedInsights />
        </body>
      </html>
    </ClerkProvider>
  );
}
