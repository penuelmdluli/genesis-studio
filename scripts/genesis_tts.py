"""Local commentary voice for Genesis News hype reels. No paid API.

usage: python scripts/genesis_tts.py <engine> <voice> <speed> <out.wav> <text>
       python scripts/genesis_tts.py --batch <job.json>
         job.json: {"engine", "voice", "speed", "lines": [{"out": "...", "text": "..."}]}
         Loads the model ONCE for every line (Kokoro takes ~40s to load).
  engine  kokoro  fully offline (default voice bm_george)
          edge    Microsoft Edge read-aloud: free, online, has en-ZA voices
                  such as en-ZA-LukeNeural

Prints the duration in seconds. The hype-reel service adds compression, echo
and loudness afterwards, so this only has to say the words.
"""

import asyncio
import re
import sys


def clean(text: str) -> str:
    # Stage directions like [excited] are for engines that act; these read
    # them aloud.
    text = re.sub(r"\[[^\]]*\]", " ", text)
    # ALL-CAPS words get spelled out letter by letter ("G-O-A-L"); keep caps
    # only for real acronyms (PSL, CAF, SA).
    text = re.sub(r"\b([A-Z]{4,})\b", lambda m: m.group(1).capitalize(), text)
    return re.sub(r"\s+", " ", text).strip()


_PIPES = {}


def kokoro(voice: str, speed: float, out: str, text: str) -> None:
    # Kokoro -> transformers -> scikit-learn tries pyarrow, and the global
    # pyarrow on the owner's PC wants NumPy 2 while torch here is on 1.26.
    # Kokoro never needs pyarrow, so it is hidden rather than the global
    # environment being changed under other tools.
    sys.modules.setdefault("pyarrow", None)
    import numpy as np
    import soundfile as sf
    from kokoro import KPipeline

    lang = voice[0] if voice[:1] in "abefhijpz" else "a"
    if lang not in _PIPES:
        _PIPES[lang] = KPipeline(lang_code=lang, repo_id="hexgrad/Kokoro-82M")
    pipe = _PIPES[lang]
    audio = [np.asarray(a) for _, _, a in pipe(text, voice=voice, speed=speed)]
    sf.write(out, np.concatenate(audio), 24000, format="WAV")


async def edge(voice: str, speed: float, out: str, text: str) -> None:
    import edge_tts

    rate = f"{round((speed - 1) * 100):+d}%"
    await edge_tts.Communicate(text, voice, rate=rate, pitch="+4Hz").save(out)


FALLBACK_VOICE = "am_michael"


def speak(engine: str, voice: str, speed: str, out: str, text: str) -> float:
    text = clean(text)
    if engine == "edge":
        try:
            asyncio.run(edge(voice, float(speed), out, text))
        except Exception as e:  # free service: 429s and handshake failures happen
            # Offline Kokoro instead of a dead slot. WAV data under the
            # planned name: ffmpeg and soundfile read by content, not suffix.
            print(f"edge-tts failed ({str(e)[:80]}); offline Kokoro {FALLBACK_VOICE}", file=sys.stderr)
            kokoro(FALLBACK_VOICE, float(speed), out, text)
    else:
        kokoro(voice, float(speed), out, text)
    import soundfile as sf

    info = sf.info(out)
    return info.frames / info.samplerate


def main() -> None:
    if sys.argv[1] == "--batch":
        import json

        job = json.load(open(sys.argv[2], encoding="utf-8"))
        global FALLBACK_VOICE
        FALLBACK_VOICE = job.get("fallbackVoice") or FALLBACK_VOICE
        for line in job["lines"]:
            print(f"{line['out']}	{speak(job['engine'], job['voice'], str(job['speed']), line['out'], line['text']):.3f}", flush=True)
        return
    engine, voice, speed, out, text = sys.argv[1:6]
    text = clean(text)
    if engine == "edge":
        asyncio.run(edge(voice, float(speed), out, text))
    else:
        kokoro(voice, float(speed), out, text)

    import soundfile as sf

    info = sf.info(out)
    print(f"{info.frames / info.samplerate:.3f}")


if __name__ == "__main__":
    main()
