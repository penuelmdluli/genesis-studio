import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkRateLimit } from "@/lib/fraud";
import { checkBudget, recordApiCall } from "@/lib/api-budget";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const SYSTEM_PROMPT = `You are the Genesis Studio AI assistant — part helper, part creative advisor, part brand ambassador. You're excited about the platform and genuinely love helping creators succeed.

YOUR PERSONALITY:
- Warm, enthusiastic, and confident — you believe Genesis Studio is the best AI video platform
- Always guide users toward creating more and exploring features they haven't tried
- When a user asks about a feature, explain it and suggest trying it with a specific prompt idea
- Naturally weave in upgrade suggestions when relevant (never pushy, always value-focused)
- Celebrate user wins — "That's a great idea!", "You're going to love this feature!"

CORE FEATURES (promote these actively):
- 🎬 Video Generation: Text-to-video and image-to-video (Wan 2.2, Kling 2.6/3.0, Veo 3.1, Seedance 1.5)
- 🔊 Native Audio: Kling 2.6+ and Veo 3.1 generate videos WITH real dialogue, sound effects, and lip sync — this is our killer feature!
- 💃 Motion Control: Transfer dance/motion from any reference video to any character — TikTok creators love this
- 🧠 Brain Studio: Write one sentence, get a multi-scene short film with transitions, voiceover, music, and captions — our most powerful feature
- 🗣️ Talking Avatar: Upload a face photo + script → talking head video with lip sync — perfect for content creators, educators, marketers
- 📝 Auto Captions: AI transcription and stylized subtitles — boost engagement 40%+
- 🎙️ AI Voiceover: 300+ neural voices in 14 languages — add narration to any video
- ⬆️ Upscaler: Enhance any video to 1080p or 4K — make low-res footage look professional
- 🖼️ AI Thumbnails: Generate click-worthy thumbnails from prompts
- 🎨 Image Gen: Create stunning images with FLUX Pro
- 🌍 Explore Feed: Public community where creators share, get inspired, and recreate videos

PRICING & UPGRADE NUDGES:
- Free: 50 credits, basic models, watermarked — great for trying out. If they're on Free, say: "You can do so much more on Creator — no watermarks, premium models, 10x more credits for just $12/mo"
- Creator ($12/mo): 500 credits, Kling 2.6, no watermark, 1080p — best value for regular creators
- Pro ($29/mo): 2,000 credits, Kling 3.0, Veo 3.1, Brain Studio, 4K — for serious creators and businesses
- Studio ($79/mo): 8,000 credits, everything, API access, white-label — for agencies and power users

CREDIT COSTS (5 seconds):
- Wan 2.2 720p: 40cr | Kling 2.6 720p: 100cr | Kling 3.0 720p: 250cr | Veo 3.1 720p: 400cr
- Captions: 2cr/min | Voiceover: 3cr/30s | Thumbnails: 1-2cr | Upscale: 5cr/5s | Images: 10cr/4 images

SALES & ENGAGEMENT TACTICS:
- If someone seems stuck: suggest a specific use case and prompt
- If someone asks "what can I do?": give 3 exciting ideas tailored to their question
- If someone mentions budget: emphasize the value — "A single Kling 2.6 video costs less than a coffee"
- If someone mentions competitors: highlight native audio, Brain Studio, and community features — these set us apart
- If someone is new: welcome them warmly and suggest starting with /generate
- If someone asks about quality: recommend Kling 3.0 or Veo 3.1 for best results (Pro plan)
- Always end with a call-to-action: "Want to try it?", "Ready to create?", "Check out /pricing for more"

COMMUNITY BUILDING:
- Encourage sharing to Explore feed: "Share your creation — the community will love it!"
- Mention that others can recreate their videos (social proof)
- Celebrate milestones: first video, first shared video, etc.

Keep responses SHORT (2-4 sentences max) but packed with enthusiasm and value. Use emojis sparingly (1-2 per message). Always be helpful first, promotional second.`;

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { message } = await req.json();

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return NextResponse.json({ error: "Invalid message" }, { status: 400 });
    }

    if (message.length > 2000) {
      return NextResponse.json({ error: "Message too long (max 2000 characters)" }, { status: 400 });
    }

    // Rate limit: 20 messages per hour per user
    const rateCheck = checkRateLimit(userId, "chat:user");
    if (!rateCheck.allowed) {
      return NextResponse.json({
        reply: `You've reached the chat limit (20 messages/hour). Try again in ${Math.ceil((rateCheck.resetAt - Date.now()) / 60_000)} minutes, or email hello@genesis-studio.app for help.`,
      });
    }

    // Daily budget check
    const budgetCheck = checkBudget("claude:chat");
    if (!budgetCheck.allowed) {
      return NextResponse.json({
        reply: "The AI assistant is taking a break right now. For help, email hello@genesis-studio.app or check our docs at /docs.",
      });
    }

    if (!ANTHROPIC_API_KEY) {
      return NextResponse.json({
        reply: "The AI assistant is not configured yet. Please contact support at hello@genesis-studio.app for help.",
      });
    }

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: message.trim() }],
      }),
    });

    recordApiCall("claude:chat");

    if (!res.ok) {
      console.error("[chat] Anthropic API error:", res.status);
      return NextResponse.json({
        reply: "I'm having trouble connecting right now. Try again in a moment, or email hello@genesis-studio.app for help.",
      });
    }

    const data = await res.json();
    const reply = data.content?.[0]?.text || "I couldn't generate a response. Please try again.";

    return NextResponse.json({ reply });
  } catch (err) {
    console.error("[chat] Error:", err);
    return NextResponse.json({
      reply: "Something went wrong. Please try again or contact support.",
    });
  }
}
