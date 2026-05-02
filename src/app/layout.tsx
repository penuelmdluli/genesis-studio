import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ToastProvider } from "@/components/ui/toast";
import { ChatBot } from "@/components/chat/chatbot";
import { CookieConsent } from "@/components/ui/cookie-consent";
import { RegisterServiceWorker } from "@/components/pwa/register-sw";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
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
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: "#7c3aed",
          colorBackground: "#0A0A0F",
          colorInputBackground: "#111118",
          colorInputText: "#ffffff",
          colorText: "#ffffff",
          colorTextSecondary: "#e4e4e7",
          colorTextOnPrimaryBackground: "#ffffff",
          colorNeutral: "#ffffff",
        },
        elements: {
          // UserProfile modal — every label, heading, and value visible white
          profileSectionTitle: "text-white",
          profileSectionTitleText: "text-white font-semibold",
          profileSectionContent: "text-white",
          profileSectionPrimaryButton: "text-white",
          profilePage: "text-white",
          headerTitle: "text-white",
          headerSubtitle: "text-zinc-200",
          navbarButton: "text-zinc-200 hover:text-white",
          navbarButtonIcon: "text-zinc-200",
          formFieldLabel: "text-zinc-100 font-medium",
          formFieldLabelRow: "text-zinc-100",
          formFieldHintText: "text-zinc-300",
          formFieldInfoText: "text-zinc-300",
          formFieldInputShowPasswordButton: "text-zinc-200",
          identityPreviewText: "text-white",
          identityPreviewEditButton: "text-violet-300",
          accordionTriggerButton: "text-white",
          menuButton: "text-zinc-100 hover:text-white",
          menuList: "text-white",
          breadcrumbsItem: "text-zinc-200",
          breadcrumbsItemDivider: "text-zinc-400",
          badge: "text-white",
          dividerText: "text-zinc-300",
          formButtonReset: "text-zinc-200 hover:text-white",
          footerActionText: "text-zinc-200",
          footerActionLink: "text-violet-300 hover:text-violet-200",
        },
      }}
    >
      <html
        lang="en"
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
      >
        <head>
          <meta name="theme-color" content="#7c3aed" />
          <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
        </head>
        <body className="min-h-full flex flex-col bg-[#0A0A0F] text-white" suppressHydrationWarning>
          <ToastProvider>{children}</ToastProvider>
          <ChatBot />
          <CookieConsent />
          <RegisterServiceWorker />
          <Analytics />
          <SpeedInsights />
          <Script
            defer
            data-domain="genesisstudio.app"
            src="https://plausible.io/js/script.js"
            strategy="afterInteractive"
          />
        </body>
      </html>
    </ClerkProvider>
  );
}
