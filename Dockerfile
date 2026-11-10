# Imagem para hospedar o Shinobi Wilds online (coop de até 4 jogadores).
FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY server.js ./
COPY public ./public
ENV NODE_ENV=production PORT=3000 HOST=0.0.0.0
EXPOSE 3000
CMD ["node", "server.js"]
