FROM python:3.11-slim

WORKDIR /app

# Зависимости отдельно — слой кэшируется, пока requirements.txt не менялся.
COPY requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# Код кладём в пакет backend/ (импорты в проекте — from backend.app...).
COPY . ./backend

EXPOSE 8000

# Один процесс поднимает и API, и бота (backend/app/main.py).
CMD ["python", "-m", "backend.app.main"]
