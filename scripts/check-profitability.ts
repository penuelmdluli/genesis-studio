import { isProfitable } from "../src/lib/profitability";

const tests = [
  { name: "CogVideoX 480p", cr: 10, m: "cogvideo-x", d: 5, r: "480p", b: false },
  { name: "LTX 720p", cr: 15, m: "ltx-video", d: 5, r: "720p", b: false },
  { name: "Wan2.1T 720p", cr: 20, m: "wan-2.1-turbo", d: 5, r: "720p", b: false },
  { name: "Hunyuan 720p", cr: 25, m: "hunyuan-video", d: 5, r: "720p", b: false },
  { name: "MimicMotion", cr: 30, m: "mimic-motion", d: 5, r: "720p", b: false },
  { name: "Mochi 720p", cr: 35, m: "mochi-1", d: 5, r: "720p", b: false },
  { name: "Seedance 720p", cr: 35, m: "seedance-1.5", d: 5, r: "720p", b: false },
  { name: "Wan2.2 720p", cr: 40, m: "wan-2.2", d: 5, r: "720p", b: false },
  { name: "Kling2.6 720p", cr: 50, m: "kling-2.6", d: 5, r: "720p", b: false },
  { name: "Kling3.0 720p", cr: 70, m: "kling-3.0", d: 10, r: "720p", b: false },
  { name: "Veo3.1 720p", cr: 100, m: "veo-3.1", d: 8, r: "720p", b: false },
  { name: "Kling3 BRAIN", cr: 70, m: "kling-3.0", d: 10, r: "720p", b: true },
];

console.log("");
console.log("GENESIS STUDIO — Full Profitability Analysis (ALL costs included)");
console.log("VAT 15% + PayStack 3.5% + Infrastructure $155/mo amortized");
console.log("=".repeat(85));
console.log(
  "Model".padEnd(18) +
  "Credits".padEnd(9) +
  "NetRev$".padEnd(10) +
  "FullCost$".padEnd(11) +
  "Margin".padEnd(9) +
  "Status"
);
console.log("-".repeat(85));

for (const t of tests) {
  const p = isProfitable(t.cr, t.m, t.d, t.r, t.b);
  console.log(
    t.name.padEnd(18) +
    String(t.cr).padEnd(9) +
    ("$" + p.netRevenue.toFixed(3)).padEnd(10) +
    ("$" + p.fullCost.toFixed(3)).padEnd(11) +
    (p.margin + "%").padEnd(9) +
    (p.profitable ? "✅ OK" : "⚠️  RAISE PRICE")
  );
}
console.log("");
