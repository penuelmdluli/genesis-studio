import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/components/auth/auth-provider";
import { ToastProvider } from "@/components/ui/toast";
import { ChatBot } from "@/components/chat/chatbot";
import { CookieConsent } from "@/components/ui/cookie-consent";
import { RegisterServiceWorker } from "@/components/pwa/register-sw";
import { EmailCapture } from "@/components/email-capture";
import { WebSiteSchema } from "@/components/structured-data";
import Script from "next/script";
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
  metadataBase: new URL("https://ivideostudio.ai"),
  title: {
    default: "Genesis Studio | AI Video Generation Platform",
    template: "%s | Genesis Studio",
  },
  description:
    "Create AI videos in seconds. Text to video, dance transfer, short films with audio. 10+ AI models, 100 free credits. Made in South Africa.",
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
      "Create AI videos in seconds. Text to video, dance transfer, short films with audio. 10+ models. 100 free credits. Made in South Africa.",
    type: "website",
    siteName: "Genesis Studio",
    locale: "en_ZA",
  },
  twitter: {
    card: "summary_large_image",
    title: "Genesis Studio — Create AI Videos in Seconds",
    description:
      "Text to video, dance transfer, short films with audio. 10+ AI models. 100 free credits.",
  },
  robots: {
    index: true,
    follow: true,
  },
  // Google Search Console verification. Set NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
  // to the token from GSC (HTML-tag method) so the meta tag renders in <head>.
  verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
    : undefined,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Genesis Studio",
  },
  icons: {
    icon: [
      { url: "/icons/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AuthProvider>
      <html
        lang="en"
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
      >
        <head>
          <meta name="theme-color" content="#7c3aed" />
          <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
          <WebSiteSchema />
        </head>
        <body className="min-h-full flex flex-col bg-[#0A0A0F] text-white" suppressHydrationWarning>
          <ToastProvider>{children}</ToastProvider>
          <ChatBot />
          <CookieConsent />
          <RegisterServiceWorker />
          <EmailCapture />
          {/* Cloudflare Web Analytics */}
          <Script
            defer
            src="https://static.cloudflareinsights.com/beacon.min.js"
            data-cf-beacon={`{"token": "${process.env.NEXT_PUBLIC_CF_ANALYTICS_TOKEN || ""}"}`}
            strategy="afterInteractive"
          />
          <Script
            defer
            data-domain="ivideostudio.ai"
            src="https://plausible.io/js/script.js"
            strategy="afterInteractive"
          />
        </body>
      </html>
    </AuthProvider>
  );
}
