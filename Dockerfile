FROM node:22-alpine

WORKDIR /app

COPY backend/package*.json ./
RUN npm install --omit=dev

COPY backend/ ./
COPY frontend/ ./frontend/
COPY admin/ ./admin/

EXPOSE 8080

CMD ["npm", "start"]
