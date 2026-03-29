# Stage 1: Build Image
FROM node:20-alpine as build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install
COPY . .
ENV VITE_API_URL=/api
RUN npm run build

# Stage 2: Production Server
FROM nginx:alpine

# Copy built assets
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
