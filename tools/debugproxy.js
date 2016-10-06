var tcpProxy = require('tcp-proxy');

var server = tcpProxy.createServer({
  target: {
    host: '127.0.0.1',
    port: 5858
  }
});

console.log("debug proxy 5859->5858")
server.listen(5859);
