/**
 * Genesis Studio — WhatsApp notifications via WATI.
 * Sends template messages for video completions and low credits.
 */

const WATI_API_URL = process.env.WATI_API_URL; // e.g., https://live-mt-server.wati.io/305XXX/api/v1
const WATI_API_KEY = process.env.WATI_API_KEY;

interface WatiMessageParams {
  phone: string; // International format without +, e.g., "27821234567"
  templateName: string;
  parameters: { name: string; value: string }[];
}

async function sendWatiTemplate({ phone, templateName, parameters }: WatiMessageParams): Promise<boolean> {
  if (!WATI_API_URL || !WATI_API_KEY) {
    console.debug("[WHATSAPP] WATI not configured, skipping");
    return false;
  }

  try {
    const res = await fetch(`${WATI_API_URL}/sendTemplateMessage?whatsappNumber=${phone}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WATI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        template_name: templateName,
        broadcast_name: "genesis_notification",
        parameters,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[WHATSAPP] WATI error (${res.status}):`, text);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[WHATSAPP] Send failed:", err);
    return false;
  }
}

/**
 * "Your video is ready!" notification.
 */
export function sendVideoReadyWhatsApp(phone: string, userName: string, videoId: string) {
  return sendWatiTemplate({
    phone,
    templateName: "video_ready",
    parameters: [
      { name: "1", value: userName },
      { name: "2", value: `${process.env.NEXT_PUBLIC_APP_URL || "https://genesis-studio-hazel.vercel.app"}/gallery?v=${videoId}` },
    ],
  });
}

/**
 * "You're running low on credits" notification.
 */
export function sendLowCreditsWhatsApp(phone: string, userName: string, balance: number) {
  return sendWatiTemplate({
    phone,
    templateName: "low_credits",
    parameters: [
      { name: "1", value: userName },
      { name: "2", value: String(balance) },
      { name: "3", value: `${process.env.NEXT_PUBLIC_APP_URL || "https://genesis-studio-hazel.vercel.app"}/pricing` },
    ],
  });
}

/**
 * Welcome message for new users.
 */
export function sendWelcomeWhatsApp(phone: string, userName: string) {
  return sendWatiTemplate({
    phone,
    templateName: "welcome",
    parameters: [
      { name: "1", value: userName },
    ],
  });
}
