// Client-side upload helpers
// Uploads files to R2 via our API endpoint (which streams to R2)

/** Upload a file to R2 via the upload API */
export async function uploadFile(
  file: File,
  purpose: "video" | "image" | "audio"
): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("purpose", purpose);

  const res = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    let msg = "Failed to upload file";
    try {
      const err = await res.json();
      msg = err.error || msg;
    } catch {
      /* non-JSON response */
    }
    throw new Error(msg);
  }

  const { publicUrl, url } = await res.json();
  return publicUrl || url;
}
