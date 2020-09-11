FROM node:dubnium
MAINTAINER Lucas Therapies <lucastherapiesdev@gmail.com>

RUN mkdir -p server

WORKDIR /server

ENV PATH /server/node_modules/.bin:$PATH

# install and cache app dependencies
COPY package.json /server/package.json
RUN npm install --silent

# start app
CMD ["npm", "start"]
