FROM node:16.13.1

# Create app directory
WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .
RUN mkdir keys

EXPOSE 80
CMD ["./docker-entrypoint.sh"]