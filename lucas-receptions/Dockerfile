FROM node:dubnium
MAINTAINER Lucas Therapies <lucastherapiesdev@gmail.com>

RUN mkdir -p react

WORKDIR /react

ENV PATH /react/node_modules/.bin:$PATH

# install and cache app dependencies
COPY package.json /react/package.json
RUN npm install --silent
RUN npm install react-scripts@3.4.0 -g

# start app
CMD ["npm", "start"]