# 1) Этап сборки: собираем статику Vite
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci                       # точная установка по package-lock.json

COPY . .

# Vite подставляет переменные VITE_* во время СБОРКИ, а не во время запуска,
# поэтому ключи приходят аргументами сборки, а не через env_file контейнера.
# Без них приложение работает: карта откатывается на схематичную.
ARG VITE_YANDEX_MAPS_API_KEY=""
ARG VITE_YANDEX_ROUTER_API_KEY=""
ENV VITE_YANDEX_MAPS_API_KEY=$VITE_YANDEX_MAPS_API_KEY
ENV VITE_YANDEX_ROUTER_API_KEY=$VITE_YANDEX_ROUTER_API_KEY

RUN npm run build                # результат в /app/dist

# 2) Этап раздачи: лёгкий nginx отдаёт готовую статику
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
