FROM node:20-alpine

# PIN yt-dlp, AND BUMP THE PIN WHEN A SITE STOPS DOWNLOADING.
#
# This line used to read `pip3 install yt-dlp` with no version, which looks
# like "always the newest" and is the exact opposite. Docker caches the layer,
# so the image kept whichever yt-dlp was current the day it was FIRST built and
# never picked up another one - no rebuild, no upgrade, no warning.
#
# That matters here more than for most dependencies: Facebook and TikTok change
# their page markup every few weeks, yt-dlp ships a fix within days, and a copy
# that has missed a few of those fails with a bare "yt-dlp failed" on links that
# are perfectly good. It silently killed lead-video ingest between 18 and 24 Sep
# 2026 - the lead row lands on status='failed', and /api/admin/lead-drivers only
# serves status='ready', so the reel pipeline simply never saw the clip and the
# owner had no way to tell the difference from "nothing was added".
#
# An explicit version also gives the cache something to notice: changing this
# number is what forces the layer to rebuild. 2026.8.19 verified 2026-09-24
# against the Facebook reel that broke it.
ARG YTDLP_VERSION=2026.8.19
RUN apk add --no-cache python3 py3-pip ffmpeg curl \
    fontconfig font-noto font-noto-emoji ttf-dejavu \
    && pip3 install --break-system-packages "yt-dlp==${YTDLP_VERSION}" \
    && fc-cache -f

# Fail the BUILD on a bad pin rather than every download at run time.
RUN yt-dlp --version | grep -q . && yt-dlp --version

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --production
COPY . .

EXPOSE 3001
CMD ["node", "server.js"]
