"""Find the overlay-free area of a clip (smart crop for hype reels).

usage: python scripts/genesis_overlay.py <video.mp4>  ->  prints JSON
  {"x":0.02,"y":0.12,"w":0.70,"h":0.74,"usable":true,"blobs":3}
Fractions of the frame. usable=false when too little clean picture is left.

Channel graphics (subscribe buttons, bells, like icons, banners, logos,
score bugs) keep their EDGES in the same place in every frame; the match
underneath moves. So: sample ~60 frames across the whole clip, mark pixels
that are an edge in >=60% of them, group those into blobs, and cut each
blob off from whichever frame edge removes it most cheaply. A blob in the
middle of the picture (a centred watermark) cannot be cut away: the clip is
unusable.
"""

import json
import subprocess
import sys

import numpy as np

W, H = 192, 108
SAMPLES = 60
PERSIST = 0.6
MIN_KEEP = 0.5  # keep at least half the width and half the height
MAX_CUT = 0.38  # never cut more than this from one side
MARGIN = 0.015


def frames(path: str) -> np.ndarray:
    dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
                               capture_output=True, text=True).stdout.strip() or 0)
    rate = max(SAMPLES / max(dur, 1.0), 0.02)
    # Keyframes only: decoding a 10-minute 1080p clip in full is minutes;
    # keyframes are seconds, and spread through the whole clip anyway.
    raw = subprocess.run(["ffmpeg", "-v", "error", "-skip_frame", "nokey", "-i", path, "-an",
                          "-vf", f"fps={rate:.4f},scale={W}:{H},format=gray", "-f", "rawvideo", "-"],
                         capture_output=True).stdout
    n = len(raw) // (W * H)
    return np.frombuffer(raw[: n * W * H], dtype=np.uint8).reshape(n, H, W).astype(np.float32)


def edges(f: np.ndarray) -> np.ndarray:
    gx = np.abs(np.diff(f, axis=1, prepend=f[:, :1]))
    gy = np.abs(np.diff(f, axis=0, prepend=f[:1, :]))
    g = gx + gy
    return g > max(18.0, np.percentile(g, 85))


def blobs(mask: np.ndarray) -> list[tuple[int, int, int, int, int]]:
    seen = np.zeros_like(mask, dtype=bool)
    out = []
    for y0 in range(H):
        for x0 in range(W):
            if not mask[y0, x0] or seen[y0, x0]:
                continue
            stack = [(y0, x0)]
            seen[y0, x0] = True
            xs, ys = [], []
            while stack:
                y, x = stack.pop()
                xs.append(x)
                ys.append(y)
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < H and 0 <= nx < W and mask[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        stack.append((ny, nx))
            if len(xs) >= 6:
                out.append((min(xs), min(ys), max(xs), max(ys), len(xs)))
    return out


def main() -> None:
    fs = frames(sys.argv[1])
    if len(fs) < 8:
        print(json.dumps({"x": 0, "y": 0, "w": 1, "h": 1, "usable": True, "blobs": 0, "note": "too few frames to judge"}))
        return
    persist = np.mean([edges(f) for f in fs], axis=0) >= PERSIST
    # Close small gaps so a button's outline and its text are one blob.
    p = persist.copy()
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            p |= np.roll(np.roll(persist, dy, 0), dx, 1)
    found = blobs(p)

    cut = {"l": 0.0, "r": 0.0, "t": 0.0, "b": 0.0}
    centre = []
    for x0, y0, x1, y1, _ in found:
        need = {
            "l": (x1 + 1) / W + MARGIN,
            "r": (W - x0) / W + MARGIN,
            "t": (y1 + 1) / H + MARGIN,
            "b": (H - y0) / H + MARGIN,
        }
        side = min(need, key=need.get)
        if need[side] > MAX_CUT:
            centre.append((x0, y0, x1, y1))
            continue
        cut[side] = max(cut[side], need[side])

    x, y = cut["l"], cut["t"]
    w, h = 1 - cut["l"] - cut["r"], 1 - cut["t"] - cut["b"]
    usable = not centre and w >= MIN_KEEP and h >= MIN_KEEP
    print(json.dumps({"x": round(x, 3), "y": round(y, 3), "w": round(w, 3), "h": round(h, 3),
                      "usable": usable, "blobs": len(found), "centreBlobs": len(centre)}))


if __name__ == "__main__":
    main()
