FROM node:24.14.1-alpine AS build
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Prod Stage
FROM node:24.14.1-alpine AS production 
WORKDIR /usr/src/app
COPY --from=build /usr/src/app/dist ./dist
COPY package*.json ./
COPY .env ./.env
RUN npm install --omit=dev

EXPOSE 3000
CMD npm run start:prod