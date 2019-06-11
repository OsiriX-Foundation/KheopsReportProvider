FROM node:8

# Create app directory
WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 80
CMD [ "npm", "start" ]