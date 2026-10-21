FROM node:24-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --include=dev
COPY . .
RUN npm run build
ENV NODE_ENV=production PORT=3000 DATA_DIR=/data
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 3000
CMD ["npm", "start"]
