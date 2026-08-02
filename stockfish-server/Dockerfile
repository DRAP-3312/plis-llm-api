FROM node:22-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends stockfish \
    && rm -rf /var/lib/apt/lists/*

# El paquete de Debian instala el binario en /usr/games (convención de la
# sección "games" del archivo), que no está en el PATH por defecto.
ENV PATH="/usr/games:${PATH}"
RUN which stockfish

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install --omit=dev

COPY server.js ./

EXPOSE 8080

CMD ["node", "server.js"]
