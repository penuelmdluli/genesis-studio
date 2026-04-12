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
const prodId = process.argv[2] || '7f80895a-3255-4ddb-9dcd-b7e07b37dca3';

async function run() {
  console.log('\n=== Finishing E2E for production ' + prodId + ' ===\n');

  const apiKey = process.env.RUNPOD_API_KEY;
  const endpoint = 'aoy1j9tnxqbgld'; // ltx-video endpoint

  // Wait for RunPod
  console.log('[1/3] Waiting for RunPod...');
  let allDone = false;
  for (let i = 0; i < 40; i++) {
    const { data: scenes } = await supabase.from('production_scenes').select('scene_number, status, runpod_job_id').eq('production_id', prodId).order('scene_number');
    if (!scenes || scenes.length === 0) {
      console.log('  No scenes yet, waiting...');
      await new Promise(r => setTimeout(r, 15000));
      continue;
    }
    const statuses = [];
    for (const s of scenes) {
      if (s.status === 'processing' && s.runpod_job_id) {
        try {
          const r = await fetch('https://api.runpod.ai/v2/' + endpoint + '/status/' + s.runpod_job_id, { headers: { Authorization: 'Bearer ' + apiKey } });
          const d = await r.json();
          statuses.push('S' + s.scene_number + ':' + d.status);
        } catch { statuses.push('S' + s.scene_number + ':err'); }
      } else statuses.push('S' + s.scene_number + ':' + s.status);
    }
    console.log('  [' + new Date().toLocaleTimeString() + '] ' + statuses.join(' '));
    if (statuses.every(s => s.includes('COMPLETED') || s.includes('FAILED') || s.includes('completed'))) { allDone = true; break; }
    await new Promise(r => setTimeout(r, 20000));
  }
  if (!allDone) { console.error('Timeout'); process.exit(1); }

  // Upload
  console.log('\n[2/3] Uploading to R2 and triggering assembly...');
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
  await supabase.from('productions').update({ status: 'generating', progress: 60, error_message: null }).eq('id', prodId);

  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY.slice(-10);
  const trig = await fetch('https://genesis-studio-hazel.vercel.app/api/brain/test-run?id=' + prodId + '&secret=' + secret, { headers: { 'x-test-secret': secret } });
  const td = await trig.json();
  console.log('  Assembly triggered:', td.status, td.progress + '%');

  // Poll for completion
  console.log('\n[3/3] Waiting for final video...');
  for (let i = 0; i < 25; i++) {
    const res = await fetch('https://genesis-studio-hazel.vercel.app/api/brain/test-run?id=' + prodId + '&secret=' + secret, { headers: { 'x-test-secret': secret } });
    const d = await res.json();
    console.log('  [' + new Date().toLocaleTimeString() + '] ' + d.status + ' ' + d.progress + '%' + (d.errorMessage ? ' ERR: ' + d.errorMessage : ''));
    if (d.status === 'completed' || d.status === 'failed') {
      console.log('\n========================================');
      console.log('  ' + (d.status === 'completed' ? 'COMPLETE' : 'FAILED'));
      console.log('========================================');
      if (d.outputVideoUrls?.final) console.log('\nVIDEO: https://genesis-studio-hazel.vercel.app' + d.outputVideoUrls.final);
      if (d.thumbnailUrl) console.log('THUMB: https://genesis-studio-hazel.vercel.app' + d.thumbnailUrl);

      const { data: fs } = await supabase.from('production_scenes').select('scene_number, output_video_url').eq('production_id', prodId).order('scene_number');
      console.log('\nScene trim verification:');
      for (const s of fs) {
        const trimmed = (s.output_video_url || '').includes('trimmed-');
        console.log('  Scene ' + s.scene_number + ': ' + (trimmed ? 'TRIMMED' : 'NOT TRIMMED'));
      }
      return;
    }
    await new Promise(r => setTimeout(r, 25000));
  }
}
run().catch(e => console.error('FATAL:', e.message));
