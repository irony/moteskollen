# Multi-stage build för optimal bildstorlek
FROM node:lts-alpine AS builder

# Sätt arbetskatalog
WORKDIR /app

# Kopiera package files
COPY package*.json ./

# Installera alla dependencies (inklusive devDependencies för bygget)
RUN npm ci

# Kopiera källkod
COPY . .

# Bygg applikationen
RUN npm run build

# Rensa devDependencies efter bygget
RUN npm prune --production

# Produktionssteg med nginx
FROM nginx:alpine

# Kopiera byggda filer till nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Kopiera nginx-konfiguration
COPY nginx.conf /etc/nginx/nginx.conf

# Exponera port 80
EXPOSE 80

# Starta nginx
CMD ["nginx", "-g", "daemon off;"]
