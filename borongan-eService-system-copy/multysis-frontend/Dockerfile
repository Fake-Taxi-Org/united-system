FROM node:20-alpine AS build
ARG VITE_API_BASE_URL
ARG VITE_PORTAL_URL
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_SUPABASE_TIMEOUT
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_PORTAL_URL=$VITE_PORTAL_URL
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_TIMEOUT=$VITE_SUPABASE_TIMEOUT
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
