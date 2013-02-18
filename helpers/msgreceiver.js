var http = require('http');

var server = http.createServer(function(req, res) {
  if (req.method == 'POST' && req.url === '/incoming') {
    var buffer = '';
    req.on('data', function(chunk) {
      // receive the complete request
      buffer += chunk;
    });
    req.on('end', function () {
      var datenow = new Date();
      var response = datenow + ' - ok - ' + buffer;
      console.log('respose will be: ' + response);
      res.writeHead(200, {
        'Content-Length': response.length,
        'Content-Type': 'text/plain'}
      );
      res.end(response);
    });
  }
});

server.listen(6000);
console.log('running!');
