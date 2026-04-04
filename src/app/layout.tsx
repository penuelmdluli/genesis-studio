import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
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
  title: "Genesis Studio — AI Video Creation Platform",
  description:
    "Create stunning AI-generated videos with open-source models. Text-to-video, image-to-video, and more. Hollywood-grade tools at indie prices.",
  keywords: [
    "AI video",
    "text to video",
    "image to video",
    "AI generation",
    "video creation",
    "Genesis Studio",
  ],
  openGraph: {
    title: "Genesis Studio — From Nothing, Create Everything",
    description:
      "The AI video creation platform that puts Hollywood-grade generation tools in everyone's hands.",
    type: "website",
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
          colorPrimary: "#8b5cf6",
          colorBackground: "#0a0a0a",
        },
      }}
    >
      <html
        lang="en"
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
      >
        <body className="min-h-full flex flex-col bg-black text-white">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
