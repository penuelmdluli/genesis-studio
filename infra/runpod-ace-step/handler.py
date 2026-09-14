"""
Genesis Studio — ACE-Step RunPod Serverless Handler
Generates songs from lyrics using ACE-Step.

Input:
  - tags: str (genre tags, e.g. "pop, catchy, upbeat")
  - lyrics: str (song lyrics with [Verse], [Chorus] tags)
  - duration: int (seconds, 15/30/60)
  - num_steps: int (inference steps, default 40)
  - lyric_guidance_scale: float (default 2.5)
  - scheduler: str (default "euler")

Output:
  - audio_url: str (base64 encoded audio, or URL if R2 upload configured)
"""

import runpod
import base64
import io
import traceback

# Lazy-load the pipeline (first request only)
_pipeline = None

def get_pipeline():
    global _pipeline
    if _pipeline is None:
        from ace_step.pipeline import ACEStepPipeline
        _pipeline = ACEStepPipeline()
        # Warm up with a short generation
        print("[ACE-Step] Pipeline loaded, warming up...")
        _pipeline.generate(
            tags="test",
            lyrics="test",
            duration=5,
            num_steps=5,
        )
        print("[ACE-Step] Warm-up complete")
    return _pipeline


def handler(event):
    try:
        inp = event.get("input", {})
        tags = inp.get("tags", "pop, catchy, upbeat")
        lyrics = inp.get("lyrics", "")
        duration = min(int(inp.get("duration", 30)), 120)
        num_steps = int(inp.get("num_steps", 40))
        lyric_guidance_scale = float(inp.get("lyric_guidance_scale", 2.5))
        scheduler = inp.get("scheduler", "euler")
        seed = inp.get("seed", -1)

        if not lyrics:
            return {"error": "No lyrics provided"}

        pipe = get_pipeline()

        print(f"[ACE-Step] Generating: tags={tags[:50]}, duration={duration}s, steps={num_steps}")

        result = pipe.generate(
            tags=tags,
            prompt=tags,
            lyrics=lyrics,
            duration=duration,
            num_steps=num_steps,
            lyric_guidance_scale=lyric_guidance_scale,
            scheduler=scheduler,
            seed=seed if seed >= 0 else None,
        )

        # Result is a tuple (sample_rate, audio_array) or dict with audio
        if isinstance(result, tuple):
            sample_rate, audio_data = result
        elif isinstance(result, dict):
            sample_rate = result.get("sample_rate", 44100)
            audio_data = result.get("audio", result.get("waveform"))
        else:
            return {"error": f"Unexpected result type: {type(result)}"}

        # Convert to WAV bytes
        import soundfile as sf
        import numpy as np

        audio_np = np.array(audio_data)
        if audio_np.ndim > 1:
            audio_np = audio_np.squeeze()

        buf = io.BytesIO()
        sf.write(buf, audio_np, sample_rate, format="WAV")
        buf.seek(0)

        audio_b64 = base64.b64encode(buf.read()).decode("utf-8")

        print(f"[ACE-Step] Generated {duration}s audio, {len(audio_b64)} chars base64")

        return {
            "audio_base64": audio_b64,
            "sample_rate": sample_rate,
            "duration": duration,
            "format": "wav",
        }

    except Exception as e:
        traceback.print_exc()
        return {"error": str(e)}


runpod.serverless.start({"handler": handler})
