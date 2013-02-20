var http = require('http');

var server = http.createServer(function(req, res) {
  if (req.method == 'POST' && req.url === '/incoming') {
    var buffer = '';
    req.on('data', function(chunk) {
      // receive the complete request
      buffer += chunk;
    });
    req.on('end', function () {
<<<<<<< HEAD
      var response = '<response><date>' + datenow + '</date><originalRequest>' + buffer + '</originalRequest></response>';
=======
      var datenow = new Date();
      var response = datenow + ' - ok - ' + buffer;
>>>>>>> 23417825981080fe1076c26db74cb83e49db859e
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
