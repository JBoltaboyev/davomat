# ==========================================
# UrDPI Davomat Tizimi - Production Dockerfile
# ==========================================
FROM node:20-alpine

# Ishchi katalog
WORKDIR /app

# Muhit o'zgaruvchilari
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Bog'liqliklarni o'rnatish
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

# Loyiha fayllarini nusxalash
COPY . .

# Loglar katalogini yaratish
RUN mkdir -p logs backups

# 3000 portini ochish
EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Serverni ishga tushirish
CMD ["node", "server.js"]
