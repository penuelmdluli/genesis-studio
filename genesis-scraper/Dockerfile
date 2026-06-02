FROM node:20-alpine

# Install yt-dlp + ffmpeg + fonts (for text overlays)
RUN apk add --no-cache python3 py3-pip ffmpeg curl \
    fontconfig font-noto font-noto-emoji ttf-dejavu \
    && pip3 install --break-system-packages yt-dlp \
    && fc-cache -f

# Verify yt-dlp works
RUN yt-dlp --version

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --production
COPY . .

EXPOSE 3001
CMD ["node", "server.js"]
