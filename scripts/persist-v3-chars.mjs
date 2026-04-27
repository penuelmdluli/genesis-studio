import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";

const R2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
});
const BUCKET = process.env.R2_BUCKET_NAME || "genesis-videos";
const R2_PUB = "https://pub-891668ae91a142968457a5383e993020.r2.dev";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CHARS = [
  { name: "amahle", fal: "https://v3b.fal.media/files/b/0a97e802/LE823fuB3R1S5yPGF2aPN_image.webp" },
  { name: "bandile", fal: "https://v3b.fal.media/files/b/0a97e803/NTdXoawqmhlxCOEBz0p6S_image.webp" },
  { name: "kgosi", fal: "https://v3b.fal.media/files/b/0a97e804/w78-eSbQ-d1W2Lm6_BUTe_image.webp" },
  { name: "lwazi", fal: "https://v3b.fal.media/files/b/0a97e805/K7JFETkkz0OR5lmuZczKd_image.webp" },
  { name: "naledi", fal: "https://v3b.fal.media/files/b/0a97e807/5AilTJCbt0boxfZgMHXXu_image.webp" },
  { name: "nandi", fal: "https://v3b.fal.media/files/b/0a97e80b/ikXS43zXh9Kp3-27oi64Q_image.webp" },
  { name: "sipho", fal: "https://v3b.fal.media/files/b/0a97e80c/U_XjyrqFs8GGb5BdBjDf5_image.webp" },
  { name: "thando", fal: "https://v3b.fal.media/files/b/0a97e80d/65eZqLE7Fx4SJuC1JOTBO_image.webp" },
  { name: "zahra", fal: "https://v3b.fal.media/files/b/0a97e80e/pDum3sIcuBjLzXzHKMG_F_image.webp" },
  { name: "zintle", fal: "https://v3b.fal.media/files/b/0a97e810/cnDQoE9jY1HeNN0zAKnd__image.webp" },
  { name: "buhle", fal: "https://v3b.fal.media/files/b/0a97e813/3pSGx2HBwj3GUKHsKB39y_image.webp" },
  { name: "msizi", fal: "https://v3b.fal.media/files/b/0a97e815/Lua8vIxurftkCPhYMsFvA_image.webp" },
  { name: "lethabo", fal: "https://v3b.fal.media/files/b/0a97e816/IY0cT0SIWWyI5YGYFmfrc_image.webp" },
  { name: "ayanda", fal: "https://v3b.fal.media/files/b/0a97e817/fdmoeMoZlS6oJQtWUByVt_image.webp" },
  { name: "thabiso", fal: "https://v3b.fal.media/files/b/0a97e818/JdVY4w4FD7j5-yOXOgaTc_image.webp" },
  { name: "dineo", fal: "https://v3b.fal.media/files/b/0a97e819/NYDHJkrPNEIZuK_H_HV_L_image.webp" },
  { name: "kagiso", fal: "https://v3b.fal.media/files/b/0a97e81a/_KHwlEfqoHVNuYEbP_jL5_image.webp" },
  { name: "lerato", fal: "https://v3b.fal.media/files/b/0a97e81c/YfMj703JURs-7KNwL_1jk_image.webp" },
  { name: "vuyo", fal: "https://v3b.fal.media/files/b/0a97e81d/li7GvZU6ARpHNS5sd9V8d_image.webp" },
  { name: "zinhle", fal: "https://v3b.fal.media/files/b/0a97e81e/A6fhZUqPI_nd-y6baSFzK_image.webp" },
];

async function run() {
  for (const char of CHARS) {
    const key = `mbs-characters/v3/${char.name}.webp`;
    const r2Url = `${R2_PUB}/${key}`;
    process.stdout.write(`  ${char.name}... `);

    try {
      // Download from FAL
      const res = await fetch(char.fal);
      if (!res.ok) { console.log(`SKIP (FAL ${res.status})`); continue; }
      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.length < 5000) { console.log(`SKIP (${buffer.length}b)`); continue; }

      // Upload to R2
      await R2.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: buffer,
        ContentType: "image/webp",
      }));

      // Update DB — match by name (case insensitive)
      const capName = char.name.charAt(0).toUpperCase() + char.name.slice(1);
      await supabase.from("mbs_characters").update({ portrait_url: r2Url }).eq("name", capName);

      console.log(`OK (${(buffer.length / 1024).toFixed(0)}KB) → ${r2Url}`);
    } catch (err) {
      console.log(`FAILED: ${err.message}`);
    }
  }
  console.log("\nDone!");
}

run();
