FROM node:14-alpine as baseimage
RUN mkdir app/
ADD . app/
WORKDIR /app

RUN npm install

FROM baseimage
CMD ["yarn", "start:dev"]
EXPOSE 3000