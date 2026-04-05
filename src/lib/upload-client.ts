// Client-side upload helpers (browser only)

/** Compress image to stay under Vercel's 4.5MB body limit */
export async function compressImage(file: File, maxSize = 2048): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width <= maxSize && height <= maxSize && file.size < 3 * 1024 * 1024) {
        resolve(file);
        return;
      }
      const scale = Math.min(maxSize / width, maxSize / height, 1);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          resolve(
            blob
              ? new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" })
              : file
          );
        },
        "image/jpeg",
        0.85
      );
    };
    img.onerror = () => resolve(file);
    img.src = URL.createObjectURL(file);
  });
}

/** Upload a file to R2 via server proxy */
export async function uploadFile(
  file: File,
  purpose: "video" | "image" | "audio"
): Promise<string> {
  const uploadFile = purpose === "image" ? await compressImage(file) : file;

  const formData = new FormData();
  formData.append("file", uploadFile);
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
    if (res.status === 413) msg = "File too large. Please use a smaller image or video.";
    throw new Error(msg);
  }

  const { downloadUrl } = await res.json();
  return downloadUrl;
}
