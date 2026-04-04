import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ToastProvider } from "@/components/ui/toast";
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
  title: {
    default: "Genesis Studio — AI Video Creation Platform",
    template: "%s | Genesis Studio",
  },
  description:
    "Create stunning AI-generated videos with open-source models. Text-to-video, image-to-video, and more. Hollywood-grade tools at indie prices.",
  keywords: [
    "AI video",
    "text to video",
    "image to video",
    "AI generation",
    "video creation",
    "Genesis Studio",
    "AI video generator",
    "open source AI",
    "serverless GPU",
  ],
  openGraph: {
    title: "Genesis Studio — From Nothing, Create Everything",
    description:
      "The AI video creation platform that puts Hollywood-grade generation tools in everyone's hands.",
    type: "website",
    siteName: "Genesis Studio",
  },
  twitter: {
    card: "summary_large_image",
    title: "Genesis Studio — AI Video Creation Platform",
    description: "Hollywood-grade AI video generation. 70-90% cheaper than competitors.",
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
        <body className="min-h-full flex flex-col bg-[#0A0A0F] text-white">
          <ToastProvider>{children}</ToastProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
