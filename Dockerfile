# ============================================================
#  Cómo se arma la web para publicarla.
#  Dokploy lee este archivo, construye el sitio en el servidor y lo sirve.
#  Vos no tenés que correr nada de esto en tu compu.
# ============================================================

# ---------- Etapa 1: construir ----------
FROM node:22-alpine AS build
WORKDIR /app

# Primero SOLO los manifiestos. Si no cambiaron, Docker reusa la capa de
# dependencias ya instaladas y el deploy tarda segundos en vez de minutos.
# Si copiáramos todo de una, cualquier cambio en un texto reinstalaría todo.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# `npm run build` dispara solo el `prebuild`, que corre scripts/check-offline.mjs:
# si alguna calculadora quedó pidiendo algo por internet, el deploy FALLA acá y
# no se publica. Es a propósito.
RUN npm run build

# ---------- Etapa 2: servir ----------
# Nginx sirve archivos estáticos y listo. La imagen final no lleva Node ni
# node_modules: pesa unos pocos MB en vez de cientos.
FROM nginx:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

# Nada de HEALTHCHECK acá: el `wget --spider` de nginx-alpine (BusyBox) no anda,
# el chequeo quedaba "unhealthy" para siempre y Docker Swarm nunca metía el
# contenedor en el ruteo de Traefik -> 502 Bad Gateway. Dokploy/Traefik vigilan
# la salud por su cuenta, no hace falta uno propio.
