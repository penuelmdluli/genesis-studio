import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ToastProvider } from "@/components/ui/toast";
import { ChatBot } from "@/components/chat/chatbot";
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
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://genesis-studio-hazel.vercel.app"),
  title: {
    default: "Genesis Studio | AI Video Generation Platform",
    template: "%s | Genesis Studio",
  },
  description:
    "Create stunning AI-generated videos with open-source models on serverless GPUs. Text-to-video, image-to-video, and multi-scene productions.",
  keywords: [
    "AI video",
    "video generation",
    "text to video",
    "AI video maker",
    "Genesis Studio",
    "image to video",
    "AI video generator",
    "open source AI",
    "serverless GPU",
  ],
  openGraph: {
    title: "Genesis Studio | AI Video Generation",
    description:
      "Create stunning AI-generated videos with open-source models.",
    type: "website",
    siteName: "Genesis Studio",
  },
  twitter: {
    card: "summary_large_image",
    title: "Genesis Studio | AI Video Generation",
    description:
      "Create stunning AI-generated videos with open-source models.",
  },
  robots: {
    index: true,
    follow: true,
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
        <body className="min-h-full flex flex-col bg-[#0A0A0F] text-white" suppressHydrationWarning>
          <ToastProvider>{children}</ToastProvider>
          <ChatBot />
          <Analytics />
          <SpeedInsights />
        </body>
      </html>
    </ClerkProvider>
  );
}
