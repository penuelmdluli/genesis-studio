import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { getUserByClerkId, updateJobStatus } from "@/lib/db";
import { deductCredits, refundCredits, isOwnerClerkId } from "@/lib/credits";
import { fal } from "@fal-ai/client";

fal.config({ credentials: process.env.FAL_KEY || "" });

// Vercel function timeout — Kling I2V + music + captions can take 3-4 minutes
export const maxDuration = 300;

/**
 * POST /api/talking-avatar/enhance
 *
 * Post-processing pipeline for avatar videos:
 *  1. Product showcase intro (Kling I2V on product image → 5s video)
 *  2. Concatenate product intro + avatar video
 *  3. Mix background music (FAL compose)
 *  4. Burn subtitles (FAL auto-subtitle)
 */

const CAPTION_STYLES: Record<string, Record<string, unknown>> = {
  tiktok: {
    font: "Montserrat/Montserrat-ExtraBold.ttf",
    font_size: 90,
    font_color: "white",
    stroke_color: "black",
    stroke_width: 4,
    highlight_color: "yellow",
    caption_position: "center",
    bounce: true,
    bg_color: null,
  },
  youtube: {
    font: "Roboto/Roboto-Bold.ttf",
    font_size: 60,
    font_color: "white",
    stroke_color: "black",
    stroke_width: 2,
    highlight_color: null,
    caption_position: "bottom",
    bounce: false,
    bg_color: "black",
    bg_opacity: 0.6,
  },
  cinematic: {
    font: "Playfair_Display/PlayfairDisplay-Italic-VariableFont_wght.ttf",
    font_size: 54,
    font_color: "white",
    stroke_color: "black",
    stroke_width: 1,
    highlight_color: null,
    caption_position: "bottom",
    bounce: false,
    bg_color: null,
  },
  bold: {
    font: "Montserrat/Montserrat-ExtraBold.ttf",
    font_size: 80,
    font_color: "white",
    stroke_color: "black",
    stroke_width: 5,
    highlight_color: "#FF6B00",
    caption_position: "center",
    bounce: true,
    bg_color: null,
  },
};

const MUSIC_PROMPTS: Record<string, string> = {
  upbeat: "upbeat positive corporate background music, energetic, modern, inspirational, 120 bpm",
  corporate: "professional corporate background music, clean, modern, confident, 100 bpm",
  dramatic: "dramatic cinematic background music, epic, powerful, building tension, 90 bpm",
  chill: "chill lo-fi hip hop background music, relaxed, warm, mellow, 85 bpm",
  energetic: "high energy electronic background music, dynamic, exciting, fast-paced, 140 bpm",
  emotional: "emotional piano background music, touching, heartfelt, warm, 75 bpm",
  trendy: "trendy social media background music, catchy, modern pop beat, viral sound, 115 bpm",
};

