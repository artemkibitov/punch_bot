#!/bin/bash

if [ "$NODE_ENV" = "dev" ]; then
  echo "--- Ожидание запуска ngrok туннеля ---"
  
  NGROK_URL=""
  # Цикл опроса API ngrok
  while [ -z "$NGROK_URL" ] || [ "$NGROK_URL" = "null" ]; do
    NGROK_URL=$(curl -s http://ngrok:4040/api/tunnels | jq -r '.tunnels[0].public_url')
    sleep 2
  done

  echo "--- Ngrok URL получен: $NGROK_URL ---"
  export NGROK_PUBLIC_URL=$NGROK_URL
fi

# Запуск приложения (в dev поднимется с --watch из package.json)
if [ "$NODE_ENV" = "prod" ]; then
  exec npm run start
else
  exec npm run dev
fi
