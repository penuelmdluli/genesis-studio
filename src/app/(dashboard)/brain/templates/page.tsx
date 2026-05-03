"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageTransition, StaggerGroup, StaggerItem } from "@/components/ui/motion";
import { useToast } from "@/components/ui/toast";
import { Film, Sparkles, Megaphone, TrendingUp, ShoppingBag, Mic, Globe, Zap } from "lucide-react";

const TEMPLATES = [
  {
    id: "product-ad",
    title: "Product Ad (30s)",
    icon: ShoppingBag,
    category: "Business",
    concept: "Create a 30-second product commercial. Scene 1: dramatic product reveal with studio lighting. Scene 2: product in use showing key features. Scene 3: happy customer reaction. Scene 4: brand logo with call-to-action. Cinematic, premium feel.",
    duration: 30,
  },
  {
    id: "news-reel",
    title: "Breaking News Reel",
    icon: TrendingUp,
    category: "News",
    concept: "BREAKING NEWS report style. Scene 1: dramatic establishing shot of the location. Scene 2: intense action showing the event unfolding. Scene 3: aftermath and impact. Scene 4: resolution or cliffhanger. Fast cuts, urgency, raw footage feel.",
    duration: 30,
  },
  {
    id: "motivational",
    title: "Motivational Quote Video",
    icon: Sparkles,
    category: "Lifestyle",
    concept: "Inspirational motivational video. Scene 1: sunrise over mountains, new beginnings. Scene 2: person training hard, pushing limits. Scene 3: moment of triumph, reaching the peak. Scene 4: powerful quote overlay with epic landscape. Voiceover with motivational narration.",
    duration: 30,
  },
  {
    id: "dance-viral",
    title: "Viral Dance Reel",
    icon: Zap,
    category: "Entertainment",
    concept: "High-energy dance video for TikTok/Reels. Scene 1: dancer enters frame with explosive energy. Scene 2: signature move in slow motion. Scene 3: crowd reaction, lights flashing. Scene 4: final pose with confetti explosion. 9:16 vertical, fast-paced.",
    duration: 15,
  },
  {
    id: "tech-review",
    title: "Tech Product Showcase",
    icon: Globe,
    category: "Tech",
    concept: "Sleek tech product review style. Scene 1: product rotating on pedestal, studio lighting. Scene 2: close-up of key features and details. Scene 3: product in real-world use. Scene 4: comparison shot and final verdict. Apple-style commercial feel.",
    duration: 30,
  },
  {
    id: "podcast-clip",
    title: "Podcast Clip / Talking Head",
    icon: Mic,
    category: "Content",
    concept: "Podcast-style talking head clip. A host speaks directly to camera with passion about a topic. Dynamic camera angles, warm lighting, professional studio backdrop. Text overlays highlighting key points. Engaging and conversational tone.",
    duration: 30,
  },
  {
    id: "real-estate",
    title: "Property Tour",
    icon: Film,
    category: "Business",
    concept: "Luxury real estate property tour. Scene 1: dramatic aerial approach to the property. Scene 2: grand entrance and foyer walkthrough. Scene 3: kitchen and living spaces with natural light. Scene 4: outdoor pool area at golden hour. Smooth steadicam, aspirational.",
    duration: 45,
  },
  {
    id: "brand-story",
    title: "Brand Origin Story",
    icon: Megaphone,
    category: "Business",
    concept: "Tell a brand's origin story. Scene 1: humble beginnings, small workshop or garage. Scene 2: first breakthrough moment, team celebrating. Scene 3: growth montage, factory, customers, impact. Scene 4: where we are today, looking to the future. Emotional, cinematic.",
    duration: 45,
  },
];

const CATEGORIES = ["All", "Business", "News", "Lifestyle", "Entertainment", "Tech", "Content"];

export default function TemplatesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [category, setCategory] = useState("All");

  const filtered = category === "All" ? TEMPLATES : TEMPLATES.filter((t) => t.category === category);

  const handleUseTemplate = (template: typeof TEMPLATES[0]) => {
    // Save to sessionStorage as backup (URL params can get lost on client nav)
    sessionStorage.setItem("brain_template_concept", template.concept);
    sessionStorage.setItem("brain_template_duration", String(template.duration));

    const params = new URLSearchParams({
      concept: template.concept,
      duration: String(template.duration),
    });
    router.push(`/brain?${params.toString()}`);
    toast(`Template "${template.title}" loaded — customize and generate!`, "success");
  };

  return (
    <PageTransition className="max-w-5xl mx-auto py-6 px-4">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-zinc-100 mb-2">Video Templates</h1>
        <p className="text-sm text-zinc-400">Pick a template, customize it, generate. No blank page.</p>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 justify-center flex-wrap mb-6">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              category === cat
                ? "bg-violet-600 text-white"
                : "bg-white/[0.06] text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Template grid */}
      <StaggerGroup className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((template) => (
          <StaggerItem key={template.id}>
            <Card hover className="h-full cursor-pointer" onClick={() => handleUseTemplate(template)}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center shrink-0">
                    <template.icon className="w-5 h-5 text-violet-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-zinc-200">{template.title}</h3>
                    <p className="text-xs text-zinc-400 mt-0.5">{template.category} · {template.duration}s</p>
                    <p className="text-xs text-zinc-400 mt-2 line-clamp-2">{template.concept.slice(0, 100)}...</p>
                  </div>
                </div>
                <Button variant="secondary" size="sm" className="w-full mt-3">
                  <Sparkles className="w-3 h-3" /> Use Template
                </Button>
              </CardContent>
            </Card>
          </StaggerItem>
        ))}
      </StaggerGroup>
    </PageTransition>
  );
}
