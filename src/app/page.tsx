import type { Metadata } from "next";
import LandingPage from "./landing-page";

export const metadata: Metadata = {
  title: "iVideo Studio | AI Video Generation Platform",
  description:
    "Create AI videos. Text to video, dance transfer, short films with audio. 100 free credits. Made in South Africa.",
  alternates: {
    canonical: "https://ivideostudio.ai",
  },
};

export default function Page() {
  return <LandingPage />;
}
