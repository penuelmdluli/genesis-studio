import type { Metadata } from "next";
import { Navbar } from "@/components/layout/navbar";

export const metadata: Metadata = {
  title: "Explore AI Videos — Genesis Studio",
  description:
    "Watch stunning AI-generated videos from our community. Get inspired and create your own for free.",
  openGraph: {
    title: "Explore AI Videos — Genesis Studio",
    description: "Watch stunning AI-generated videos from our community.",
    type: "website",
  },
};

export default function ExploreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      <Navbar />
      <main className="pt-16">{children}</main>
    </div>
  );
}
