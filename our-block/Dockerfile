FROM node:24-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
RUN mkdir -p /data && chown node:node /data
USER node
ENV PORT=3001 DATA_DIR=/data
EXPOSE 3001
CMD ["npm", "start"]
