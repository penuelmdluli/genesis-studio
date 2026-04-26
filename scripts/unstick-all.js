const fs = require('fs');
try {
  const envContent = fs.readFileSync('.env.local', 'utf-8');
  for (const line of envContent.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    if (!process.env[t.slice(0, eq).trim()]) process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
} catch {}

const { createClient } = require('@supabase/supabase-js');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const R2 = new S3Client({
  region: 'auto',
  endpoint: 'https://' + process.env.R2_ACCOUNT_ID + '.r2.cloudflarestorage.com',
  credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY },
  forcePathStyle: true,
});
const BUCKET = process.env.R2_BUCKET_NAME || 'genesis-videos';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const WAN22_ENDPOINT = 'dm5mng5h7034q7';
const apiKey = process.env.RUNPOD_API_KEY;
const SUPA_SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY.slice(-10);

async function unstickProduction(prodId) {
  const { data: scenes } = await supabase
    .from('production_scenes')
    .select('id, scene_number, status, runpod_job_id, output_video_url')
    .eq('production_id', prodId)
    .order('scene_number');

  let updated = 0;
  let failed = 0;

  for (const s of scenes) {
    if (s.status !== 'processing' || !s.runpod_job_id) continue;
    try {
      const r = await fetch(`https://api.runpod.ai/v2/${WAN22_ENDPOINT}/status/${s.runpod_job_id}`, {
        headers: { Authorization: 'Bearer ' + apiKey },
      });
      const d = await r.json();

      if (d.status === 'COMPLETED' && d.output?.video) {
        const buf = Buffer.from(d.output.video, 'base64');
        const key = `brain-scenes/${prodId.substring(0, 8)}/${s.scene_number}.mp4`;
        await R2.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: buf, ContentType: 'video/mp4' }));
        const url = await getSignedUrl(R2, new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn: 86400 });
        await supabase.from('production_scenes').update({
          status: 'completed',
          output_video_url: url,
          progress: 100,
          gpu_time: d.executionTime || 0,
        }).eq('id', s.id);
        updated++;
      } else if (d.status === 'FAILED') {
        await supabase.from('production_scenes').update({
          status: 'failed',
          error_message: d.error || 'RunPod failed',
        }).eq('id', s.id);
        failed++;
      }
    } catch (e) {
      console.log(`    Scene ${s.scene_number}: fetch error - ${e.message}`);
    }
  }

  if (updated === 0 && failed === 0) return { skipped: true };

  // Check final status
  const { data: finalScenes } = await supabase
    .from('production_scenes')
    .select('status')
    .eq('production_id', prodId);
  const allDone = finalScenes.every((s) => s.status === 'completed' || s.status === 'failed');
  const anyCompleted = finalScenes.some((s) => s.status === 'completed');

  if (allDone && anyCompleted) {
    // Reset to generating so test-run triggers assembly
    await supabase.from('productions').update({ status: 'generating', progress: 60, error_message: null }).eq('id', prodId);
    // Trigger assembly
    try {
      await fetch(`https://genesis-studio-hazel.vercel.app/api/brain/test-run?id=${prodId}&secret=${SUPA_SECRET}`, {
        headers: { 'x-test-secret': SUPA_SECRET },
      });
    } catch {}
  }

  return { updated, failed, triggered: allDone && anyCompleted };
}

async function run() {
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const { data: prods } = await supabase
    .from('productions')
    .select('id, concept, status, progress')
    .gte('created_at', twoHoursAgo)
    .in('status', ['generating'])
    .order('created_at', { ascending: true });

  console.log(`Found ${prods.length} stuck productions to unstick\n`);

  const results = [];
  for (const p of prods) {
    const title = (p.concept || '').substring(0, 50);
    process.stdout.write(`  ${p.id.substring(0, 8)} | ${title.padEnd(50)} `);
    const r = await unstickProduction(p.id);
    if (r.skipped) {
      console.log('· (no changes)');
    } else {
      console.log(`→ ${r.updated} uploaded, ${r.failed} failed${r.triggered ? ', ASSEMBLY TRIGGERED' : ''}`);
      results.push({ id: p.id, ...r });
    }
  }

  console.log('\nTotal productions unstuck:', results.length);
  console.log('Productions with assembly triggered:', results.filter((r) => r.triggered).length);
}

run().catch((e) => console.error('FATAL:', e.message));
