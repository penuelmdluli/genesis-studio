import { NextResponse } from "next/server";

export interface Trend {
  id: string;
  title: string;
  description: string;
  platform: "tiktok" | "twitter" | "news" | "general";
  category: "music" | "dance" | "challenge" | "news" | "meme" | "topic";
  suggestedPrompt: string;
  suggestedLyrics?: string;
  trendScore: number;
}

// Curated trending topics — updated regularly
// In production, these would be fetched from APIs and cached in KV
const TRENDING_NOW: Trend[] = [
  {
    id: "trend-1",
    title: "AI Cover Songs",
    description: "Create AI covers of popular songs with any face",
    platform: "tiktok",
    category: "music",
    suggestedPrompt: "Singer performing a soulful cover, intimate studio lighting, emotional delivery",
    suggestedLyrics: "[Verse 1]\nTake me back to where it started\nWhen the world was open-hearted\n(oh yeah)\n\n[Chorus]\nWe were golden, we were shining\nEvery star was ours for finding\nNow I'm searching for that feeling\nThat we lost without a reason",
    trendScore: 95,
  },
  {
    id: "trend-2",
    title: "Amapiano Dance Challenge",
    description: "Viral dance moves with amapiano beats",
    platform: "tiktok",
    category: "dance",
    suggestedPrompt: "Person dancing to amapiano music, vibrant South African street scene, golden hour light, infectious energy, viral dance moves",
    trendScore: 92,
  },
  {
    id: "trend-3",
    title: "Day in My Life AI",
    description: "AI-generated day-in-the-life content",
    platform: "tiktok",
    category: "challenge",
    suggestedPrompt: "Cinematic day-in-the-life montage: morning coffee, city commute, work moments, sunset rooftop, night skyline. Smooth transitions, warm tones, aspirational lifestyle.",
    trendScore: 88,
  },
  {
    id: "trend-4",
    title: "Emotional Storytelling",
    description: "Short emotional stories that make viewers feel",
    platform: "general",
    category: "topic",
    suggestedPrompt: "Close-up of a person looking directly at camera with deep emotion, tears forming, warm natural lighting, intimate documentary style",
    suggestedLyrics: "[Verse 1]\nThey said I wouldn't make it\nBut look at me now\nEvery scar tells a story\nOf how I found my crown\n\n[Chorus]\nI'm rising, I'm rising\nFrom the ashes of my past\nI'm flying, I'm flying\nFound my wings at last",
    trendScore: 90,
  },
  {
    id: "trend-5",
    title: "Product Showcase Reels",
    description: "Satisfying product reveal videos",
    platform: "tiktok",
    category: "challenge",
    suggestedPrompt: "Sleek product rotating on glossy surface, dramatic studio lighting, slow reveal, Apple-style commercial quality, clean minimalist background",
    trendScore: 85,
  },
  {
    id: "trend-6",
    title: "AI Music Video Challenge",
    description: "Make yourself the star of a music video with AI",
    platform: "tiktok",
    category: "music",
    suggestedPrompt: "Music artist performing on a massive stage, concert lighting, fog machines, crowd going wild, cinematic camera angles",
    suggestedLyrics: "[Chorus]\nI'm the main character\nLiving in my movie\nEvery scene's a banger\nAnd the plot is groovy\n(yeah yeah yeah)\n\n[Verse 1]\nWoke up feeling legendary\nMirror mirror, extraordinary\nCamera rolling, lights are on me\nThis is my story, watch it unfold",
    trendScore: 93,
  },
  {
    id: "trend-7",
    title: "Motivational Speaking",
    description: "Powerful motivational content with AI avatars",
    platform: "general",
    category: "topic",
    suggestedPrompt: "Confident speaker in professional setting, direct eye contact with camera, warm motivational energy, clean modern office background, inspirational atmosphere",
    trendScore: 82,
  },
  {
    id: "trend-8",
    title: "Afrofuturism Visuals",
    description: "Stunning afrofuturistic sci-fi scenes",
    platform: "twitter",
    category: "meme",
    suggestedPrompt: "Afrofuturistic cityscape at sunset, advanced technology blended with African architecture, flying vehicles, holographic displays, vibrant purple and gold palette, stunning cinematic quality",
    trendScore: 87,
  },
  {
    id: "trend-9",
    title: "Gospel Worship Video",
    description: "Powerful worship music videos",
    platform: "general",
    category: "music",
    suggestedPrompt: "Gospel choir performing in beautiful church, sunlight streaming through stained glass, powerful vocals, emotional worship, heavenly atmosphere",
    suggestedLyrics: "[Chorus]\nYou are worthy, You are holy\nIn Your presence I am free\nEvery burden, every sorrow\nYou have taken it from me\n\n[Verse 1]\nWhen the darkness tried to hold me\nYour light broke through the night\nWhen the storm was raging round me\nYou became my guiding light",
    trendScore: 80,
  },
  {
    id: "trend-10",
    title: "Drill Music Videos",
    description: "Hard-hitting drill music content",
    platform: "tiktok",
    category: "music",
    suggestedPrompt: "Rapper performing drill music in urban setting, dark moody lighting, handheld camera movement, gritty streets, intense energy, smoke effects",
    suggestedLyrics: "[Verse 1]\nStepping on the block like I own it (yeah)\nEvery word I spit, I've shown it\nFrom the bottom to the top floor\nThey don't want war, what they knock for?\n\n[Chorus]\nWe don't stop, we don't fold\nEvery bar worth its weight in gold\nRun the city, run the game\nRemember the face, remember the name",
    trendScore: 86,
  },
];

export async function GET() {
  // In future: fetch from NewsAPI, TikTok trending, Twitter trending
  // and cache in KV. For now, return curated trends.
  // TODO: Add real-time trending from APIs

  // Shuffle slightly to keep it fresh (but deterministic per hour)
  const hourSeed = Math.floor(Date.now() / 3600000);
  const shuffled = [...TRENDING_NOW].sort((a, b) => {
    const aScore = a.trendScore + ((hourSeed * 13 + a.id.charCodeAt(6)) % 10);
    const bScore = b.trendScore + ((hourSeed * 13 + b.id.charCodeAt(6)) % 10);
    return bScore - aScore;
  });

  return NextResponse.json(
    { trends: shuffled },
    {
      headers: {
        "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
      },
    }
  );
}
