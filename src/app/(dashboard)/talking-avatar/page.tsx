"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PageTransition } from "@/components/ui/motion";
import { useStore } from "@/hooks/use-store";
import { useToast } from "@/components/ui/toast";
import { VOICE_OPTIONS } from "@/lib/constants";
import { MobileActionBar } from "@/components/ui/mobile-action-bar";
import { GenesisButtonLoader, GenesisLoader } from "@/components/ui/genesis-loader";
import {
  MessageCircle,
  Upload,
  Mic,
  Zap,
  Play,
  Square,
  Image as ImageIcon,
  X,
  Lock,
  Globe,
  Clock,
  Sparkles,
  Target,
  ShoppingBag,
  Megaphone,
  GraduationCap,
  PartyPopper,
  Building2,
  Star,
  Users,
  TrendingUp,
  Heart,
  Briefcase,
  Monitor,
  Smartphone,
  RectangleHorizontal,
  SquareIcon,
  ChevronDown,
  ChevronUp,
  Wand2,
  Scissors,
  Languages,
  Volume2,
  Palette,
  Music,
  Captions,
  Package,
  CheckCircle2,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────

type InputMode = "script" | "audio";

interface UseCase {
  id: string;
  name: string;
  icon: typeof Target;
  category: "marketing" | "sales" | "content" | "business" | "saas";
  description: string;
  sampleScript: string;
  suggestedTone: string;
  suggestedDuration: number;
  suggestedPlatform: string;
}

interface PlatformPreset {
  id: string;
  name: string;
  icon: typeof Monitor;
  aspectRatio: "16:9" | "9:16" | "1:1";
  suggestedDuration: number;
  description: string;
}

interface ToneOption {
  id: string;
  name: string;
  emoji: string;
  description: string;
}

interface BackgroundPreset {
  id: string;
  name: string;
  prompt: string;
}

// ─── Data ────────────────────────────────────────────────────────────

const USE_CASES: UseCase[] = [
  {
    id: "product-demo",
    name: "Product Demo",
    icon: ShoppingBag,
    category: "marketing",
    description: "Showcase your product's features and benefits",
    sampleScript: "Hey! Let me show you something that's going to change the way you work. [Product] does [key benefit] in just seconds. No setup, no learning curve — just results. Try it free today.",
    suggestedTone: "friendly",
    suggestedDuration: 30,
    suggestedPlatform: "youtube",
  },
  {
    id: "sales-pitch",
    name: "Sales Pitch",
    icon: TrendingUp,
    category: "sales",
    description: "Persuasive pitch to close deals",
    sampleScript: "What if I told you that you're leaving money on the table every single day? Our clients see an average 40% increase in [metric] within the first month. Here's exactly how we do it — and why the top companies in [industry] trust us.",
    suggestedTone: "professional",
    suggestedDuration: 30,
    suggestedPlatform: "linkedin",
  },
  {
    id: "testimonial",
    name: "Customer Testimonial",
    icon: Star,
    category: "marketing",
    description: "Social proof from a happy customer",
    sampleScript: "Before I found [product], I was spending hours every week on [pain point]. Now? It takes me minutes. I've saved over [time/money] in just [timeframe]. If you're still doing it the old way, you're working too hard.",
    suggestedTone: "friendly",
    suggestedDuration: 30,
    suggestedPlatform: "instagram",
  },
  {
    id: "social-ad",
    name: "Social Media Ad",
    icon: Megaphone,
    category: "marketing",
    description: "Scroll-stopping short-form ad",
    sampleScript: "Stop scrolling — this is for you. Tired of [common pain point]? We built [product] specifically for people like you. 10,000+ creators already switched. Link in bio.",
    suggestedTone: "urgent",
    suggestedDuration: 15,
    suggestedPlatform: "tiktok",
  },
  {
    id: "tutorial",
    name: "How-To Tutorial",
    icon: GraduationCap,
    category: "content",
    description: "Step-by-step educational explainer",
    sampleScript: "Here's how to [achieve goal] in 3 easy steps. Step one: [action]. Step two: [action]. Step three: [action]. That's it! Follow me for more tips like this.",
    suggestedTone: "friendly",
    suggestedDuration: 30,
    suggestedPlatform: "tiktok",
  },
  {
    id: "announcement",
    name: "Company Update",
    icon: Building2,
    category: "business",
    description: "Company news or product launch",
    sampleScript: "Big news! We just launched [feature/product] and it's going to transform how you [benefit]. We've been working on this for months, and I can't wait for you to try it. Available now — link below.",
    suggestedTone: "inspirational",
    suggestedDuration: 30,
    suggestedPlatform: "linkedin",
  },
  {
    id: "real-estate",
    name: "Property Tour",
    icon: Building2,
    category: "sales",
    description: "Virtual property walkthrough intro",
    sampleScript: "Welcome to this stunning [property type] in [location]. Featuring [bedrooms] bedrooms, [key feature], and [unique selling point]. This won't last long at [price]. Book your viewing today.",
    suggestedTone: "professional",
    suggestedDuration: 30,
    suggestedPlatform: "instagram",
  },
  {
    id: "ecommerce",
    name: "Product Review",
    icon: ShoppingBag,
    category: "content",
    description: "Honest product review or unboxing",
    sampleScript: "I've been using [product] for [timeframe] and here's my honest take. The [feature] is incredible — it actually [benefit]. The only downside? [minor con]. Overall? 9 out of 10. Link in description if you want to try it.",
    suggestedTone: "friendly",
    suggestedDuration: 30,
    suggestedPlatform: "youtube",
  },
  {
    id: "event-invite",
    name: "Event Invitation",
    icon: PartyPopper,
    category: "business",
    description: "Personal invite to webinar, launch, or event",
    sampleScript: "You're personally invited to [event name] on [date]. We're going to cover [topic] and you'll walk away with [takeaway]. Spots are limited — register now before it's full.",
    suggestedTone: "inspirational",
    suggestedDuration: 15,
    suggestedPlatform: "linkedin",
  },
  {
    id: "elevator-pitch",
    name: "Elevator Pitch",
    icon: Briefcase,
    category: "sales",
    description: "30-second company or idea pitch",
    sampleScript: "In [industry], the biggest problem is [pain point]. We built [product] to solve it. Unlike [competitor approach], we [unique differentiator]. We've already helped [number] customers [achieve result]. Let's talk.",
    suggestedTone: "professional",
    suggestedDuration: 30,
    suggestedPlatform: "linkedin",
  },
  {
    id: "onboarding",
    name: "Customer Onboarding",
    icon: Users,
    category: "business",
    description: "Welcome new users or customers",
    sampleScript: "Welcome aboard! I'm so glad you chose [product]. Here's what to do first: [step 1]. This will take about [time]. If you need any help, our support team is just a click away. Let's get you started!",
    suggestedTone: "friendly",
    suggestedDuration: 30,
    suggestedPlatform: "youtube",
  },
  {
    id: "personal-brand",
    name: "Personal Brand Intro",
    icon: Heart,
    category: "content",
    description: "Introduce yourself and your expertise",
    sampleScript: "Hi, I'm [name] and I help [audience] achieve [result]. After [years] years in [field], I've learned that [key insight]. Follow me for [content type] that will [benefit]. New content every [frequency].",
    suggestedTone: "friendly",
    suggestedDuration: 15,
    suggestedPlatform: "tiktok",
  },
  // ─── SaaS / Tech Tool Templates ──────────────────────────────────
  {
    id: "saas-launch",
    name: "SaaS Product Launch",
    icon: Monitor,
    category: "saas",
    description: "Launch your software product with impact",
    sampleScript: "We just launched something incredible. If you've ever struggled with [pain point], this changes everything. Our platform lets you [core benefit] in minutes, not hours. We're already trusted by [number] teams worldwide. Start your free trial — no credit card required. Link below.",
    suggestedTone: "inspirational",
    suggestedDuration: 30,
    suggestedPlatform: "linkedin",
  },
  {
    id: "saas-demo",
    name: "Tool Demo / Walkthrough",
    icon: Monitor,
    category: "saas",
    description: "Show your app in action with a spokesperson",
    sampleScript: "Let me show you how easy it is. Step one — sign up in 30 seconds. Step two — connect your [integration]. Step three — watch the magic happen. What used to take your team an entire day now takes five minutes. Don't believe me? Try it free right now.",
    suggestedTone: "friendly",
    suggestedDuration: 30,
    suggestedPlatform: "youtube",
  },
  {
    id: "saas-vs-competitor",
    name: "Why Switch to Us",
    icon: TrendingUp,
    category: "saas",
    description: "Convert users from competing tools",
    sampleScript: "If you're still using [old way], you're paying too much for too little. Our users save an average of 60% while getting 3x the features. The migration takes 5 minutes — we even import your existing data. Over 5,000 teams already switched this month. What are you waiting for?",
    suggestedTone: "urgent",
    suggestedDuration: 30,
    suggestedPlatform: "tiktok",
  },
  {
    id: "saas-feature-drop",
    name: "New Feature Announcement",
    icon: Sparkles,
    category: "saas",
    description: "Announce a powerful new feature update",
    sampleScript: "Your number one request? We built it. Introducing [feature name] — now you can [capability] directly inside the platform. No workarounds, no third-party tools. It's available right now for all users. Go check it out and let us know what you think.",
    suggestedTone: "inspirational",
    suggestedDuration: 15,
    suggestedPlatform: "tiktok",
  },
  {
    id: "saas-social-proof",
    name: "Customer Success Story",
    icon: Star,
    category: "saas",
    description: "Share a real result from a customer",
    sampleScript: "One of our customers went from spending 20 hours a week on [task] to just 2. That's 18 hours back — every single week. They didn't hire more people. They didn't change their process. They just started using our tool. If you want results like that, the link is right there.",
    suggestedTone: "professional",
    suggestedDuration: 30,
    suggestedPlatform: "linkedin",
  },
  {
    id: "saas-free-trial",
    name: "Free Trial / Sign Up CTA",
    icon: Zap,
    category: "saas",
    description: "Drive sign-ups with a compelling offer",
    sampleScript: "Here's the deal — try it free for 14 days. No credit card. No commitment. If it doesn't save you at least 5 hours in your first week, just walk away. But I'm betting you won't want to. Join 10,000+ users who already made the switch. Link in bio — takes 30 seconds.",
    suggestedTone: "urgent",
    suggestedDuration: 15,
    suggestedPlatform: "tiktok",
  },
  {
    id: "saas-founder-story",
    name: "Founder Story",
    icon: Heart,
    category: "saas",
    description: "Tell the origin story of your tool",
    sampleScript: "I built this because I was frustrated. Every tool out there was either too expensive, too complicated, or too limited. So I spent [time] building exactly what I wished existed. Now thousands of people use it every day. If you've felt that same frustration, this is for you.",
    suggestedTone: "friendly",
    suggestedDuration: 30,
    suggestedPlatform: "youtube",
  },
];

const PLATFORM_PRESETS: PlatformPreset[] = [
  { id: "tiktok", name: "TikTok / Reels", icon: Smartphone, aspectRatio: "9:16", suggestedDuration: 15, description: "Vertical short-form" },
  { id: "youtube", name: "YouTube", icon: Monitor, aspectRatio: "16:9", suggestedDuration: 30, description: "Horizontal standard" },
  { id: "instagram", name: "Instagram Feed", icon: SquareIcon, aspectRatio: "1:1", suggestedDuration: 30, description: "Square format" },
  { id: "linkedin", name: "LinkedIn", icon: Briefcase, aspectRatio: "16:9", suggestedDuration: 30, description: "Professional horizontal" },
  { id: "stories", name: "Stories", icon: Smartphone, aspectRatio: "9:16", suggestedDuration: 15, description: "Vertical full-screen" },
  { id: "custom", name: "Custom", icon: Palette, aspectRatio: "16:9", suggestedDuration: 10, description: "Choose your own" },
];

const TONE_OPTIONS: ToneOption[] = [
  { id: "professional", name: "Professional", emoji: "💼", description: "Confident & authoritative" },
  { id: "friendly", name: "Friendly", emoji: "😊", description: "Warm & approachable" },
  { id: "urgent", name: "Urgent", emoji: "🔥", description: "High-energy & compelling" },
  { id: "inspirational", name: "Inspirational", emoji: "✨", description: "Passionate & motivational" },
  { id: "humorous", name: "Humorous", emoji: "😄", description: "Light & witty" },
  { id: "calm", name: "Calm", emoji: "🌿", description: "Soothing & reassuring" },
];

const BACKGROUND_PRESETS: BackgroundPreset[] = [
  { id: "studio", name: "Studio", prompt: "Professional studio with soft key lighting, clean backdrop" },
  { id: "office", name: "Modern Office", prompt: "Contemporary office space with glass walls, soft ambient lighting" },
  { id: "home", name: "Home Office", prompt: "Cozy home office with bookshelf background, warm lighting" },
  { id: "outdoor", name: "Outdoor", prompt: "Natural outdoor setting with soft bokeh greenery background" },
  { id: "gradient", name: "Color Gradient", prompt: "Smooth modern gradient background, professional lighting" },
  { id: "cafe", name: "Coffee Shop", prompt: "Trendy café backdrop with warm ambient light, slight bokeh" },
  { id: "warehouse", name: "Creative Space", prompt: "Industrial creative space with exposed brick, moody lighting" },
  { id: "custom", name: "Custom", prompt: "" },
];

const MUSIC_MOODS = [
  { id: "none", name: "No Music", emoji: "🔇" },
  { id: "upbeat", name: "Upbeat", emoji: "🎵" },
  { id: "corporate", name: "Corporate", emoji: "💼" },
  { id: "dramatic", name: "Dramatic", emoji: "🎬" },
  { id: "chill", name: "Chill", emoji: "🌊" },
  { id: "energetic", name: "Energetic", emoji: "⚡" },
  { id: "emotional", name: "Emotional", emoji: "💝" },
  { id: "trendy", name: "Trendy", emoji: "🔥" },
];

const SUBTITLE_STYLES = [
  { id: "none", name: "No Captions", preview: "" },
  { id: "tiktok", name: "TikTok", preview: "Bold centered, yellow highlight, bounce effect" },
  { id: "youtube", name: "YouTube", preview: "Clean bottom bar, semi-transparent background" },
  { id: "cinematic", name: "Cinematic", preview: "Elegant italic, minimal bottom position" },
  { id: "bold", name: "Bold", preview: "Extra bold, orange highlight, center bounce" },
];

const DURATIONS = [10, 15, 30, 60] as const;

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "ja", label: "Japanese" },
  { code: "zh", label: "Chinese" },
  { code: "pt", label: "Portuguese" },
  { code: "hi", label: "Hindi" },
  { code: "ar", label: "Arabic" },
  { code: "ko", label: "Korean" },
] as const;

