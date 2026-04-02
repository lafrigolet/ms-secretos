FROM node:20-alpine

WORKDIR /app

# Instalar dependencias primero (cacheo de capas)
COPY package.json ./
RUN npm install --omit=dev

# Copiar código fuente
COPY src/ ./src/

RUN chown -R node:node /app
USER node

EXPOSE 3001

CMD ["node", "src/app.js"]
