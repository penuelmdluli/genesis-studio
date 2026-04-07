// ============================================
// GENESIS STUDIO — Dynamic OG Image Generator
// Edge-runtime social preview cards for shared videos
// GET /api/og?id=xxx -> 1200x630 branded OG image
// ============================================

import { ImageResponse } from "next/og";

export const runtime = "edge";

interface VideoRow {
  id: string;
  prompt: string;
  thumbnail_url: string | null;
  video_url: string | null;
  has_audio: boolean;
  model_id: string | null;
  creator_name: string | null;
  created_at: string;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const videoId = searchParams.get("id");

  if (!videoId) {
    return new ImageResponse(
      (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            height: "100%",
            background: "linear-gradient(135deg, #0A0A0F 0%, #1a1a2e 100%)",
            color: "white",
            fontSize: 48,
            fontFamily: "sans-serif",
          }}
        >
          Genesis Studio
        </div>
      ),
      { width: 1200, height: 630 }
    );
  }

  // Fetch video data from Supabase (edge-compatible fetch)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  let video: VideoRow | null = null;

  if (supabaseUrl && supabaseKey) {
    try {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/explore_videos?id=eq.${encodeURIComponent(videoId)}&select=*&limit=1`,
        {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
          },
        }
      );

      if (res.ok) {
        const rows: VideoRow[] = await res.json();
        video = rows[0] ?? null;
      }
    } catch (err) {
      console.error("[OG] Supabase fetch failed:", err);
    }
  }

  // Fallback when video not found
  const promptText = video?.prompt ?? "AI-generated video";
  const displayPrompt =
    promptText.length > 100 ? promptText.slice(0, 97) + "..." : promptText;
  const hasAudio = video?.has_audio ?? false;
  const thumbnailUrl = video?.thumbnail_url ?? null;
  const modelId = video?.model_id ?? null;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #0A0A0F 0%, #1a1a2e 50%, #0A0A0F 100%)",
          fontFamily: "sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Blurred thumbnail background */}
        {thumbnailUrl && (
          <img
            src={thumbnailUrl}
            alt=""
            width={1200}
            height={630}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              filter: "blur(40px) brightness(0.3)",
            }}
          />
        )}

        {/* Dark overlay for readability */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "rgba(10, 10, 15, 0.55)",
          }}
        />

        {/* Top bar: logo + audio badge */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "32px 40px 0 40px",
            position: "relative",
            zIndex: 2,
          }}
        >
          {/* Logo / sparkle */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              style={{ flexShrink: 0 }}
            >
              <path
                d="M12 2L14.09 8.26L20 9.27L15.55 13.97L16.91 20L12 16.9L7.09 20L8.45 13.97L4 9.27L9.91 8.26L12 2Z"
                fill="#a78bfa"
              />
            </svg>
            <span style={{ color: "#a78bfa", fontSize: 22, fontWeight: 700 }}>
              Genesis Studio
            </span>
          </div>

          {/* WITH AUDIO badge */}
          {hasAudio && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                background: "rgba(167, 139, 250, 0.2)",
                border: "1px solid rgba(167, 139, 250, 0.4)",
                borderRadius: "20px",
                padding: "6px 16px",
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                style={{ flexShrink: 0 }}
              >
                <path
                  d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"
                  fill="#a78bfa"
                />
              </svg>
              <span style={{ color: "#a78bfa", fontSize: 14, fontWeight: 600 }}>
                WITH AUDIO
              </span>
            </div>
          )}
        </div>

        {/* Center: thumbnail */}
        <div
          style={{
            display: "flex",
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            zIndex: 2,
            padding: "16px 40px",
          }}
        >
          {thumbnailUrl ? (
            <div
              style={{
                display: "flex",
                borderRadius: "16px",
                overflow: "hidden",
                border: "2px solid rgba(167, 139, 250, 0.3)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                maxWidth: "560px",
                maxHeight: "315px",
              }}
            >
              <img
                src={thumbnailUrl}
                alt=""
                width={560}
                height={315}
                style={{
                  objectFit: "cover",
                  width: "560px",
                  height: "315px",
                }}
              />
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "560px",
                height: "315px",
                borderRadius: "16px",
                border: "2px solid rgba(167, 139, 250, 0.2)",
                background: "rgba(167, 139, 250, 0.05)",
              }}
            >
              <svg
                width="64"
                height="64"
                viewBox="0 0 24 24"
                fill="none"
              >
                <path d="M8 5v14l11-7z" fill="rgba(167,139,250,0.4)" />
              </svg>
            </div>
          )}
        </div>

        {/* Bottom: prompt text + branding */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "0 60px 32px 60px",
            position: "relative",
            zIndex: 2,
            gap: "12px",
          }}
        >
          {/* Prompt text */}
          <div
            style={{
              display: "flex",
              color: "rgba(255,255,255,0.9)",
              fontSize: 20,
              textAlign: "center",
              lineHeight: 1.4,
              maxWidth: "900px",
            }}
          >
            {displayPrompt}
          </div>

          {/* Bottom branding line */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span style={{ color: "#a78bfa", fontSize: 15, fontWeight: 600 }}>
              Genesis Studio
            </span>
            <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 15 }}>
              —
            </span>
            <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 15 }}>
              AI Video Generator
            </span>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
