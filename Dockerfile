FROM node:5.11.0-slim

RUN apt-get update && \
    apt-get install -y mysql-client-5.5 ssh rsyslog rsyslog-relp dnsutils
ADD . /api
WORKDIR /api

RUN npm install --production

ENTRYPOINT ["/api/start.sh"]
