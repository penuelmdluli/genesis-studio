"""Upload a Genesis News hype reel as a YouTube Short, through ai-video-factory's
uploader and its already-authorised channel token (tokens/youtube_token_<niche>.json).

usage: python scripts/genesis_youtube.py <video_url_or_path> <title> <description_file> [niche]

Prints the YouTube video id. Run from anywhere: it switches into the factory
folder because the uploader reads tokens/ relative to it.
"""

import asyncio
import os
import sys
import tempfile
import urllib.request
from pathlib import Path

FACTORY = Path(os.environ.get("AI_VIDEO_FACTORY_DIR", r"C:\Users\PenuelM\Documents\ai-video-factory"))


def main() -> None:
    src, title, desc_file = sys.argv[1:4]
    niche = sys.argv[4] if len(sys.argv) > 4 else "sa_pulse"
    description = Path(desc_file).read_text(encoding="utf-8")

    if src.startswith("http"):
        tmp = Path(tempfile.gettempdir()) / f"genesis-yt-{os.getpid()}.mp4"
        # The CDN (Cloudflare) answers Python-urllib's default agent with 403.
        req = urllib.request.Request(src, headers={"User-Agent": "Mozilla/5.0 genesis-news-uploader"})
        with urllib.request.urlopen(req, timeout=300) as r, open(tmp, "wb") as f:
            f.write(r.read())
        video = str(tmp)
    else:
        video = src

    os.chdir(FACTORY)
    sys.path.insert(0, str(FACTORY))
    if not (FACTORY / "tokens" / f"youtube_token_{niche}.json").exists():
        sys.exit(f"no YouTube token for {niche}")
    from modules.uploader_youtube import upload_to_youtube

    # Shorts: title <= 100 chars and #Shorts in it is still the surest tag.
    title = (title if "#shorts" in title.lower() else f"{title} #Shorts")[:100]
    tags = ["PSL", "Kaizer Chiefs", "Orlando Pirates", "Mamelodi Sundowns", "Bafana Bafana", "South African football", "Genesis News"]
    result = asyncio.run(upload_to_youtube(video_path=video, title=title, description=description[:4900],
                                           tags=tags, niche=niche, is_short=True))
    vid = (result or {}).get("video_id", "")
    if not vid:
        sys.exit(f"upload returned no id: {result}")
    try:
        from modules.playlists import add_youtube
        add_youtube(vid, shorts=True)
    except Exception:
        pass
    print(vid)


if __name__ == "__main__":
    main()
