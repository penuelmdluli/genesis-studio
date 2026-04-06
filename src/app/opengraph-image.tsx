import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Genesis Studio — AI Video Generation Platform";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0A0A0F 0%, #1a1025 50%, #0A0A0F 100%)",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Logo */}
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: 20,
            background: "linear-gradient(135deg, #7c3aed, #06b6d4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 40,
            fontWeight: 800,
            color: "white",
            marginBottom: 32,
            boxShadow: "0 20px 40px rgba(124, 58, 237, 0.3)",
          }}
        >
          G
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: 56,
            fontWeight: 800,
            color: "white",
            marginBottom: 16,
            letterSpacing: "-0.02em",
          }}
        >
          Genesis Studio
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 24,
            color: "#a1a1aa",
            marginBottom: 40,
            textAlign: "center",
            maxWidth: 700,
          }}
        >
          AI Video Generation Platform — 10+ Models, Native Audio, Motion Control
        </div>

        {/* Feature pills */}
        <div style={{ display: "flex", gap: 12 }}>
          {["Text-to-Video", "Native Audio", "Motion Control", "Brain Studio"].map(
            (feature) => (
              <div
                key={feature}
                style={{
                  padding: "8px 20px",
                  borderRadius: 999,
                  background: "rgba(124, 58, 237, 0.2)",
                  border: "1px solid rgba(124, 58, 237, 0.3)",
                  color: "#c4b5fd",
                  fontSize: 16,
                  fontWeight: 600,
                }}
              >
                {feature}
              </div>
            )
          )}
        </div>
      </div>
    ),
    { ...size }
  );
}
