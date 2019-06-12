FROM node:8

# Create app directory
WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .
RUN mkdir keys

EXPOSE 80
CMD ["./docker-entrypoint.sh"]