FROM node:20-alpine
WORKDIR /app

# Install deps first for better layer caching
COPY package.json ./
RUN npm install --omit=dev

# Copy source
COPY tsconfig.json ./
COPY *.ts ./

# Run the gateway bot (tsx executes TypeScript without a separate build step)
CMD ["npx", "tsx", "index.ts"]
