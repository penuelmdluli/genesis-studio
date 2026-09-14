"""
Genesis Studio — SadTalker RunPod Serverless Handler
Generates lip-synced video from face image + audio.

Input:
  - face_image_url: str (URL to face image)
  - audio_url: str (URL to audio file)
  - preprocess: str ("crop" | "resize" | "full", default "crop")
  - still_mode: bool (less head motion, default False)
  - enhancer: str ("gfpgan" | null, default "gfpgan")

Output:
  - video_base64: str (base64 encoded MP4)
"""

import runpod
import base64
import os
import sys
import tempfile
import traceback
import requests
import subprocess
import uuid

sys.path.insert(0, "/sadtalker")


def download_file(url, suffix=".tmp"):
    """Download a file from URL to a temp path."""
    resp = requests.get(url, stream=True, timeout=120)
    resp.raise_for_status()
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    for chunk in resp.iter_content(chunk_size=8192):
        tmp.write(chunk)
    tmp.close()
    return tmp.name


def handler(event):
    try:
        inp = event.get("input", {})
        face_image_url = inp.get("face_image_url", "")
        audio_url = inp.get("audio_url", "")
        preprocess = inp.get("preprocess", "crop")
        still_mode = inp.get("still_mode", False)
        enhancer = inp.get("enhancer", "gfpgan")

        if not face_image_url:
            return {"error": "face_image_url is required"}
        if not audio_url:
            return {"error": "audio_url is required"}

        print(f"[SadTalker] Downloading face image...")
        # Determine file extension from URL
        img_ext = ".png"
        for ext in [".jpg", ".jpeg", ".png", ".webp"]:
            if ext in face_image_url.lower():
                img_ext = ext
                break
        face_path = download_file(face_image_url, suffix=img_ext)

        print(f"[SadTalker] Downloading audio...")
        aud_ext = ".wav"
        for ext in [".mp3", ".wav", ".ogg", ".m4a"]:
            if ext in audio_url.lower():
                aud_ext = ext
                break
        audio_path = download_file(audio_url, suffix=aud_ext)

        # Convert audio to WAV if needed (SadTalker expects WAV)
        if aud_ext != ".wav":
            wav_path = audio_path.replace(aud_ext, ".wav")
            subprocess.run(
                ["ffmpeg", "-y", "-i", audio_path, "-ar", "16000", "-ac", "1", wav_path],
                check=True, capture_output=True,
            )
            os.unlink(audio_path)
            audio_path = wav_path

        output_dir = tempfile.mkdtemp()
        job_id = str(uuid.uuid4())[:8]

        print(f"[SadTalker] Generating lip-sync video (preprocess={preprocess}, enhancer={enhancer})...")

        # Run SadTalker inference
        from inference import main as sadtalker_main

        # Build args
        args = [
            "--driven_audio", audio_path,
            "--source_image", face_path,
            "--result_dir", output_dir,
            "--preprocess", preprocess,
            "--checkpoint_dir", "/sadtalker/checkpoints",
        ]

        if still_mode:
            args.append("--still")

        if enhancer:
            args.extend(["--enhancer", enhancer])

        # SadTalker uses argparse, call it directly
        sadtalker_main(args)

        # Find the output video
        output_video = None
        for root, dirs, files in os.walk(output_dir):
            for f in files:
                if f.endswith(".mp4"):
                    output_video = os.path.join(root, f)
                    break
            if output_video:
                break

        if not output_video or not os.path.exists(output_video):
            return {"error": "SadTalker did not produce an output video"}

        # Read and encode
        with open(output_video, "rb") as f:
            video_b64 = base64.b64encode(f.read()).decode("utf-8")

        file_size = os.path.getsize(output_video)
        print(f"[SadTalker] Done. Output: {file_size} bytes")

        # Cleanup
        os.unlink(face_path)
        os.unlink(audio_path)

        return {
            "video_base64": video_b64,
            "format": "mp4",
            "file_size": file_size,
        }

    except Exception as e:
        traceback.print_exc()
        return {"error": str(e)}


runpod.serverless.start({"handler": handler})
