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

async function run() {
  console.log('\n============================================');
  console.log('  FULL E2E PRODUCTION TEST');
  console.log('============================================\n');

  const topic = 'South Africa celebrates! Bafana Bafana qualifies for the World Cup after historic win in Johannesburg. Mzansi is alive with celebration from Cape Town to Durban to Soweto.';

  console.log('[1/6] Creating queue item...');
  const { data: item } = await supabase.from('dev_content_queue').insert({
    page_id: 'africa_2050',
    pillar: 'breaking_news',
    engine: 'wan-2.2',
    input_data: {
      page_name: 'Africa 2050',
      topic_title: 'Bafana Bafana qualifies for World Cup',
      video_prompt: topic,
      provider: 'full-e2e-test',
    },
    status: 'pending',
  }).select().single();
  console.log('  Queue ID:', item.id);

  console.log('\n[2/6] Triggering production on live Vercel...');
  const resp = await fetch('https://genesis-studio-hazel.vercel.app/api/dev/produce', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-cron-secret': process.env.CRON_SECRET },
    body: JSON.stringify({ queueItemId: item.id }),
  });
  const data = await resp.json();
  if (!data.success) { console.error('  PRODUCTION FAILED:', data); process.exit(1); }
  const prodId = data.productionId;
  console.log('  Production ID:', prodId);
  console.log('  Voice:', data.voice);
  console.log('  Scenes:', data.scenes);

  console.log('\n[3/6] Waiting for RunPod scenes...');
  const apiKey = process.env.RUNPOD_API_KEY;
  const endpoint = 'dm5mng5h7034q7';
  let allRpDone = false;

  for (let i = 0; i < 40; i++) {
    const { data: scenes } = await supabase.from('production_scenes').select('scene_number, status, runpod_job_id').eq('production_id', prodId).order('scene_number');
    const rpStatuses = [];
    for (const s of scenes) {
      if (s.status === 'processing' && s.runpod_job_id) {
        try {
          const r = await fetch('https://api.runpod.ai/v2/' + endpoint + '/status/' + s.runpod_job_id, { headers: { Authorization: 'Bearer ' + apiKey } });
          const d = await r.json();
          rpStatuses.push('S' + s.scene_number + ':' + d.status);
        } catch { rpStatuses.push('S' + s.scene_number + ':err'); }
      } else rpStatuses.push('S' + s.scene_number + ':' + s.status);
    }
    const ts = new Date().toLocaleTimeString();
    console.log('  [' + ts + '] ' + rpStatuses.join(' '));
    if (rpStatuses.every(s => s.includes('COMPLETED') || s.includes('FAILED'))) { allRpDone = true; break; }
    await new Promise(r => setTimeout(r, 20000));
  }
  if (!allRpDone) { console.error('  RunPod timeout'); process.exit(1); }

  console.log('\n[4/6] Uploading scenes to R2...');
  const { data: scenes } = await supabase.from('production_scenes').select('*').eq('production_id', prodId).order('scene_number');
  for (const s of scenes) {
    if (s.status !== 'processing' || !s.runpod_job_id) continue;
    const r = await fetch('https://api.runpod.ai/v2/' + endpoint + '/status/' + s.runpod_job_id, { headers: { Authorization: 'Bearer ' + apiKey } });
    const d = await r.json();
    if (d.status === 'COMPLETED' && d.output?.video) {
      const buf = Buffer.from(d.output.video, 'base64');
      const key = 'brain-scenes/' + prodId.substring(0, 8) + '/' + s.scene_number + '.mp4';
      await R2.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: buf, ContentType: 'video/mp4' }));
      const url = await getSignedUrl(R2, new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn: 86400 });
      await supabase.from('production_scenes').update({ status: 'completed', output_video_url: url, progress: 100, gpu_time: d.executionTime || 0 }).eq('id', s.id);
      console.log('  Scene ' + s.scene_number + ': ' + (buf.length / 1024 / 1024).toFixed(1) + 'MB');
    }
  }
  await supabase.from('productions').update({ status: 'generating', progress: 60 }).eq('id', prodId);

  console.log('\n[5/6] Triggering assembly (ffmpeg trim + audio)...');
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY.slice(-10);
  const trigRes = await fetch('https://genesis-studio-hazel.vercel.app/api/brain/test-run?id=' + prodId + '&secret=' + secret, { headers: { 'x-test-secret': secret } });
  const trigData = await trigRes.json();
  console.log('  Status:', trigData.status, trigData.progress + '%');

  console.log('\n[6/6] Polling until complete...');
  for (let i = 0; i < 25; i++) {
    const res = await fetch('https://genesis-studio-hazel.vercel.app/api/brain/test-run?id=' + prodId + '&secret=' + secret, { headers: { 'x-test-secret': secret } });
    const d = await res.json();
    const ts = new Date().toLocaleTimeString();
    console.log('  [' + ts + '] ' + d.status + ' ' + d.progress + '%' + (d.errorMessage ? ' ERR: ' + d.errorMessage : ''));
    if (d.status === 'completed' || d.status === 'failed') {
      console.log('\n============================================');
      console.log('  ' + (d.status === 'completed' ? 'COMPLETE' : 'FAILED'));
      console.log('============================================');
      if (d.outputVideoUrls?.final) console.log('\nVIDEO: https://genesis-studio-hazel.vercel.app' + d.outputVideoUrls.final);
      if (d.thumbnailUrl) console.log('THUMB: https://genesis-studio-hazel.vercel.app' + d.thumbnailUrl);
      console.log('DASH:  https://genesis-studio-hazel.vercel.app/brain');

      const { data: finalScenes } = await supabase.from('production_scenes').select('scene_number, output_video_url').eq('production_id', prodId).order('scene_number');
      console.log('\nScene trim verification:');
      for (const s of finalScenes) {
        const trimmed = (s.output_video_url || '').includes('trimmed-');
        console.log('  Scene ' + s.scene_number + ': ' + (trimmed ? 'TRIMMED (face removed)' : 'NOT TRIMMED'));
      }
      return;
    }
    await new Promise(r => setTimeout(r, 25000));
  }
  console.log('  Timeout — check dashboard');
}
run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
