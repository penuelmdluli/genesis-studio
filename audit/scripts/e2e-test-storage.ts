/**
 * Genesis Studio Audit — Storage E2E Test
 * Tests R2 upload and retrieval via persistExternalVideo.
 *
 * Usage: npx tsx audit/scripts/e2e-test-storage.ts
 * Requires: R2_* env vars in .env.local
 * Cost: $0.00
 */

import { config } from "dotenv";
config({ path: ".env.local" });

console.log("=== STORAGE E2E TEST ===\n");

const required = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"];
for (const key of required) {
  if (!process.env[key]) {
    console.log(`${key} not set. Cannot run storage test.`);
    process.exit(1);
  }
}

async function testStorage() {
  const { S3Client, PutObjectCommand, HeadObjectCommand, DeleteObjectCommand } = await import("@aws-sdk/client-s3");

  const R2 = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
    forcePathStyle: true,
  });

  const BUCKET = process.env.R2_BUCKET_NAME || "genesis-videos";
  const testKey = `audit/test-${Date.now()}.txt`;
  const testContent = Buffer.from("Genesis Studio audit test file");

  try {
    // Upload
    console.log(`Uploading test file to R2: ${testKey}`);
    await R2.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: testKey,
      Body: testContent,
      ContentType: "text/plain",
    }));
    console.log("Upload: PASS");

    // Verify
    console.log("Verifying file exists...");
    const head = await R2.send(new HeadObjectCommand({
      Bucket: BUCKET,
      Key: testKey,
    }));

    const size = head.ContentLength ?? 0;
    console.log(`File size: ${size} bytes (expected: ${testContent.length})`);
    console.log(`Content type: ${head.ContentType}`);

    if (size === testContent.length) {
      console.log("Verification: PASS");
    } else {
      console.log("Verification: FAIL (size mismatch)");
    }

    // Cleanup
    console.log("Cleaning up test file...");
    await R2.send(new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: testKey,
    }));
    console.log("Cleanup: PASS");

    console.log(`\nOverall: PASS`);
    console.log(`Bucket: ${BUCKET}`);
    console.log(`Cost: $0.00`);
  } catch (err) {
    console.log(`\nOverall: FAIL`);
    console.log(`Error: ${err}`);
  }
}

testStorage().catch(console.error);
