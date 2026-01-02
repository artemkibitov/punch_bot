FROM node:24-slim

# Установка системных утилит
RUN apt-get update && apt-get install -y curl jq && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Делаем скрипт запуска исполняемым
RUN chmod +x entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["./entrypoint.sh"]
