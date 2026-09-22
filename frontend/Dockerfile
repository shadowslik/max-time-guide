# 1) Этап сборки: собираем статику Vite
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci                       # точная установка по package-lock.json
COPY . .
RUN npm run build                # результат в /app/dist

# 2) Этап раздачи: лёгкий nginx отдаёт готовую статику
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