function computeCreditCost(duration: number): number {
  return Math.ceil(duration / 10) * 15;
}

const CATEGORY_LABELS: Record<string, string> = {
  marketing: "Marketing",
  sales: "Sales",
  content: "Content",
  business: "Business",
  saas: "SaaS / Tech",
};

// ─── Component ───────────────────────────────────────────────────────

export default function TalkingAvatarPage() {
  const { user, updateCreditBalance, isInitialized } = useStore();
  const { toast } = useToast();

  // Form state
  const [faceImage, setFaceImage] = useState<File | null>(null);
  const [faceImagePreview, setFaceImagePreview] = useState<string | null>(null);
  const [inputMode, setInputMode] = useState<InputMode>("script");
  const [scriptText, setScriptText] = useState("");
  const [voiceId, setVoiceId] = useState(VOICE_OPTIONS[0]?.id || "voice-aria");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioFileName, setAudioFileName] = useState<string | null>(null);
  const [duration, setDuration] = useState<number>(10);
  const [language, setLanguage] = useState("en");

  // New enhanced state
  const [selectedUseCase, setSelectedUseCase] = useState<string | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState("custom");
  const [selectedTone, setSelectedTone] = useState("professional");
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16" | "1:1">("16:9");
  const [selectedBackground, setSelectedBackground] = useState("studio");
  const [customBackground, setCustomBackground] = useState("");
  const [showUseCases, setShowUseCases] = useState(true);
  const [useCaseCategory, setUseCaseCategory] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [aiToolOpen, setAiToolOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  // Music & Subtitles
  const [musicMood, setMusicMood] = useState("none");
  const [subtitleStyle, setSubtitleStyle] = useState("none");

  // Product Ad Mode
  const [isProductMode, setIsProductMode] = useState(false);
  const [productImage, setProductImage] = useState<File | null>(null);
  const [productImagePreview, setProductImagePreview] = useState<string | null>(null);
  const [productName, setProductName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [productAiLoading, setProductAiLoading] = useState(false);
  const productInputRef = useRef<HTMLInputElement>(null);

  // AI Face Suggestion
  const [suggestedFaces, setSuggestedFaces] = useState<string[]>([]);
  const [faceGenLoading, setFaceGenLoading] = useState(false);

  // Product image URL (uploaded during generation, used by enhance)
  const [uploadedProductUrl, setUploadedProductUrl] = useState<string | null>(null);

  // Enhancement state (post-processing after avatar generation)
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [enhanceStage, setEnhanceStage] = useState<string | null>(null);

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultVideoUrl, setResultVideoUrl] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);

  // Refs
  const faceInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const generateLockRef = useRef(false);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState<string | null>(null);

  // ─── Voice Preview ─────────────────────────────────────────────────

  const handlePreviewVoice = useCallback((vid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (previewingVoice === vid && previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.currentTime = 0;
      previewAudioRef.current = null;
      setPreviewingVoice(null);
      setLoadingPreview(null);
      return;
    }
    if (previewAudioRef.current) {
      previewAudioRef.current.oncanplaythrough = null;
      previewAudioRef.current.onended = null;
      previewAudioRef.current.onerror = null;
      previewAudioRef.current.pause();
      previewAudioRef.current.currentTime = 0;
    }
    setLoadingPreview(vid);
    setPreviewingVoice(null);
    const audio = new Audio(`/api/voiceover/preview?voiceId=${vid}`);
    previewAudioRef.current = audio;
    audio.oncanplaythrough = () => {
      if (previewAudioRef.current !== audio) return;
      setLoadingPreview(null);
      setPreviewingVoice(vid);
      audio.play();
    };
    audio.onended = () => {
      if (previewAudioRef.current !== audio) return;
      setPreviewingVoice(null);
    };
    audio.onerror = () => {
      if (previewAudioRef.current !== audio) return;
      setLoadingPreview(null);
      setPreviewingVoice(null);
    };
    audio.load();
  }, [previewingVoice]);

  const isLoading = !isInitialized;
  const userPlan = user?.plan || "free";
  const isPlanAllowed = userPlan === "creator" || userPlan === "pro" || userPlan === "studio" || !!user?.isOwner;
  const baseCreditCost = computeCreditCost(duration);
  const productIntroCost = (isProductMode && productImage) ? 15 : 0;
  const enhanceCost = productIntroCost + (musicMood !== "none" ? 3 : 0) + (subtitleStyle !== "none" ? 5 : 0);
  const creditCost = baseCreditCost + enhanceCost;
  const hasEnoughCredits = user?.isOwner || (user?.creditBalance ?? 0) >= creditCost;
  const wantsEnhancement = musicMood !== "none" || subtitleStyle !== "none" || isProductMode;

  // ─── Use Case Selection ───────────────────────────────────────────

  const handleSelectUseCase = (uc: UseCase) => {
    setSelectedUseCase(uc.id);
    setScriptText(uc.sampleScript);
    setSelectedTone(uc.suggestedTone);
    setDuration(uc.suggestedDuration);
    setInputMode("script");

    // Auto-set platform
    const platform = PLATFORM_PRESETS.find(p => p.id === uc.suggestedPlatform);
    if (platform) {
      setSelectedPlatform(platform.id);
      setAspectRatio(platform.aspectRatio);
      setDuration(platform.suggestedDuration);
    }

    setShowUseCases(false);
    toast(`Template loaded: ${uc.name}`, "success");
  };

  // ─── Platform Selection ───────────────────────────────────────────

  const handleSelectPlatform = (p: PlatformPreset) => {
    setSelectedPlatform(p.id);
    if (p.id !== "custom") {
      setAspectRatio(p.aspectRatio);
      setDuration(p.suggestedDuration);
    }
  };

  // ─── Product Ad Mode ───────────────────────────────────────────────

  const handleProductImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setError("Product image too large (max 10MB)."); return; }
    setProductImage(file);
    const reader = new FileReader();
    reader.onload = () => setProductImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const generateProductScript = async () => {
    if (!productName.trim()) { setError("Enter your product name first."); return; }
    setProductAiLoading(true);
    setError(null);
    try {
      // Detect if this is a software/tech/SaaS product
      const techKeywords = ["app", "software", "saas", "platform", "tool", "ai", "api", "dashboard", "automation", "cloud", "plugin", "extension", "website", "studio", "generator", "builder", "crm", "erp"];
      const isTechProduct = techKeywords.some(k =>
        productName.toLowerCase().includes(k) || (productDescription || "").toLowerCase().includes(k)
      );

      const techBoost = isTechProduct ? `
IMPORTANT — This is a software/tech product. Use these SaaS-specific persuasion techniques:
- Lead with the TRANSFORMATION, not the technology ("go from 5 hours to 5 minutes")
- Mention ease of setup ("takes 30 seconds", "no code required", "works instantly")
- Use competitor displacement language without naming competitors ("unlike what you're using now")
- Include a low-friction CTA ("free trial", "no credit card", "just try it")
- Reference scale/trust ("trusted by thousands", "10,000+ users", "teams at top companies")
- Make the tech feel SIMPLE, not complex — the viewer should think "I could do that"
- If it's an AI tool, emphasize the magic ("just describe what you want and watch it happen")` : "";

      const prompt = `You are a world-class advertising copywriter who specializes in high-converting video ads. Write a compelling ${duration}-second talking-head video script for a spokesperson presenting this product:

Product: ${productName}
${productDescription ? `Description: ${productDescription}` : ""}
Platform: ${PLATFORM_PRESETS.find(p => p.id === selectedPlatform)?.name || "social media"}
Tone: ${selectedTone}
Duration: ${duration} seconds (~${Math.floor(duration * 2.5)} words)
${techBoost}

Rules:
- Start with an IRRESISTIBLE hook — a question, bold claim, or pattern interrupt that stops the scroll
- Focus on 2-3 key BENEFITS (what the user gets), never list features
- Include social proof ("thousands of customers", "top-rated", real-sounding stats)
- Build urgency or scarcity if natural ("limited time", "everyone's switching", "don't get left behind")
- End with ONE clear, specific call-to-action that tells them exactly what to do next
- Keep it under ${Math.floor(duration * 2.5)} words, conversational, like talking to a friend
- The speaker should sound genuinely excited — not salesy, but passionate
- Use short sentences. Punchy. Easy to follow while scrolling.
- DO NOT use brackets, placeholders, or stage directions
- Return ONLY the script text, no explanation`;

      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: prompt }),
      });
      const d = await r.json();
      if (d.reply) {
        setScriptText(d.reply);
        setInputMode("script");
        toast("Product ad script generated!", "success");
      }
    } catch {
      setError("Failed to generate product script. Try again.");
    } finally {
      setProductAiLoading(false);
    }
  };

  // ─── AI Face Suggestion ────────────────────────────────────────────

  const suggestFaces = async () => {
    setFaceGenLoading(true);
    setError(null);
    setSuggestedFaces([]);
    try {
      // Step 1: Ask AI to describe the ideal spokesperson
      const descPrompt = `You are a casting director for a product advertisement video. Based on this product, describe the IDEAL spokesperson's appearance for a front-facing headshot photo.

Product: ${productName || "general product"}
${productDescription ? `Description: ${productDescription}` : ""}
Target audience: ${selectedTone === "professional" ? "business professionals" : selectedTone === "friendly" ? "everyday consumers" : selectedTone === "urgent" ? "impulse buyers" : "general audience"}
Platform: ${PLATFORM_PRESETS.find(p => p.id === selectedPlatform)?.name || "social media"}

Write a SINGLE detailed prompt for generating a photorealistic headshot of the perfect spokesperson. Think about:
- WHO would the target audience trust? (Match their demographic — a tech founder for SaaS, a fitness model for health, a relatable person for consumer products)
- Age range, gender (pick one), ethnicity (be diverse — vary each generation)
- Expression that matches the tone (warm smile for friendly, confident look for professional, energetic for urgent)
- Attire that matches the product industry (casual tech wear for apps, business casual for B2B, stylish for fashion/beauty)
- Lighting and background (studio headshot style, clean)

The photo must be: front-facing, clear face visible, shoulders visible, professional headshot quality, looking directly at camera, photorealistic.

Return ONLY the image generation prompt, nothing else. Keep it under 80 words.`;

      const chatRes = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: descPrompt }),
      });
      const chatData = await chatRes.json();
      const facePrompt = chatData.reply || "Professional headshot of a confident person smiling warmly at camera, studio lighting, clean background, shoulders visible";

      // Step 2: Generate 4 face options via FLUX Pro
      toast("Generating spokesperson options...", "info");
      const imgRes = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `${facePrompt}. Photorealistic professional headshot, front-facing, looking directly at camera, sharp focus on face, studio portrait photography, 85mm lens, shallow depth of field`,
          aspectRatio: "portrait",
          numImages: 4,
        }),
      });

      const imgData = await imgRes.json();
      if (imgData.images && imgData.images.length > 0) {
        setSuggestedFaces(imgData.images);
        if (imgData.creditsCost) {
          updateCreditBalance((user?.creditBalance ?? 0) - imgData.creditsCost);
        }
        toast(`${imgData.images.length} spokesperson options generated!`, "success");
      } else {
        setError(imgData.error || "Failed to generate faces. Try again.");
      }
    } catch {
      setError("Face generation failed. Try again.");
    } finally {
      setFaceGenLoading(false);
    }
  };

  const selectSuggestedFace = async (imageUrl: string) => {
    try {
      let blob: Blob;
      if (imageUrl.startsWith("data:")) {
        // Convert base64 data URL to blob
        const [header, b64Data] = imageUrl.split(",");
        const mimeMatch = header.match(/data:([^;]+)/);
        const mime = mimeMatch?.[1] || "image/jpeg";
        const byteString = atob(b64Data);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
        blob = new Blob([ab], { type: mime });
      } else {
        // Fetch regular URL
        const res = await fetch(imageUrl);
        blob = await res.blob();
      }
      const file = new File([blob], `ai-spokesperson-${Date.now()}.jpg`, { type: blob.type || "image/jpeg" });
      setFaceImage(file);
      setFaceImagePreview(imageUrl);
      setSuggestedFaces([]);
      toast("Spokesperson selected!", "success");
    } catch (err) {
      console.error("Failed to select face:", err);
      // Fallback: just set the preview URL directly, upload will use the URL
      setFaceImagePreview(imageUrl);
      setSuggestedFaces([]);
      toast("Spokesperson selected!", "success");
    }
  };

  // ─── AI Script Actions ────────────────────────────────────────────

  const aiScriptAction = async (action: string) => {
    if (!scriptText.trim() || scriptText.length < 5) {
      setError("Type or select a script first");
      return;
    }
    setAiLoading(true);
    setError(null);
    try {
      const prompts: Record<string, string> = {
        write: `Write a short talking-head script (max 150 words) for someone speaking to camera about: "${scriptText}". Make it conversational, engaging, and natural. Include a hook in the first sentence. End with a call-to-action. Return ONLY the script text.`,
        shorten: `Shorten this script to under 80 words while keeping the hook and CTA. Make every word count:\n\n"${scriptText}"\n\nReturn ONLY the shortened script.`,
        hook: `Rewrite the first sentence of this script to be an irresistible scroll-stopping hook. Keep the rest intact:\n\n"${scriptText}"\n\nReturn ONLY the full updated script.`,
        cta: `Add a strong, specific call-to-action to the end of this script. Make it action-oriented and urgent:\n\n"${scriptText}"\n\nReturn ONLY the full updated script.`,
        punchier: `Make this script punchier and more energetic. Shorter sentences. More power words. Keep the same message:\n\n"${scriptText}"\n\nReturn ONLY the improved script.`,
        translate: `Translate this script to ${LANGUAGES.find(l => l.code === language)?.label || "the target language"} while keeping it natural and conversational (not word-for-word translation). Adapt cultural references if needed:\n\n"${scriptText}"\n\nReturn ONLY the translated script.`,
      };
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: prompts[action] || prompts.write }),
      });
      const d = await r.json();
      if (d.reply) {
        setScriptText(d.reply);
        toast(`Script ${action === "write" ? "generated" : "updated"}!`, "success");
      }
    } catch {
      setError("AI action failed. Try again.");
    } finally {
      setAiLoading(false);
      setAiToolOpen(false);
    }
  };

  // ─── File Handlers ────────────────────────────────────────────────

  const handleFaceImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError("Image too large. Maximum size is 10MB.");
      toast("Image too large (max 10MB)", "error");
      return;
    }
    setFaceImage(file);
    setError(null);
    const reader = new FileReader();
    reader.onload = () => setFaceImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const clearFaceImage = () => {
    setFaceImage(null);
    setFaceImagePreview(null);
    if (faceInputRef.current) faceInputRef.current.value = "";
  };

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      setError("Audio file too large. Maximum size is 25MB.");
      toast("Audio too large (max 25MB)", "error");
      return;
    }
    setAudioFile(file);
    setAudioFileName(file.name);
    setError(null);
  };

  const clearAudio = () => {
    setAudioFile(null);
    setAudioFileName(null);
    if (audioInputRef.current) audioInputRef.current.value = "";
  };

  // ─── Upload ───────────────────────────────────────────────────────

  const uploadFileToStorage = async (file: File, purpose: "image" | "audio"): Promise<string> => {
    const { uploadFile } = await import("@/lib/upload-client");
    return uploadFile(file, purpose);
  };

  // ─── Generate ─────────────────────────────────────────────────────

  const canGenerate =
    faceImage &&
    (inputMode === "script" ? scriptText.trim().length > 0 : !!audioFile) &&
    hasEnoughCredits &&
    isPlanAllowed &&
    !isLoading;

  const handleGenerate = async () => {
    if (generateLockRef.current) return;
    generateLockRef.current = true;
    setError(null);
    setResultVideoUrl(null);
    setJobId(null);

    if (!faceImage) { setError("Please upload a face photo."); generateLockRef.current = false; return; }
    if (inputMode === "script" && !scriptText.trim()) { setError("Please enter a script."); generateLockRef.current = false; return; }
    if (inputMode === "audio" && !audioFile) { setError("Please upload audio."); generateLockRef.current = false; return; }
    if (!hasEnoughCredits) { setError(`Need ${creditCost} credits, have ${user?.creditBalance ?? 0}.`); generateLockRef.current = false; return; }

    setIsGenerating(true);
    try {
      toast("Uploading files...", "info");
      const imageUrl = await uploadFileToStorage(faceImage, "image");

      let audioUrl: string | undefined;
      if (inputMode === "audio" && audioFile) {
        audioUrl = await uploadFileToStorage(audioFile, "audio");
      }

      // Upload product image if in product ad mode
      let uploadedProductImageUrl: string | undefined;
      if (isProductMode && productImage) {
        uploadedProductImageUrl = await uploadFileToStorage(productImage, "image");
      }

      // Resolve background prompt
      const bgPreset = BACKGROUND_PRESETS.find(b => b.id === selectedBackground);
      const backgroundPrompt = selectedBackground === "custom" ? customBackground : bgPreset?.prompt || "";

      toast("Starting avatar generation...", "info");
      const res = await fetch("/api/talking-avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl,
          text: inputMode === "script" ? scriptText.trim() : undefined,
          audioUrl: inputMode === "audio" ? audioUrl : undefined,
          voiceId: inputMode === "script" ? voiceId : undefined,
          duration,
          language,
          tone: selectedTone,
          aspectRatio,
          background: backgroundPrompt,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setJobId(data.jobId);
        if (uploadedProductImageUrl) setUploadedProductUrl(uploadedProductImageUrl);
        updateCreditBalance((user?.creditBalance ?? 0) - data.creditsCost);
        toast("Avatar generation started! This may take a few minutes.", "success");
      } else {
        setError(data.error || "Generation failed.");
        toast(data.error || "Generation failed", "error");
      }
    } catch (err) {
      console.error("Talking avatar generation failed:", err);
      setError("Network error. Please try again.");
      toast("Network error.", "error");
    } finally {
      setIsGenerating(false);
      generateLockRef.current = false;
    }
  };

  // ─── Poll for completion ──────────────────────────────────────────

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Enhancement pipeline — runs after avatar video completes
  const runEnhancement = useCallback(async (videoUrl: string) => {
    setIsEnhancing(true);
    try {
      if (uploadedProductUrl) setEnhanceStage("Creating product showcase intro...");
      else if (musicMood !== "none") setEnhanceStage("Mixing background music...");
      else if (subtitleStyle !== "none") setEnhanceStage("Burning captions...");

      const res = await fetch("/api/talking-avatar/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoUrl,
          jobId,
          musicMood: musicMood !== "none" ? musicMood : undefined,
          subtitleStyle: subtitleStyle !== "none" ? subtitleStyle : undefined,
          language,
          durationMs: duration * 1000,
          productImageUrl: uploadedProductUrl || undefined,
          productName: isProductMode ? productName : undefined,
          aspectRatio,
        }),
      });

      const data = await res.json();
      if (res.ok && data.videoUrl) {
        setResultVideoUrl(data.videoUrl);
        toast("Product ad ready!", "success");
      } else {
        setResultVideoUrl(videoUrl);
        toast(data.error || "Enhancement failed, showing original video.", "error");
      }
    } catch {
      setResultVideoUrl(videoUrl);
      toast("Enhancement failed, showing original video.", "error");
    } finally {
      setIsEnhancing(false);
      setEnhanceStage(null);
    }
  }, [musicMood, subtitleStyle, language, duration, jobId, toast, uploadedProductUrl, isProductMode, productName, aspectRatio]);

  useEffect(() => {
    if (!jobId || resultVideoUrl || isEnhancing) return;
    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.status === "completed" && data.outputVideoUrl) {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

          // If enhancements selected, run post-processing pipeline
          if (wantsEnhancement) {
            toast("Avatar generated! Now enhancing...", "success");
            runEnhancement(data.outputVideoUrl);
          } else {
            setResultVideoUrl(data.outputVideoUrl);
            toast("Talking avatar is ready!", "success");
          }
        } else if (data.status === "failed") {
          setError(data.errorMessage || "Generation failed. Credits refunded.");
          setJobId(null);
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          toast("Generation failed. Credits refunded.", "error");
        }
      } catch { /* retry on next interval */ }
    }, 5000);

    const timeout = setTimeout(() => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (!resultVideoUrl) {
        setError("Generation timed out. Check your gallery or try again.");
        setJobId(null);
      }
    }, 600000);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      clearTimeout(timeout);
    };
  }, [jobId, resultVideoUrl, isEnhancing, toast, wantsEnhancement, runEnhancement]);

  // ─── Drag & Drop ──────────────────────────────────────────────────

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    if (file.size > 10 * 1024 * 1024) { setError("Image too large (max 10MB)."); toast("Image too large", "error"); return; }
    setFaceImage(file);
    setError(null);
    const reader = new FileReader();
    reader.onload = () => setFaceImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  // Filter use cases by category
  const filteredUseCases = useCaseCategory
    ? USE_CASES.filter(uc => uc.category === useCaseCategory)
    : USE_CASES;

  // ─── Render ────────────────────────────────────────────────────────

  return (
    <PageTransition className="space-y-6">
      {/* ─── Hero Section ────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-violet-950/40 via-zinc-900/80 to-fuchsia-950/30 p-6 sm:p-8">
        {/* Animated gradient orbs */}
        <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-violet-600/10 blur-3xl animate-pulse" />
        <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-fuchsia-600/10 blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />

        <div className="relative z-10">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                  <Megaphone className="w-4 h-4 text-white" />
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-violet-400">Marketing Studio</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight">
                Turn Any Product Into a<br />
                <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-amber-400 bg-clip-text text-transparent">
                  High-Converting Video Ad
                </span>
              </h1>
              <p className="text-sm text-zinc-400 mt-2 max-w-lg">
                Upload your product, pick a face, and AI creates a professional spokesperson video with music and captions — ready to post on any platform.
              </p>
            </div>
          </div>

          {/* Stats row */}
          <div className="flex gap-6 mt-5 flex-wrap">
            {[
              { value: "90%", label: "cheaper than HeyGen" },
              { value: "19", label: "templates ready" },
              { value: "12", label: "AI voices" },
              { value: "6", label: "platforms" },
            ].map((stat) => (
              <div key={stat.label} className="flex items-baseline gap-1.5">
                <span className="text-lg font-bold text-white">{stat.value}</span>
                <span className="text-[10px] text-zinc-400">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Plan Gate */}
      {!isPlanAllowed && !isLoading && (
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <Lock className="w-5 h-5 text-amber-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-300">Creator plan required</p>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Upgrade to create professional video ads — starts at R220/month.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Mode Toggle: Avatar Only vs Product Ad ─────────────────── */}
      <div className="flex gap-1.5 p-1.5 rounded-2xl bg-white/[0.04] border border-white/[0.08]">
        <button
          onClick={() => setIsProductMode(false)}
          className={`flex-1 flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-xl text-sm font-medium transition-all duration-300 ${
            !isProductMode
              ? "bg-gradient-to-r from-violet-600/20 to-fuchsia-600/20 text-violet-300 border border-violet-500/30 shadow-lg shadow-violet-600/10"
              : "text-zinc-400 hover:text-zinc-300 hover:bg-white/[0.04] border border-transparent"
          }`}
        >
          <MessageCircle className="w-4 h-4" />
          <div className="text-left">
            <div>Spokesperson Video</div>
            <div className="text-[10px] opacity-60 font-normal">Custom avatar with your script</div>
          </div>
        </button>
        <button
          onClick={() => setIsProductMode(true)}
          className={`flex-1 flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-xl text-sm font-medium transition-all duration-300 ${
            isProductMode
              ? "bg-gradient-to-r from-amber-600/20 to-orange-600/20 text-amber-300 border border-amber-500/30 shadow-lg shadow-amber-600/10"
              : "text-zinc-400 hover:text-zinc-300 hover:bg-white/[0.04] border border-transparent"
          }`}
        >
          <Package className="w-4 h-4" />
          <div className="text-left">
            <div>Product Ad Studio</div>
            <div className="text-[10px] opacity-60 font-normal">AI builds your entire ad</div>
          </div>
        </button>
      </div>

      {/* What you get — only show when nothing is in progress */}
      {!jobId && !resultVideoUrl && !isEnhancing && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-violet-500/[0.06] border border-violet-500/[0.12]">
            <ImageIcon className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />
            <span className="text-[11px] text-zinc-300">{isProductMode ? "Product showcase intro" : "AI lip-sync avatar"}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-fuchsia-500/[0.06] border border-fuchsia-500/[0.12]">
            <Wand2 className="w-3.5 h-3.5 text-fuchsia-400 flex-shrink-0" />
            <span className="text-[11px] text-zinc-300">AI-written script</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-amber-500/[0.06] border border-amber-500/[0.12]">
            <Music className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
            <span className="text-[11px] text-zinc-300">Background music</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/[0.12]">
            <Captions className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            <span className="text-[11px] text-zinc-300">Auto-captions burned in</span>
          </div>
        </div>
      )}

      {/* ─── Product Ad Mode ─────────────────────────────────────────── */}
      {isProductMode && (
        <Card className="border-amber-500/20 bg-gradient-to-br from-amber-500/[0.03] to-orange-500/[0.03] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl" />
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                <Package className="w-3 h-3 text-white" />
              </div>
              What Are You Selling?
              <span className="text-[10px] text-amber-400/60 font-normal ml-auto">AI does the rest</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Product Image */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                {productImagePreview ? (
                  <div className="relative rounded-xl overflow-hidden border border-amber-500/20 bg-black/30 h-40">
                    <img src={productImagePreview} alt="Product" className="w-full h-full object-contain" />
                    <button
                      onClick={() => { setProductImage(null); setProductImagePreview(null); if (productInputRef.current) productInputRef.current.value = ""; }}
                      className="absolute top-2 right-2 p-1 rounded-lg bg-black/60 hover:bg-red-500/80 text-white transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center h-40 rounded-xl border-2 border-dashed border-amber-500/20 hover:border-amber-500/40 bg-white/[0.02] hover:bg-amber-500/5 cursor-pointer transition-all group">
                    <input ref={productInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleProductImageUpload} className="hidden" />
                    <Package className="w-6 h-6 text-amber-400/60 mb-2 group-hover:text-amber-400" />
                    <span className="text-xs text-zinc-400 group-hover:text-amber-300">Upload product image</span>
                    <span className="text-[10px] text-zinc-400 mt-0.5">Optional — helps AI context</span>
                  </label>
                )}
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Product Name *</label>
                  <input
                    type="text"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    placeholder="e.g. Genesis Studio, Nike Air Max, ..."
                    className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.12] text-sm text-zinc-300 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">What does it do?</label>
                  <Textarea
                    value={productDescription}
                    onChange={(e) => setProductDescription(e.target.value)}
                    placeholder="Key benefits, target audience, unique features..."
                    className="min-h-[60px] bg-white/[0.05] border-white/[0.12] text-sm text-zinc-300 placeholder:text-zinc-400 resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Generate Product Script Button */}
            <Button
              onClick={generateProductScript}
              disabled={!productName.trim() || productAiLoading}
              loading={productAiLoading}
              className="w-full bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-500 hover:to-orange-400 text-white font-medium rounded-xl shadow-lg shadow-amber-600/20 disabled:opacity-40"
            >
              <Wand2 className="w-4 h-4 mr-2" />
              {productAiLoading ? "AI Writing Your Ad..." : "Generate Product Ad Script"}
            </Button>

            {scriptText && productName && (
              <div className="flex items-center gap-2 text-[11px] text-emerald-400">
                <CheckCircle2 className="w-3 h-3" />
                Script ready — scroll down to customize voice, platform & generate
              </div>
            )}

            {/* Quick-fill examples for inspiration */}
            <div className="pt-2 border-t border-white/[0.06]">
              <p className="text-[10px] text-zinc-400 mb-2">Quick-fill examples — click to try:</p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { name: "AI Video Platform", desc: "Create professional videos with AI in minutes. Text to video, talking avatars, auto-captions, background music. 10x faster than traditional editing." },
                  { name: "Project Management App", desc: "Kanban boards, time tracking, team collaboration. Replace 5 tools with one. Used by 50,000+ teams." },
                  { name: "E-commerce Store Builder", desc: "Launch your online store in 60 seconds. AI-designed templates, one-click payments, built-in marketing tools." },
                  { name: "Fitness Coaching App", desc: "Personalized workout plans powered by AI. Track progress, get form feedback from your camera, join challenges." },
                  { name: "Social Media Scheduler", desc: "Schedule posts across all platforms. AI writes captions, finds best posting times, tracks analytics." },
                ].map((ex) => (
                  <button
                    key={ex.name}
                    onClick={() => { setProductName(ex.name); setProductDescription(ex.desc); }}
                    className="text-[10px] px-2 py-1 rounded-md bg-white/[0.05] border border-white/[0.08] text-zinc-400 hover:text-amber-300 hover:border-amber-500/30 transition-colors"
                  >
                    {ex.name}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── STEP 0: Use Case Templates ─────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setShowUseCases(!showUseCases)}
          >
            <span className="flex items-center gap-2 text-sm">
              <Target className="w-4 h-4 text-violet-400" />
              Start with a Template
              <span className="text-[10px] text-zinc-400 font-normal ml-1">
                {selectedUseCase ? USE_CASES.find(u => u.id === selectedUseCase)?.name : "Optional"}
              </span>
            </span>
            {showUseCases ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
          </CardTitle>
        </CardHeader>
        {showUseCases && (
          <CardContent className="space-y-3">
            {/* Category Filter */}
            <div className="flex gap-1.5 flex-wrap">
              <button
                onClick={() => setUseCaseCategory(null)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                  !useCaseCategory
                    ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                    : "bg-white/[0.05] text-zinc-400 hover:text-zinc-300 border border-white/[0.08]"
                }`}
              >
                All
              </button>
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setUseCaseCategory(key)}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                    useCaseCategory === key
                      ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                      : "bg-white/[0.05] text-zinc-400 hover:text-zinc-300 border border-white/[0.08]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Template Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {filteredUseCases.map((uc) => {
                const Icon = uc.icon;
                return (
                  <button
                    key={uc.id}
                    onClick={() => handleSelectUseCase(uc)}
                    className={`flex flex-col items-start gap-1.5 p-3 rounded-xl text-left transition-all duration-200 group ${
                      selectedUseCase === uc.id
                        ? "bg-violet-500/15 border border-violet-500/30 ring-1 ring-violet-500/20"
                        : "bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] hover:border-violet-500/20"
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${selectedUseCase === uc.id ? "text-violet-400" : "text-zinc-400 group-hover:text-violet-400"} transition-colors`} />
                    <span className={`text-xs font-medium ${selectedUseCase === uc.id ? "text-violet-300" : "text-zinc-300"}`}>
                      {uc.name}
                    </span>
                    <span className="text-[10px] text-zinc-400 line-clamp-2 leading-relaxed">
                      {uc.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ─── Left Column: Main Inputs ──────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">

          {/* Step 1: Face Photo */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <div className="w-5 h-5 rounded-full bg-violet-500/20 flex items-center justify-center text-[10px] font-bold text-violet-400">1</div>
                {isProductMode ? "Your Spokesperson" : "Face Photo"}
                <span className="text-[10px] text-zinc-400 font-normal ml-auto">{faceImage ? "Ready" : "Required"}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {faceImagePreview ? (
                <div className="relative rounded-xl overflow-hidden border border-white/[0.12] bg-black/30">
                  <img src={faceImagePreview} alt="Face preview" className="w-full h-56 object-contain" />
                  <button
                    onClick={clearFaceImage}
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 hover:bg-red-500/80 text-white transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label
                  className="flex flex-col items-center justify-center h-56 rounded-xl border-2 border-dashed border-white/10 hover:border-violet-500/40 bg-white/[0.04] hover:bg-violet-500/5 cursor-pointer transition-all duration-300 group"
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                >
                  <input ref={faceInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFaceImageUpload} className="hidden" />
                  <div className="w-14 h-14 rounded-2xl bg-violet-500/10 flex items-center justify-center mb-3 group-hover:bg-violet-500/20 transition-colors">
                    <Upload className="w-7 h-7 text-violet-400" />
                  </div>
                  <span className="text-sm font-medium text-zinc-400 group-hover:text-violet-300 transition-colors">
                    Drop a face photo or click to upload
                  </span>
                  <span className="text-xs text-zinc-400 mt-1">PNG, JPEG or WebP — max 10MB — clear front-facing face works best</span>
                </label>
              )}

              {/* AI Suggest Face — visible in Product Ad Mode when no face selected and no suggestions showing */}
              {isProductMode && !faceImage && suggestedFaces.length === 0 && (
                <div className="mt-3">
                  <button
                    onClick={suggestFaces}
                    disabled={faceGenLoading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-amber-600/20 to-orange-600/20 border border-amber-500/30 text-amber-300 hover:from-amber-600/30 hover:to-orange-600/30 transition-all text-sm font-medium disabled:opacity-50"
                  >
                    {faceGenLoading ? (
                      <><GenesisButtonLoader /> Generating spokesperson options...</>
                    ) : (
                      <><Sparkles className="w-4 h-4" /> Suggest Spokesperson Face</>
                    )}
                  </button>
                  <p className="text-[10px] text-zinc-400 mt-1.5 text-center">
                    AI picks the ideal face for your {productName || "product"} ad (10 credits for 4 options)
                  </p>
                </div>
              )}

              {/* Loading state while generating faces */}
              {faceGenLoading && suggestedFaces.length === 0 && (
                <div className="mt-3 flex flex-col items-center justify-center py-8 rounded-xl bg-white/[0.04] border border-amber-500/20">
                  <GenesisLoader size="sm" />
                  <p className="text-sm text-amber-300 font-medium mt-3">Finding the perfect spokesperson...</p>
                  <p className="text-[10px] text-zinc-400 mt-1">AI is analyzing your product and generating 4 face options</p>
                </div>
              )}

              {/* Suggested Faces Grid */}
              {suggestedFaces.length > 0 && (
                <div className="mt-3 space-y-3">
                  <label className="block text-xs font-medium text-violet-300">Pick your spokesperson — click any face to use it</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {suggestedFaces.map((face, i) => (
                      <button
                        key={i}
                        onClick={() => selectSuggestedFace(face)}
                        className="relative rounded-xl overflow-hidden border-2 border-white/[0.12] hover:border-violet-500 hover:shadow-lg hover:shadow-violet-500/20 transition-all duration-200 cursor-pointer group aspect-[3/4] focus:outline-none focus:ring-2 focus:ring-violet-500"
                      >
                        <img src={face} alt={`Spokesperson option ${i + 1}`} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-end justify-center pb-3">
                          <span className="text-white text-xs font-semibold bg-violet-600 px-4 py-2 rounded-lg shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-transform duration-200">
                            Select This Face
                          </span>
                        </div>
                        <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/50 flex items-center justify-center text-white text-[10px] font-bold">
                          {i + 1}
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={suggestFaces}
                      disabled={faceGenLoading}
                      className="flex-1 text-[11px] px-3 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 hover:bg-amber-500/20 transition-colors font-medium disabled:opacity-50"
                    >
                      {faceGenLoading ? "Generating..." : "Generate New Options (10 credits)"}
                    </button>
                    <button
                      onClick={() => setSuggestedFaces([])}
                      className="text-[11px] px-3 py-2.5 rounded-lg bg-white/[0.05] border border-white/[0.10] text-zinc-400 hover:text-zinc-300 hover:bg-white/[0.08] transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Step 2: Voice Input */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <div className="w-5 h-5 rounded-full bg-violet-500/20 flex items-center justify-center text-[10px] font-bold text-violet-400">2</div>
                {isProductMode ? "Ad Script & Voice" : "Voice Input"}
                <span className="text-[10px] text-zinc-400 font-normal ml-auto">{scriptText ? `${scriptText.split(/\s+/).filter(Boolean).length} words` : "Required"}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Tabs */}
              <div className="flex gap-1 p-1 rounded-xl bg-white/[0.05] border border-white/[0.10]">
                {([
                  { key: "script" as const, label: "Type Script", icon: MessageCircle },
                  { key: "audio" as const, label: "Upload Audio", icon: Upload },
                ]).map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setInputMode(tab.key)}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                      inputMode === tab.key
                        ? "bg-violet-500/15 text-violet-300 border border-violet-500/30"
                        : "text-zinc-400 hover:text-zinc-300 hover:bg-white/[0.04] border border-transparent"
                    }`}
                  >
                    <tab.icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Script Mode */}
              {inputMode === "script" && (
                <div className="space-y-3">
                  <div className="relative">
                    <Textarea
                      value={scriptText}
                      onChange={(e) => setScriptText(e.target.value)}
                      placeholder="Type what the avatar should say... e.g. 'Hi! I'm Sarah, and today I'll show you how our product can save you 3 hours every week.'"
                      className="min-h-[140px] bg-white/[0.05] border-white/[0.12] text-zinc-200 placeholder:text-zinc-400 resize-none pr-4"
                    />
                  </div>

                  {/* Script toolbar */}
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-zinc-400">{scriptText.length}/1000</span>
                      {scriptText.length > 0 && (
                        <span className="text-[10px] text-zinc-400">
                          ~{Math.ceil(scriptText.split(/\s+/).filter(Boolean).length / 2.5)}s reading time
                        </span>
                      )}
                    </div>

                    {/* AI Script Toolkit */}
                    <div className="relative">
                      <button
                        onClick={() => setAiToolOpen(!aiToolOpen)}
                        disabled={aiLoading}
                        className="text-[11px] px-3 py-1.5 rounded-lg bg-gradient-to-r from-violet-600/20 to-fuchsia-600/20 border border-violet-500/30 text-violet-300 hover:from-violet-600/30 hover:to-fuchsia-600/30 transition-all flex items-center gap-1.5 font-medium"
                      >
                        {aiLoading ? <GenesisButtonLoader /> : <Wand2 className="w-3 h-3" />}
                        AI Script Tools
                        <ChevronDown className="w-3 h-3" />
                      </button>

                      {aiToolOpen && !aiLoading && (
                        <div className="absolute right-0 top-full mt-1.5 w-56 rounded-xl bg-zinc-900 border border-white/[0.12] shadow-2xl shadow-black/40 z-50 py-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
                          {[
                            { action: "write", icon: Sparkles, label: "Write Full Script", desc: "AI generates from your topic" },
                            { action: "shorten", icon: Scissors, label: "Make Shorter", desc: "Trim to under 80 words" },
                            { action: "hook", icon: Target, label: "Better Hook", desc: "Rewrite the first line" },
                            { action: "cta", icon: Megaphone, label: "Add CTA", desc: "Add call-to-action" },
                            { action: "punchier", icon: Zap, label: "Make Punchier", desc: "More energy & power words" },
                            { action: "translate", icon: Languages, label: `Translate to ${LANGUAGES.find(l => l.code === language)?.label || "..."}`, desc: "Natural translation" },
                          ].map((item) => (
                            <button
                              key={item.action}
                              onClick={() => aiScriptAction(item.action)}
                              className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-white/[0.06] transition-colors group"
                            >
                              <item.icon className="w-3.5 h-3.5 text-zinc-400 group-hover:text-violet-400 transition-colors flex-shrink-0" />
                              <div>
                                <p className="text-xs font-medium text-zinc-300 group-hover:text-violet-300 transition-colors">{item.label}</p>
                                <p className="text-[10px] text-zinc-400">{item.desc}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Voice Selection */}
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                      <Volume2 className="w-3 h-3 inline mr-1" />
                      Voice
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                      {VOICE_OPTIONS.map((voice) => (
                        <button
                          key={voice.id}
                          onClick={() => setVoiceId(voice.id)}
                          className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                            voiceId === voice.id
                              ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                              : "bg-white/[0.05] text-zinc-400 hover:text-zinc-300 border border-white/[0.10]"
                          }`}
                        >
                          <span>
                            <span>{voice.name}</span>
                            <span className="ml-1 text-[10px] text-zinc-400">
                              {voice.gender === "female" ? "F" : "M"} / {voice.language}
                            </span>
                          </span>
                          <span
                            onClick={(e) => handlePreviewVoice(voice.id, e)}
                            className={`ml-1 flex h-5 w-5 items-center justify-center rounded-full transition-all ${
                              previewingVoice === voice.id
                                ? "bg-violet-500 text-white"
                                : "bg-zinc-700/50 text-zinc-400 hover:bg-violet-500/30 hover:text-violet-300"
                            }`}
                            title={previewingVoice === voice.id ? "Stop" : "Preview"}
                          >
                            {loadingPreview === voice.id ? (
                              <GenesisButtonLoader />
                            ) : previewingVoice === voice.id ? (
                              <Square className="h-2 w-2" />
                            ) : (
                              <Play className="h-2.5 w-2.5 ml-px" />
                            )}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Audio Upload Mode */}
              {inputMode === "audio" && (
                <div>
                  {audioFileName ? (
                    <div className="flex items-center gap-3 p-4 rounded-xl border border-white/[0.12] bg-white/[0.04]">
                      <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
                        <Mic className="w-5 h-5 text-violet-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-zinc-300 truncate">{audioFileName}</p>
                        <p className="text-[10px] text-zinc-400">Ready to use</p>
                      </div>
                      <button onClick={clearAudio} className="p-1.5 rounded-lg hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center h-32 rounded-xl border-2 border-dashed border-white/10 hover:border-violet-500/40 bg-white/[0.04] hover:bg-violet-500/5 cursor-pointer transition-all duration-300 group">
                      <input ref={audioInputRef} type="file" accept="audio/mpeg,audio/wav,audio/mp3,audio/x-wav" onChange={handleAudioUpload} className="hidden" />
                      <Mic className="w-6 h-6 text-violet-400 mb-2" />
                      <span className="text-sm font-medium text-zinc-400 group-hover:text-violet-300 transition-colors">Upload audio file</span>
                      <span className="text-xs text-zinc-400 mt-1">MP3 or WAV — max 25MB</span>
                    </label>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Step 3: Platform & Tone */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <div className="w-5 h-5 rounded-full bg-violet-500/20 flex items-center justify-center text-[10px] font-bold text-violet-400">3</div>
                Platform & Style
                <span className="text-[10px] text-zinc-400 font-normal ml-auto">{PLATFORM_PRESETS.find(p => p.id === selectedPlatform)?.name || "Custom"}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Platform */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-2">Platform</label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                  {PLATFORM_PRESETS.map((p) => {
                    const Icon = p.icon;
                    return (
                      <button
                        key={p.id}
                        onClick={() => handleSelectPlatform(p)}
                        className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-lg text-[11px] font-medium transition-all ${
                          selectedPlatform === p.id
                            ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                            : "bg-white/[0.05] text-zinc-400 hover:text-zinc-300 border border-white/[0.08]"
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span className="text-center leading-tight">{p.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Aspect Ratio (always visible) */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-2">Aspect Ratio</label>
                <div className="flex gap-2">
                  {([
                    { ratio: "16:9" as const, icon: RectangleHorizontal, label: "16:9 Landscape" },
                    { ratio: "9:16" as const, icon: Smartphone, label: "9:16 Portrait" },
                    { ratio: "1:1" as const, icon: SquareIcon, label: "1:1 Square" },
                  ]).map((ar) => (
                    <button
                      key={ar.ratio}
                      onClick={() => setAspectRatio(ar.ratio)}
                      className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                        aspectRatio === ar.ratio
                          ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                          : "bg-white/[0.05] text-zinc-400 hover:text-zinc-300 border border-white/[0.08]"
                      }`}
                    >
                      <ar.icon className="w-3.5 h-3.5" />
                      {ar.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tone */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-2">Delivery Tone</label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                  {TONE_OPTIONS.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTone(t.id)}
                      className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-lg transition-all ${
                        selectedTone === t.id
                          ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                          : "bg-white/[0.05] text-zinc-400 hover:text-zinc-300 border border-white/[0.08]"
                      }`}
                    >
                      <span className="text-sm">{t.emoji}</span>
                      <span className="text-[11px] font-medium">{t.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Step 4: Music & Subtitles */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <div className="w-5 h-5 rounded-full bg-violet-500/20 flex items-center justify-center text-[10px] font-bold text-violet-400">4</div>
                Post-Production
                {(musicMood !== "none" || subtitleStyle !== "none") ? (
                  <span className="text-[10px] text-emerald-400 font-normal ml-auto">Enhanced</span>
                ) : (
                  <span className="text-[10px] text-zinc-400 font-normal ml-auto">Optional — makes it viral</span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Background Music */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-2">
                  <Music className="w-3 h-3 inline mr-1" />
                  Background Music
                </label>
                <div className="grid grid-cols-4 sm:grid-cols-4 gap-1.5">
                  {MUSIC_MOODS.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setMusicMood(m.id)}
                      className={`flex flex-col items-center gap-1 px-2 py-2 rounded-lg transition-all ${
                        musicMood === m.id
                          ? m.id === "none"
                            ? "bg-zinc-700/30 text-zinc-300 border border-zinc-600/40"
                            : "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                          : "bg-white/[0.05] text-zinc-400 hover:text-zinc-300 border border-white/[0.08]"
                      }`}
                    >
                      <span className="text-sm">{m.emoji}</span>
                      <span className="text-[10px] font-medium">{m.name}</span>
                    </button>
                  ))}
                </div>
                {musicMood !== "none" && (
                  <p className="text-[10px] text-zinc-400 mt-1.5">
                    AI generates a {musicMood} track, mixed softly under the voice (+3 credits)
                  </p>
                )}
              </div>

              {/* Auto-Captions */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-2">
                  <Captions className="w-3 h-3 inline mr-1" />
                  Auto-Captions
                </label>
                <div className="grid grid-cols-5 gap-1.5">
                  {SUBTITLE_STYLES.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSubtitleStyle(s.id)}
                      className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-lg transition-all ${
                        subtitleStyle === s.id
                          ? s.id === "none"
                            ? "bg-zinc-700/30 text-zinc-300 border border-zinc-600/40"
                            : "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                          : "bg-white/[0.05] text-zinc-400 hover:text-zinc-300 border border-white/[0.08]"
                      }`}
                    >
                      <span className="text-[11px] font-medium">{s.name}</span>
                    </button>
                  ))}
                </div>
                {subtitleStyle !== "none" && (
                  <p className="text-[10px] text-zinc-400 mt-1.5">
                    {SUBTITLE_STYLES.find(s => s.id === subtitleStyle)?.preview} (+5 credits)
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ─── Right Column: Settings & Generate ──────────────────────── */}
        <div className="hidden lg:block space-y-4">

          {/* Background / Setting */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Palette className="w-4 h-4 text-violet-400" />
                Background
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-1.5">
                {BACKGROUND_PRESETS.map((bg) => (
                  <button
                    key={bg.id}
                    onClick={() => setSelectedBackground(bg.id)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all text-left ${
                      selectedBackground === bg.id
                        ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                        : "bg-white/[0.05] text-zinc-400 hover:text-zinc-300 border border-white/[0.10]"
                    }`}
                  >
                    {bg.name}
                  </button>
                ))}
              </div>
              {selectedBackground === "custom" && (
                <input
                  type="text"
                  value={customBackground}
                  onChange={(e) => setCustomBackground(e.target.value)}
                  placeholder="Describe the background scene..."
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.12] text-xs text-zinc-300 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                />
              )}
            </CardContent>
          </Card>

          {/* Duration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-violet-400" />
                Duration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-1.5">
                {DURATIONS.map((d) => (
                  <button
                    key={d}
                    onClick={() => setDuration(d)}
                    className={`px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                      duration === d
                        ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                        : "bg-white/[0.05] text-zinc-400 hover:text-zinc-300 border border-white/[0.10]"
                    }`}
                  >
                    {d}s
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Language */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Globe className="w-4 h-4 text-violet-400" />
                Language
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-1.5">
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => setLanguage(lang.code)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      language === lang.code
                        ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                        : "bg-white/[0.05] text-zinc-400 hover:text-zinc-300 border border-white/[0.10]"
                    }`}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Credit Cost */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Zap className="w-4 h-4 text-amber-400" />
                Cost Estimate
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400">Duration</span>
                <span className="text-xs text-zinc-300">{duration}s</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400">Platform</span>
                <span className="text-xs text-zinc-300">{PLATFORM_PRESETS.find(p => p.id === selectedPlatform)?.name || "Custom"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400">Aspect Ratio</span>
                <span className="text-xs text-zinc-300">{aspectRatio}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400">Tone</span>
                <span className="text-xs text-zinc-300 capitalize">{selectedTone}</span>
              </div>
              {isProductMode && productImage && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400">Product showcase intro</span>
                  <span className="text-xs text-zinc-300">+15</span>
                </div>
              )}
              {musicMood !== "none" && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400">Music ({musicMood})</span>
                  <span className="text-xs text-zinc-300">+3</span>
                </div>
              )}
              {subtitleStyle !== "none" && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400">Captions ({subtitleStyle})</span>
                  <span className="text-xs text-zinc-300">+5</span>
                </div>
              )}
              <div className="h-px bg-white/[0.06]" />
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-zinc-300">Total</span>
                <span className="text-sm font-bold text-amber-400">{creditCost} credits</span>
              </div>
              {!hasEnoughCredits && !user?.isOwner && (
                <p className="text-[11px] text-red-400">
                  Insufficient credits. You have {user?.creditBalance ?? 0}.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={!canGenerate || isGenerating}
            loading={isGenerating}
            className="w-full h-14 bg-gradient-to-r from-violet-600 via-fuchsia-500 to-amber-500 hover:from-violet-500 hover:via-fuchsia-400 hover:to-amber-400 text-white font-semibold rounded-xl shadow-lg shadow-violet-600/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300 text-base"
          >
            {!isPlanAllowed ? (
              <span className="flex items-center gap-2"><Lock className="w-4 h-4" />Upgrade to Create Ads</span>
            ) : isProductMode ? (
              <span className="flex items-center gap-2"><Megaphone className="w-5 h-5" />Create Product Ad</span>
            ) : (
              <span className="flex items-center gap-2"><Play className="w-5 h-5" />Generate Video</span>
            )}
          </Button>
          {canGenerate && !isGenerating && (
            <p className="text-[10px] text-zinc-400 text-center">
              {isProductMode
                ? "Product showcase + spokesperson + music + captions"
                : "AI lip-sync video ready in 1-3 minutes"}
            </p>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}
        </div>
      </div>

      {/* ─── Result ──────────────────────────────────────────────────── */}
      {(jobId || resultVideoUrl || isEnhancing) && (
        <Card className={resultVideoUrl ? "border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.02] to-violet-500/[0.02]" : ""}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              {resultVideoUrl ? (
                <><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Your Video Is Ready</>
              ) : (
                <><Play className="w-4 h-4 text-violet-400" /> Creating Your {isProductMode ? "Product Ad" : "Video"}...</>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {resultVideoUrl ? (
              <>
                <div className="rounded-xl overflow-hidden border border-white/[0.12] bg-black/30">
                  <video
                    src={resultVideoUrl}
                    className="w-full max-h-[480px] object-contain"
                    controls
                    autoPlay
                    onError={() => setError("Failed to load video. It may still be processing — check your gallery.")}
                  />
                </div>
                <div className="flex gap-2">
                  <a
                    href={resultVideoUrl}
                    download={`talking-avatar-${jobId || "video"}.mp4`}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-violet-500/10 hover:bg-violet-500/20 text-violet-300 text-sm font-medium transition-colors border border-violet-500/20"
                  >
                    <Upload className="w-4 h-4 rotate-180" />
                    Download
                  </a>
                  <button
                    onClick={() => { setResultVideoUrl(null); setJobId(null); }}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.10] text-zinc-300 text-sm font-medium transition-colors border border-white/[0.10]"
                  >
                    <Sparkles className="w-4 h-4" />
                    Create Another
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 rounded-xl bg-white/[0.04] border border-white/[0.10]">
                <GenesisLoader size="md" />
                {isEnhancing ? (
                  <>
                    <p className="text-sm text-zinc-300 font-medium mt-3">Enhancing your video...</p>
                    <p className="text-[11px] text-violet-400 mt-1.5">{enhanceStage || "Adding music & captions..."}</p>
                    <div className="flex gap-3 mt-3">
                      {musicMood !== "none" && (
                        <span className="text-[10px] px-2 py-1 rounded-md bg-violet-500/10 border border-violet-500/20 text-violet-300">
                          <Music className="w-3 h-3 inline mr-1" />{musicMood}
                        </span>
                      )}
                      {subtitleStyle !== "none" && (
                        <span className="text-[10px] px-2 py-1 rounded-md bg-violet-500/10 border border-violet-500/20 text-violet-300">
                          <Captions className="w-3 h-3 inline mr-1" />{subtitleStyle}
                        </span>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-zinc-300 font-medium mt-3">Generating your talking avatar...</p>
                    <p className="text-[11px] text-zinc-400 mt-1.5">
                      This may take 1-3 minutes{wantsEnhancement ? " — music & captions will be added after" : " — you can leave this page"}
                    </p>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Error display — visible on all screens */}
      {error && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 lg:hidden">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {/* ─── Mobile: Fixed Generate ──────────────────────────────────── */}
      <MobileActionBar>
        <Button
          className="w-full shadow-lg shadow-violet-600/20 h-12 bg-gradient-to-r from-violet-600 via-fuchsia-500 to-amber-500"
          disabled={!canGenerate || isGenerating}
          loading={isGenerating}
          onClick={handleGenerate}
        >
          {isGenerating ? "Creating your ad..." : !isPlanAllowed ? (
            <><Lock className="w-4 h-4" /> Upgrade to Create Ads</>
          ) : isProductMode ? (
            <><Megaphone className="w-4 h-4" /> Create Product Ad — {creditCost} cr</>
          ) : (
            <><Play className="w-4 h-4" /> Generate Video — {creditCost} cr</>
          )}
        </Button>
      </MobileActionBar>

      {/* Click-away for AI tool dropdown */}
      {aiToolOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setAiToolOpen(false)} />
      )}

      <div className="h-20 lg:hidden" />
    </PageTransition>
  );
}