export async function POST(req: NextRequest) {
  try {
    const clerkId = await getAuthUserId();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserByClerkId(clerkId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await req.json();
    const {
      videoUrl,
      jobId,
      musicMood,
      musicUrl: customMusicUrl,
      subtitleStyle,
      language,
      durationMs,
      productImageUrl,
      productName,
      aspectRatio,
    } = body as {
      videoUrl: string;
      jobId?: string;
      musicMood?: string;
      musicUrl?: string;
      subtitleStyle?: string;
      language?: string;
      durationMs?: number;
      productImageUrl?: string;
      productName?: string;
      aspectRatio?: string;
    };

    if (!videoUrl) {
      return NextResponse.json({ error: "videoUrl is required" }, { status: 400 });
    }

    const wantsMusic = !!(musicMood || customMusicUrl);
    const wantsSubtitles = !!subtitleStyle;
    // Product intro: either user uploaded an image, or has a product name (we'll AI-generate the image)
    const wantsProductIntro = !!(productImageUrl || productName);

    if (!wantsMusic && !wantsSubtitles && !wantsProductIntro) {
      return NextResponse.json({ error: "No enhancements requested" }, { status: 400 });
    }

    // Credit cost: 15 for product intro (Kling I2V) + 10 for AI image if needed + 3 for music + 5 for subtitles
    const needsAiImage = wantsProductIntro && !productImageUrl;
    const creditCost =
      (wantsProductIntro ? 15 : 0) +
      (needsAiImage ? 10 : 0) +
      (wantsMusic ? 3 : 0) +
      (wantsSubtitles ? 5 : 0);
    const ownerAccount = isOwnerClerkId(clerkId);

    if (!ownerAccount) {
      const { success, newBalance } = await deductCredits(
        user.id,
        creditCost,
        "",
        `Avatar enhance: ${[wantsProductIntro && "product-intro", wantsMusic && "music", wantsSubtitles && "captions"].filter(Boolean).join("+")}`
      );
      if (!success) {
        return NextResponse.json(
          { error: "Insufficient credits", required: creditCost, balance: newBalance },
          { status: 402 }
        );
      }
    }

    try {
      let currentVideoUrl = videoUrl;
      const targetDurationMs = durationMs || 10000;

      // ── Step 0: Generate product showcase intro ──
      if (wantsProductIntro) {
        console.log(`[AVATAR ENHANCE] Generating product showcase intro for: ${productName || "product"}`);

        // If no product image uploaded, generate one with FLUX Pro
        let finalProductImageUrl = productImageUrl;
        if (!finalProductImageUrl && productName) {
          console.log("[AVATAR ENHANCE] No product image — generating with FLUX Pro");
          try {
            const FAL_API_KEY = process.env.FAL_KEY || "";
            const imgPrompt = `Professional product photography of ${productName}. Clean white/gradient studio background, dramatic lighting, hero shot, commercial quality, centered composition, high-end advertising photography, 8K detail, soft shadows`;

            const sizeMap: Record<string, { width: number; height: number }> = {
              "16:9": { width: 1360, height: 768 },
              "9:16": { width: 768, height: 1360 },
              "1:1": { width: 1024, height: 1024 },
            };
            const imgSize = sizeMap[aspectRatio || ""] || sizeMap["16:9"];

            const imgRes = await fetch("https://fal.run/fal-ai/flux-pro/v1.1", {
              method: "POST",
              headers: { Authorization: `Key ${FAL_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                prompt: imgPrompt,
                image_size: imgSize,
                num_images: 1,
                output_format: "jpeg",
                num_inference_steps: 28,
                guidance_scale: 3.5,
              }),
            });

            if (imgRes.ok) {
              const imgData = await imgRes.json();
              finalProductImageUrl = imgData.images?.[0]?.url;
              if (finalProductImageUrl) {
                console.log(`[AVATAR ENHANCE] AI product image generated: ${finalProductImageUrl.slice(0, 60)}...`);
              }
            }
          } catch (imgErr) {
            console.warn("[AVATAR ENHANCE] FLUX Pro image generation failed:", imgErr);
          }
        }

        if (!finalProductImageUrl) {
          console.warn("[AVATAR ENHANCE] No product image available, skipping product intro");
        } else {
          const productPrompt = productName
            ? `Cinematic product showcase of ${productName}. Slow elegant camera rotation around the product, dramatic studio lighting with soft reflections, premium feel, shallow depth of field, professional commercial quality. The product is the hero — center frame, beautifully lit.`
            : `Cinematic product showcase. Slow elegant camera orbit, dramatic studio lighting, premium commercial feel, professional product photography in motion, shallow depth of field.`;

          // Map aspect ratio
          const arMap: Record<string, string> = { "16:9": "16:9", "9:16": "9:16", "1:1": "1:1" };
          const ar = arMap[aspectRatio || ""] || "16:9";

          try {
            // Generate 5s product video using Kling 2.6 I2V (async submit + poll)
            console.log("[AVATAR ENHANCE] Submitting Kling I2V job for product intro...");
            const submitResult = await fal.queue.submit("fal-ai/kling-video/v2.6/pro/image-to-video", {
              input: {
                prompt: productPrompt,
                image_url: finalProductImageUrl,
                duration: "5",
                aspect_ratio: ar,
              },
            });
            const requestId = submitResult.request_id;
            console.log(`[AVATAR ENHANCE] Kling job submitted: ${requestId}`);

            // Poll for completion (max 4 minutes, check every 10s)
            let productVideoUrl = "";
            for (let i = 0; i < 24; i++) {
              await new Promise(r => setTimeout(r, 10000));
              try {
                const status = await fal.queue.status("fal-ai/kling-video/v2.6/pro/image-to-video", {
                  requestId,
                  logs: false,
                });
                const statusStr = status.status as string;
                console.log(`[AVATAR ENHANCE] Kling poll ${i + 1}/24: status=${statusStr}`);
                if (statusStr === "COMPLETED") {
                  const result = await fal.queue.result("fal-ai/kling-video/v2.6/pro/image-to-video", { requestId });
                  const data = result.data as Record<string, unknown>;
                  productVideoUrl =
                    (data?.video_url as string) ||
                    (data?.video as { url?: string })?.url ||
                    "";
                  break;
                } else if (statusStr === "FAILED" || statusStr === "ERROR") {
                  console.error(`[AVATAR ENHANCE] Kling job ${statusStr}`);
                  break;
                }
              } catch (pollErr) {
                console.warn(`[AVATAR ENHANCE] Poll error (attempt ${i + 1}):`, pollErr);
              }
            }

            if (productVideoUrl) {
              console.log(`[AVATAR ENHANCE] Product intro generated: ${productVideoUrl.slice(0, 80)}...`);

              // Concatenate: product intro + avatar video
              const concatResult = await fal.subscribe("fal-ai/ffmpeg-api/merge-videos", {
                input: {
                  video_urls: [productVideoUrl, currentVideoUrl],
                },
                logs: false,
              });

              const concatData = concatResult.data as Record<string, unknown>;
              const concatUrl =
                (concatData?.video_url as string) ||
                (concatData?.video as { url?: string })?.url ||
                "";

              if (concatUrl) {
                currentVideoUrl = concatUrl;
                console.log(`[AVATAR ENHANCE] Concatenated product intro + avatar: ${concatUrl.slice(0, 80)}...`);
              }
            } else {
              console.warn("[AVATAR ENHANCE] Product intro video not ready after polling, continuing without it");
            }
          } catch (productErr) {
            const errMsg = productErr instanceof Error ? productErr.message : String(productErr);
            console.error("[AVATAR ENHANCE] Product intro FAILED:", errMsg);
          }
        }
      }

      // ── Step 1: Mix background music ──
      if (wantsMusic) {
        let musicSource = customMusicUrl;

        if (!musicSource && musicMood) {
          const musicPrompt = MUSIC_PROMPTS[musicMood] || MUSIC_PROMPTS.corporate;
          console.log(`[AVATAR ENHANCE] Generating AI music: ${musicMood}`);

          const musicResult = await fal.subscribe("fal-ai/stable-audio", {
            input: {
              prompt: musicPrompt,
              seconds_total: Math.min(Math.ceil(targetDurationMs / 1000) + 5, 47),
            },
            logs: false,
          });

          const musicData = musicResult.data as Record<string, unknown>;
          musicSource =
            (musicData?.audio_file as { url?: string })?.url ||
            (musicData?.audio_url as string) ||
            "";

          if (musicSource) {
            console.log(`[AVATAR ENHANCE] AI music generated: ${musicSource.slice(0, 60)}...`);
          }
        }

        if (musicSource) {
          // Loudnorm music to -28 LUFS
          let normalizedMusic = musicSource;
          try {
            const normResult = await fal.subscribe("fal-ai/ffmpeg-api/loudnorm", {
              input: { audio_url: musicSource, integrated_loudness: -28 },
              logs: false,
            });
            const normData = normResult.data as Record<string, unknown>;
            normalizedMusic =
              (normData?.audio_url as string) ||
              (normData?.audio as { url?: string })?.url ||
              musicSource;
            console.log("[AVATAR ENHANCE] Music normalized to -28 LUFS");
          } catch (normErr) {
            console.warn("[AVATAR ENHANCE] Loudnorm failed, using raw music:", normErr);
          }

          // Get actual video duration for compose
          let composeDurationMs = targetDurationMs;
          if (wantsProductIntro) {
            composeDurationMs += 5000; // product intro is 5s
          }

          const composeResult = await fal.subscribe("fal-ai/ffmpeg-api/compose", {
            input: {
              tracks: [
                {
                  id: "video-main",
                  type: "video",
                  keyframes: [{ timestamp: 0, duration: composeDurationMs, url: currentVideoUrl }],
                },
                {
                  id: "music-bg",
                  type: "audio",
                  keyframes: [{ timestamp: 0, duration: composeDurationMs, url: normalizedMusic }],
                },
              ],
            },
            logs: false,
          });

          const composeData = composeResult.data as Record<string, unknown>;
          const composedUrl =
            (composeData?.video_url as string) ||
            (composeData?.video as { url?: string })?.url ||
            "";

          if (composedUrl) {
            currentVideoUrl = composedUrl;
            console.log(`[AVATAR ENHANCE] Music mixed in: ${composedUrl.slice(0, 60)}...`);
          }
        }
      }

      // ── Step 2: Burn subtitles ──
      if (wantsSubtitles) {
        const preset = CAPTION_STYLES[subtitleStyle || "tiktok"] || CAPTION_STYLES.tiktok;

        const subtitleInput: Record<string, unknown> = {
          video_url: currentVideoUrl,
          font: preset.font,
          font_size: preset.font_size,
          font_color: preset.font_color,
          stroke_color: preset.stroke_color,
          stroke_width: preset.stroke_width,
          caption_position: preset.caption_position,
        };

        if (preset.highlight_color) subtitleInput.highlight_color = preset.highlight_color;
        if (preset.bounce) subtitleInput.bounce = true;
        if (preset.bg_color) {
          subtitleInput.bg_color = preset.bg_color;
          if (preset.bg_opacity) subtitleInput.bg_opacity = preset.bg_opacity;
        }
        if (language && language !== "auto" && language !== "en") subtitleInput.language = language;

        console.log(`[AVATAR ENHANCE] Burning subtitles: style=${subtitleStyle}`);

        const subtitleResult = await fal.subscribe(
          "fal-ai/workflow-utilities/auto-subtitle",
          {
            input: subtitleInput as Record<string, unknown> & { video_url: string },
            logs: false,
          }
        );

        const subData = subtitleResult.data as Record<string, unknown>;
        const subtitledUrl =
          (subData?.video_url as string) ||
          (subData?.video as { url?: string })?.url ||
          "";

        if (subtitledUrl) {
          currentVideoUrl = subtitledUrl;
          console.log(`[AVATAR ENHANCE] Subtitles burned: ${subtitledUrl.slice(0, 60)}...`);
        }
      }

      // ── Step 3: Persist to R2 ──
      const { persistExternalVideo, videoStorageKey } = await import("@/lib/storage");
      const storageKey = videoStorageKey(user.id, `avatar-enhanced-${Date.now()}`);
      const persistedUrl = await persistExternalVideo(currentVideoUrl, storageKey);

      if (jobId) {
        const { r2PublicUrl } = await import("@/lib/storage");
        await updateJobStatus(jobId, {
          status: "completed",
          outputVideoUrl: persistedUrl || r2PublicUrl(storageKey),
        });
      }

      const { r2PublicUrl } = await import("@/lib/storage");

      return NextResponse.json({
        videoUrl: persistedUrl || r2PublicUrl(storageKey),
        creditsCost: creditCost,
        enhancements: {
          productIntro: wantsProductIntro,
          music: wantsMusic,
          subtitles: wantsSubtitles,
        },
      });
    } catch (enhanceError) {
      console.error("[AVATAR ENHANCE] Error:", enhanceError);

      if (!ownerAccount) {
        await refundCredits(user.id, creditCost, "", "Avatar enhance failed — automatic refund");
      }

      return NextResponse.json(
        { error: "Enhancement failed. Credits refunded." },
        { status: 503 }
      );
    }
  } catch (error) {
    console.error("[AVATAR ENHANCE] API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
