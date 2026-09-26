# 1) Этап сборки: собираем статику Vite
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci                       # точная установка по package-lock.json

COPY . .

# Vite подставляет переменные VITE_* во время СБОРКИ, а не во время запуска,
# поэтому ключи приходят аргументами сборки, а не через env_file контейнера.
# Оба необязательны: без них карта берёт тайлы OSM, а маршрут рисуется прямой.
ARG VITE_ORS_API_KEY=""
ARG VITE_MAPTILER_KEY=""
ENV VITE_ORS_API_KEY=$VITE_ORS_API_KEY
ENV VITE_MAPTILER_KEY=$VITE_MAPTILER_KEY

RUN npm run build                # результат в /app/dist

# 2) Этап раздачи: лёгкий nginx отдаёт готовую статику
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
