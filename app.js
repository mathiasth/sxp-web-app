var express = require('express')
  , http = require('http')
  , path = require('path')
  , connect     = require('connect')
  , Db          = require('mongodb').Db
  , Server      = require('mongodb').Server
  , DbConfig    = new Server('127.0.0.1', 27017, {auto_reconnect: true, native_parser: true})
  , db          = new Db('sxp', DbConfig, {safe:true})
  , mStore      = require('connect-mongodb')
  , mongoStore  = new mStore({db: db, reapInterval: 60000})
  , cookie      = require('cookie')
  , functions   = require('./functions.js')
  , flash       = require('connect-flash')
  , io          = require('socket.io');

var app = express();

app.configure(function(){
  app.set('port', process.env.PORT || 3000);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.logger({ 
    format: ':remote-addr \x1b[1m:method\x1b[0m \x1b[33m:url\x1b[0m :response-time ms'
  }));
  app.use(express.favicon());
  app.use(express.bodyParser());
  app.use(express.cookieParser('klfLKdfi8fA)iaoskkeoADPOclO#34'));
  app.use(express.session({ store: mongoStore }));
  app.use(flash());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function(){
  app.use(express.errorHandler());
});

app.get('/', requiresLogin, function(req, res) {
  res.render('index', { 
    title: 'SXP Web Application',
    user: req.session.user }
  );
});

app.get('/login', function(req, res) {
  res.render('login', { 
    title: 'Login',
    message: req.flash('error')
  });
});

app.post('/auth', function(req, res) {
  functions.auth(req.body.username, req.body.password, function(error, success) {
    if (error) {
      req.flash('error',error);
      res.redirect('/login');
    } else {
      req.session.user = req.body.username.toLowerCase();
      res.redirect('/');
    }
  })
});

var server = http.createServer(app).listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});

function requiresLogin(req, res, next) {
  if( req.session.user ) {
    next();
  } else {
    res.redirect('/login');
  }
};

var sio = io.listen(server);

sio.enable('browser client minification');
sio.enable('browser client etag');
sio.enable('browser client gzip');

// 0: error, 1 warn, 2 info, 3 debug
sio.set('log level', 2);

sio.set('authorization', function(data, callback) {
  // check for a cookie within the header
  if (data.headers.cookie) {
    data.cookie = cookie.parse(data.headers.cookie);
    data.sessionID = data.cookie['connect.sid'].split('.')[0].split(':')[1];
    /* find the session document from the database and look, whether a 'user'
       key is present. in this case, the session's user has already been 
       authenticated to the application and his corresponding session will also 
       be authorized for socket.io access */
    mongoStore.get(data.sessionID, function(error, sessiondata) {
      if (error) {
        callback(error, false);
      } else {
        var haveIdentifiedUser = sessiondata.hasOwnProperty('user');
        if (haveIdentifiedUser) {
          // acceppt the incoming connection
          callback(false, true);
        } else {
          callback('Authorization declined.', false) ;
        }      
      }
    })
  } else {
    callback('Authorization declined.', false) ;
  }
});

sio.sockets.on('connection', function (socket) {
  socket.join(socket.handshake.sessionID);
});