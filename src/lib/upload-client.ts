// Client-side upload helpers
// Uploads files directly to Supabase Storage via signed URLs
// Flow: 1) Get signed URL from our API  2) Upload directly to Supabase  3) Return public URL
// This bypasses Vercel's 4.5MB body limit since the file never passes through our server.

/** Upload a file to Supabase Storage via signed URL */
export async function uploadFile(
  file: File,
  purpose: "video" | "image" | "audio"
): Promise<string> {
  // Step 1: Get signed upload URL from our API (tiny JSON request)
  const res = await fetch("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type,
      purpose,
    }),
  });

  if (!res.ok) {
    let msg = "Failed to get upload URL";
    try {
      const err = await res.json();
      msg = err.error || msg;
    } catch {
      /* non-JSON response */
    }
    throw new Error(msg);
  }

  const { uploadUrl, token, publicUrl } = await res.json();

  // Step 2: Upload file directly to Supabase Storage (no Vercel limit)
  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type,
      Authorization: `Bearer ${token}`,
    },
    body: file,
  });

  if (!uploadRes.ok) {
    const text = await uploadRes.text().catch(() => "");
    throw new Error(`Upload failed (${uploadRes.status}): ${text.slice(0, 100)}`);
  }

  // Step 3: Return the public URL
  return publicUrl;
}
