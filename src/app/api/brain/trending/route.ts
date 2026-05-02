import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isOwnerClerkId } from "@/lib/credits";

/**
 * GET /api/brain/trending
 *
 * Owner-only: returns trending war/geopolitics topics formatted as
 * Brain Studio prompts ready to generate.
 */
export async function GET() {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId || !isOwnerClerkId(clerkId)) {
      return NextResponse.json({ suggestions: [] });
    }

    // Fetch trending news from NewsAPI or Gemini
    const newsApiKey = process.env.NEWS_API_KEY;
    const suggestions: Array<{ title: string; prompt: string; source: string }> = [];

    if (newsApiKey) {
      try {
        const res = await fetch(
          `https://newsapi.org/v2/top-headlines?category=general&language=en&pageSize=10&apiKey=${newsApiKey}`,
          { next: { revalidate: 1800 } } // Cache 30 min
        );
        if (res.ok) {
          const data = await res.json();
          const articles = (data.articles || []) as Array<{
            title: string;
            description: string;
            source: { name: string };
          }>;

          // Filter for war/conflict/geopolitics keywords
          const warKeywords = /war|military|missile|bomb|strike|conflict|troops|navy|attack|defense|sanctions|blockade|ceasefire|nuclear|iran|ukraine|israel|china|taiwan|nato|pentagon|invasion|airforce|casualties|weapons/i;

          for (const article of articles) {
            const text = `${article.title} ${article.description || ""}`;
            if (warKeywords.test(text)) {
              suggestions.push({
                title: article.title,
                prompt: buildWarPrompt(article.title, article.description || ""),
                source: article.source?.name || "News",
              });
            }
          }
        }
      } catch {
        // NewsAPI failed — use fallback
      }
    }

    // If no war news from API, search specifically for conflict news
    if (suggestions.length < 3 && newsApiKey) {
      try {
        const res = await fetch(
          `https://newsapi.org/v2/everything?q=war OR military OR missile OR conflict&language=en&sortBy=publishedAt&pageSize=10&apiKey=${newsApiKey}`,
          { next: { revalidate: 1800 } }
        );
        if (res.ok) {
          const data = await res.json();
          for (const article of (data.articles || []) as Array<{ title: string; description: string; source: { name: string } }>) {
            if (suggestions.length >= 5) break;
            if (!suggestions.find((s) => s.title === article.title)) {
              suggestions.push({
                title: article.title,
                prompt: buildWarPrompt(article.title, article.description || ""),
                source: article.source?.name || "News",
              });
            }
          }
        }
      } catch {
        // Fallback below
      }
    }

    // Hardcoded fallback if no API results
    if (suggestions.length === 0) {
      suggestions.push(
        {
          title: "US Naval Blockade of Strait of Hormuz Reaches Critical Point",
          prompt: "BREAKING: US Navy blockade of the Strait of Hormuz — 48 Iranian ships turned back in 20 days. Warships cutting through massive waves at full speed, missiles locked on target, oil tankers stopped dead in the water surrounded by patrol boats, satellite view of naval formation stretching across the strait, fighter jets scrambling from aircraft carrier deck at sunset, explosions on the distant horizon reflecting off the dark water. Raw, intense, war documentary style.",
          source: "Trending",
        },
        {
          title: "Israel-Lebanon Ceasefire Collapses — 73 Killed",
          prompt: "BREAKING: Israel-Lebanon ceasefire collapses as both sides exchange fire. Missiles streaking across the night sky leaving trails of light, buildings crumbling from airstrikes in slow motion, ambulances racing through rubble-filled streets with sirens flashing, soldiers taking cover behind concrete barriers, smoke columns rising from the city visible from miles away, drone footage of devastated neighborhoods. Cinematic war documentary, visceral and unflinching.",
          source: "Trending",
        },
        {
          title: "Pentagon Pulls 5,000 Troops From Germany",
          prompt: "BREAKING: Pentagon withdraws 5,000 troops from Germany in major military shift. Military transport planes loading equipment on rain-soaked tarmac, convoys of armored vehicles rolling through German countryside, soldiers boarding massive C-17 cargo planes, aerial view of emptying military base, NATO flags lowering in ceremony, strategic military maps showing troop redeployments across the globe. Epic scale, geopolitical documentary style.",
          source: "Trending",
        }
      );
    }

    return NextResponse.json({ suggestions: suggestions.slice(0, 5) });
  } catch (error) {
    console.error("[BRAIN TRENDING] Error:", error);
    return NextResponse.json({ suggestions: [] });
  }
}

function buildWarPrompt(title: string, description: string): string {
  const context = description ? `${title}. ${description}` : title;
  return `BREAKING: ${context}. Show intense action — missiles launching, explosions, military hardware in motion, satellite imagery, dramatic drone footage, destruction and aftermath. Cinematic war documentary style with raw intensity. Every scene must have movement and impact. No static shots, no standing people, pure action and drama.`;
}
