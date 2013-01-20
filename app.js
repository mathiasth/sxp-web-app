var express     = require('express')
  , config      = require('./config.js')
  , http        = require('http')
  , path        = require('path')
  , connect     = require('connect')
  , connection  = require('monk')(config.db.host + '/' + config.db.name)
  , Db          = require('mongodb').Db
  , Server      = require('mongodb').Server
  , DbConfig    = new Server(config.db.host, config.db.port, {auto_reconnect: true, native_parser: true})
  , db          = new Db(config.db.name, DbConfig, {safe:true})
  , mStore      = require('connect-mongodb')
  , mongoStore  = new mStore({db: db, reapInterval: 60000})
  , cookie      = require('cookie')
  , f           = require('./functions.js')
  , flash       = require('connect-flash')
  , io          = require('socket.io')
  , destinations = connection.get('destinations');

var app = express();

app.configure(function(){
  app.set('port', process.env.PORT || 8001);
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
    user: req.session.user,
    editorTheme: config.xmleditor.theme }
  );
});

app.get('/login', function(req, res) {
  res.render('login', { 
    title: 'Login',
    message: req.flash('error')
  });
});

app.post('/auth', function(req, res) {
  f.Auth(req.body.username, req.body.password, function(error, success) {
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
  socket.emit('helloClient');

  socket.on('getConfigurationElementByName', function(elementName, callback) {
    if (config.hasOwnProperty(elementName)) {
      callback(false, config[elementName]);
    } else {
      callback('Configuration element unknown.', false);
    }
  });

  socket.on('getSavedDestinations', function(callback) {
    console.log('EVENT getSavedDestinations received.');
    mongoStore.get(socket.handshake.sessionID, function(error, sessiondata) {
      if (error) {
        console.log('ERROR in getSavedDestinations on getting username from session: %s', error);
        callback(error, false);
      } else {
        var query = {};
        query['user'] = {
          $in: [sessiondata.user, 'public']
        };
        var options = {};
        options['$orderby'] = {
          'name' : 1
        }
        destinations.find(query, options, function(error, results) {
          if (error) {
            console.log('ERROR in getSavedDestinations on getting user\'s destinations : %s', error);
            callback(error, false);
          } else {
            console.log('RESULT of getting destinations: %s', JSON.stringify(results));
            callback(false,results);
          }
        });
      }
    });
  });

  socket.on('sendNewDestination', function(destination, callback) {
    var stringsEmpty = (f.IsBlank(destination['name']) || f.IsBlank(destination['url']));
    var isURL = f.TestURL(destination['url']);
    if (stringsEmpty || !isURL) {
      callback('Invalid destination received.');
    } else {
      // see if the user already has a destination with the given url
      mongoStore.get(socket.handshake.sessionID, function(error, sessiondata) {
        if (error) {
          console.log('ERROR in sendNewDestination on getting username from session: %s', error);
          callback(error);
        } else {    
          var query = {};
          query['user'] = sessiondata.user;
          query['urllc'] = destination['url'].toLowerCase();
          destinations.find(query, function(error, result) {
            if (error) {
              console.log('ERROR in sendNewDestination on searching for existing destination: %s', error);
              callback(error);
            } else {
              var resultLength = Object.size(result);
              if (resultLength != 0) {
                callback('You already have a destination with this URL: ' + JSON.stringify(result));
              } else {
                query['url'] = destination['url'];
                query['name'] = destination['name'];
                destinations.insert(query, function(error) {
                  if (error) {
                    console.log('ERROR in sendNewDestination on inserting the new destination: %s', error);
                    callback(error);
                  } else {
                    console.log('New destination (%s, %s) for %s has been inserted', destination['name'], destination['url'], sessiondata.user);
                    callback(false);
                  }
                });
              }
            }
          });
        }
      });
    }
  });

  socket.on('deleteDestinationByID', function(id, callback) {
    console.log('EVENT deleteDestinationByID received: ' + id);
    if (f.IsBlank(id)) {
      callback('Destination deletion failed, supplied ID is invalid: ' + id);
    } else {
      destinations.findById(id, function(error, doc) {
        if (error) {
          callback('Error in deleteDestinationByID when checking for existing destination: ' + error);
        } else {
          mongoStore.get(socket.handshake.sessionID, function(error, sessiondata) {
            if (error) {
              console.log(socket.handshake.sessionID + ' ' + JSON.stringify(error) + ' ' + JSON.stringify(sessiondata));
              callback(JSON.stringify(error));
            } else {
              doc = JSON.parse(doc);
              var allowedToDelete = (doc.user === sessiondata.user);
              console.log('isallowedtodelete: ' + allowedToDelete);
              if (allowedToDelete) {
                var query = {};
                query['_id'] = id;
                destinations.remove(query, function(error) {
                  if (error) {
                    callback(error);
                  } else {
                    callback(false);
                  }
                });
              }
            }
          });
        }
      });
    }
  });
});


// function for getting the length of an object
Object.size = function(obj) {
    var size = 0, key;
    for (key in obj) {
        if (obj.hasOwnProperty(key)) size++;
    }
    return size;
};