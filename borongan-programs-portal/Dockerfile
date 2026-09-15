FROM node:20-bookworm-slim AS build
RUN apt-get update && apt-get install -y python3 make g++ pkg-config libpixman-1-dev libcairo2-dev libpango1.0-dev libgif-dev librsvg2-dev && rm -rf /var/lib/apt/lists/*
ARG VITE_BIMS_SERVER_URL
ARG VITE_API_BASE_URL
ARG VITE_ESERVICES_PORTAL_URL
ARG VITE_OTHER_PROGRAMS_URL
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_MAPBOX_TOKEN
ENV VITE_BIMS_SERVER_URL=$VITE_BIMS_SERVER_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_ESERVICES_PORTAL_URL=$VITE_ESERVICES_PORTAL_URL
ENV VITE_OTHER_PROGRAMS_URL=$VITE_OTHER_PROGRAMS_URL
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_MAPBOX_TOKEN=$VITE_MAPBOX_TOKEN
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx-spa.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
