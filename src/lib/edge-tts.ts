// ============================================
// GENESIS STUDIO — speech, without Node
// ============================================
// The `msedge-tts` package cannot run here. It reaches the speech service
// through a Node WebSocket client built on `https.request`, which the Worker
// runtime does not implement — so every attempt died with
// "[unenv] https.request is not implemented yet!" before a single byte of
// audio existed. That is why every spoken line in the first real episode
// failed while the silent shots came through fine.
//
// This is the same protocol spoken directly, using the two things the
// runtime does give us: outbound WebSockets via `fetch` with an Upgrade
// header, and Web Crypto for the access token. No Node built-ins, no
// dependency.
//
// Used by Series Studio and by AI Avatar, which had the same broken path
// whenever somebody typed a script instead of uploading audio.

const TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const WSS_HOST = "speech.platform.bing.com";
const WSS_PATH = "/consumer/speech/synthesize/readaloud/edge/v1";
const GEC_VERSION = "1-143.0.3650.96";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0";
const ORIGIN = "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold";

export const DEFAULT_OUTPUT_FORMAT = "audio-24khz-96kbitrate-mono-mp3";

/**
 * The service requires a token derived from the current five-minute window.
 * Rounding to 300 seconds is what makes the same value reproducible on their
 * side; anything else is rejected at the handshake.
 */
async function secMsGec(): Promise<string> {
  const ticks = Math.floor(Date.now() / 1000) + 11644473600;
  const rounded = ticks - (ticks % 300);
  const windowsTicks = rounded * 10000000;
  const data = new TextEncoder().encode(`${windowsTicks}${TRUSTED_CLIENT_TOKEN}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

/** SSML is XML: an unescaped apostrophe in dialogue would break the request. */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function uuid(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

/** Locale is required in the SSML envelope and must match the voice. */
function localeOf(voice: string): string {
  const match = /^([a-z]{2,3}-[A-Za-z]{2,4})/.exec(voice);
  return match ? match[1] : "en-US";
}

export interface SpeechOptions {
  /** Percent change, e.g. "-10%" for a slower, heavier delivery. */
  rate?: string;
  pitch?: string;
  volume?: string;
  outputFormat?: string;
  /** Guards against a service that accepts the socket and then says nothing. */
  timeoutMs?: number;
}

/**
 * Speaks `text` in `voice` and returns MP3 bytes.
 *
 * Throws rather than returning empty audio: a silent line that looks like a
 * success would reach a customer as a video of someone moving their mouth
 * saying nothing.
 */
export async function synthesiseSpeech(
  text: string,
  voice: string,
  options: SpeechOptions = {}
): Promise<Uint8Array> {
  const clean = (text || "").trim();
  if (!clean) throw new Error("There is nothing to say");

  const outputFormat = options.outputFormat || DEFAULT_OUTPUT_FORMAT;
  const timeoutMs = options.timeoutMs ?? 30000;

  const url =
    `https://${WSS_HOST}${WSS_PATH}?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}` +
    `&Sec-MS-GEC=${await secMsGec()}&Sec-MS-GEC-Version=${GEC_VERSION}&ConnectionId=${uuid()}`;

  const response = await fetch(url, {
    headers: { Upgrade: "websocket", "User-Agent": UA, Origin: ORIGIN },
  });

  // `webSocket` is the runtime's own extension to Response and is absent
  // from the DOM typings, so it is reached through a narrow cast rather than
  // by loosening the whole response.
  const ws = (response as unknown as { webSocket?: WebSocket & { accept(): void } }).webSocket;
  if (!ws) {
    throw new Error(`The speech service refused the connection (${response.status})`);
  }
  ws.accept();

  return await new Promise<Uint8Array>((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    let settled = false;

    const finish = (err: Error | null, audio?: Uint8Array) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        ws.close();
      } catch {
        // Already closing; the audio is what matters.
      }
      if (err) reject(err);
      else resolve(audio!);
    };

    const timer = setTimeout(
      () => finish(new Error("The speech service did not respond in time")),
      timeoutMs
    );

    ws.addEventListener("message", (event: MessageEvent) => {
      // Text frames carry protocol events; binary frames carry the audio.
      if (typeof event.data === "string") {
        if (event.data.includes("Path:turn.end")) {
          if (chunks.length === 0) {
            finish(new Error("The speech service returned no audio for this line"));
            return;
          }
          const total = chunks.reduce((n, c) => n + c.length, 0);
          const audio = new Uint8Array(total);
          let offset = 0;
          for (const c of chunks) {
            audio.set(c, offset);
            offset += c.length;
          }
          finish(null, audio);
        }
        return;
      }

      // Binary frame: two big-endian bytes of header length, the header, then
      // the audio payload.
      const bytes = new Uint8Array(event.data as ArrayBuffer);
      if (bytes.length < 2) return;
      const headerLength = (bytes[0] << 8) | bytes[1];
      const body = bytes.subarray(2 + headerLength);
      if (body.length > 0) chunks.push(body);
    });

    ws.addEventListener("error", () => finish(new Error("The speech connection failed")));

    ws.addEventListener("close", () => {
      // A close before turn.end means the audio is incomplete — better to
      // fail and refund than to ship half a sentence.
      finish(new Error("The speech connection closed before the line finished"));
    });

    try {
      ws.send(
        `Content-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n` +
          JSON.stringify({
            context: {
              synthesis: {
                audio: {
                  metadataoptions: { sentenceBoundaryEnabled: "false", wordBoundaryEnabled: "false" },
                  outputFormat,
                },
              },
            },
          })
      );

      const ssml =
        `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${localeOf(voice)}'>` +
        `<voice name='${voice}'>` +
        `<prosody pitch='${options.pitch || "+0Hz"}' rate='${options.rate || "+0%"}' volume='${options.volume || "+0%"}'>` +
        `${escapeXml(clean)}</prosody></voice></speak>`;

      ws.send(
        `X-RequestId:${uuid()}\r\nContent-Type:application/ssml+xml\r\n` +
          `X-Timestamp:${new Date().toISOString()}Z\r\nPath:ssml\r\n\r\n${ssml}`
      );
    } catch (err) {
      finish(err instanceof Error ? err : new Error(String(err)));
    }
  });
}
