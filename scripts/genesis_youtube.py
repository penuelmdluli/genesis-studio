"""Upload a Genesis News hype reel as a YouTube Short, through ai-video-factory's
uploader and its already-authorised channel token (tokens/youtube_token_<niche>.json).

usage: python scripts/genesis_youtube.py <video_url_or_path> <title> <description_file> [niche] [cover.jpg]
       python scripts/genesis_youtube.py --thumb <video_id> <cover.jpg> [niche]

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


def set_thumbnail(video_id: str, image: str, niche: str) -> None:
    """Custom thumbnail on an uploaded video (needs a phone-verified channel)."""
    import json
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build
    from googleapiclient.http import MediaFileUpload

    creds = Credentials.from_authorized_user_info(
        json.loads((FACTORY / "tokens" / f"youtube_token_{niche}.json").read_text()))
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
    build("youtube", "v3", credentials=creds).thumbnails().set(
        videoId=video_id, media_body=MediaFileUpload(image, mimetype="image/jpeg")).execute()


def main() -> None:
    # usage 2: python scripts/genesis_youtube.py --thumb <video_id> <image.jpg> [niche]
    if sys.argv[1] == "--thumb":
        set_thumbnail(sys.argv[2], sys.argv[3], sys.argv[4] if len(sys.argv) > 4 else "sa_pulse")
        print("thumbnail set")
        return
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
    # Optional 5th arg: the reel's cover image (local path).
    if len(sys.argv) > 5 and Path(sys.argv[5]).exists():
        try:
            set_thumbnail(vid, sys.argv[5], niche)
        except Exception as e:  # never lose the upload over a thumbnail
            print(f"thumbnail not set: {str(e)[:160]}", file=sys.stderr)
    try:
        from modules.playlists import add_youtube
        add_youtube(vid, shorts=True)
    except Exception:
        pass
    print(vid)


if __name__ == "__main__":
    main()
