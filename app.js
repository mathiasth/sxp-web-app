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
  , destinations = connection.get('destinations')
  , messages    = connection.get('messages')
  , request     = require('request')
  , moment      = require('moment');

// globals
var app = express();
var transactionActive = false;

app.configure(function(){
  app.set('port', process.env.PORT || 8000);
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

// DB Index
messages.index({'user': 1, 'name': 1});

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

app.get('/logout', function (req, res) {
  req.session.destroy(function() {
    res.render('logout', {
      title: 'SXP Web Application'
    });
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
            callback(false,results);
          }
        });
      }
    });
  });

  socket.on('getSavedTemplateNames', function(callback) {
    console.log('EVENT getSavedTemplates received.');
    mongoStore.get(socket.handshake.sessionID, function(error, sessiondata) {
      if (error) {
        console.log('ERROR in getSavedTemplates on getting username from session: %s', error);
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
        messages.find(query, options, function(error, messages) {
          if (error) {
            console.log('ERROR in getSavedTemplates on getting user\'s templates : %s', error);
            callback(error, false);
          } else {
            var names = new Array;
            for (var i in messages) {
              var message = messages[i];
              names.push(message['name']);
            }
            callback(false,names);
          }
        });
      }
    });
  });

  socket.on('getMessageTemplateByName', function(templateName, callback) {
    console.log('EVENT getMessageTemplateByName received.');
    if (f.IsBlank(templateName)) {
      callback('Invalid template name received.');
    } else {
      mongoStore.get(socket.handshake.sessionID, function(error, sessiondata) {
        if (error) {
          console.log('ERROR in getMessageTemplateByName on getting username from session: %s', error);
          callback(error);
        } else {
          var query = {};
          query['user'] = {
            $in: [sessiondata.user, 'public']
          };
          query['name'] = templateName;
          messages.find(query, function(error, results) {
            if (error) {
              console.log('ERROR in getMessageTemplateByName on searching for template named %s: %s', templateName, error);
              callback(error);
            } else {
              if (results.length > 0) {
                // do some fancy and useful replacing
                var result = results[0]['content'];
                var datePartToday = moment().format('YYYY-MM-DD');
                var datePartTomorrow = moment().add('days', 1).format('YYYY-MM-DD');
                var datePartYesterday = moment().subtract('days', 1).format('YYYY-MM-DD');
                // result = result.replace('%today%', datePartToday);
                // result = result.replace('%tomorrow%', datePartTomorrow);
                // result = result.replace('%yesterday%', datePartYesterday);
                result = result.replace(/%today%/g, datePartToday);
                result = result.replace(/%tomorrow%/g, datePartTomorrow);
                result = result.replace(/%yesterday%/g, datePartYesterday);
                callback(false, result);
              } else {
                callback('Error when fetching message content, not found in database.');
              }
            }
          });
        }
      });
    }
  });

  socket.on('saveDocAsTemplate', function(message, callback) {
    console.log('EVENT saveDocAsTemplate received.');
    var stringsEmpty = (f.IsBlank(message['name']) || f.IsBlank(message['content']));
    if (stringsEmpty) {
      callback('Invalid message data received. Neither message name, nor message body must be empty.');
    } else {
      mongoStore.get(socket.handshake.sessionID, function(error, sessiondata) {
        if (error) {
          console.log('ERROR in sendNewDestination on getting username from session: %s', error);
        } else {
          var query = {};
          query['user'] = {
            $in: [sessiondata.user, 'public']
          };
          query['name'] = message.name;
          messages.find(query, function(error, results) {
            if (error) {
              console.log('ERROR in saveDocAsTemplate on searching for existing template: %s', error);
              callback(error);
            } else {
              var resultLength = Object.size(results);
              if (resultLength != 0) {
                callback('There is already a message for you or the public role with that name. Be creative!');
              } else {
                query['user'] = sessiondata.user;
                query['content'] = message.content;
                messages.insert(query, function(error) {
                  if (error) {
                    console.log('ERROR in saveDocAsTemplate on inserting the new template: %s', error);
                    callback(error);
                  } else {
                    console.log('New temaplte for %s saved, named %s.', sessiondata.user, message['name']);
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
      mongoStore.get(socket.handshake.sessionID, function(error, sessiondata) {
        if (error) {
          callback('Error in deleteDestinationByID when getting sessiondata: ' + error);
        } else {
          destinations.findById(id, function(error, doc) {
            if (error) {
              callback('Error in deleteDestinationByID when looking up saved destination: ' + error);
            } else {
              // doc = JSON.parse(doc);
              var allowedToDelete = (doc.user === sessiondata.user);
              console.log('isallowedtodelete: ' + allowedToDelete);
              if (allowedToDelete) {
                var query = {};
                query['_id'] = id;
                console.log('about to delete document with id ' + JSON.stringify(query));
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

  socket.on('deleteTemplateByName', function(templateName, callback) {
    console.log('EVENT deleteTemplateByName received: ' + templateName);
    if (f.IsBlank(templateName)) {
      callback('Template deletion failed, supplied name is invalid: ' + templateName);
    } else {
      mongoStore.get(socket.handshake.sessionID, function(error, sessiondata) {
        if (error) {
          callback('Error in deleteTemplateByName when getting sessiondata: ' + error);
        } else {
          var query = {};
          query['name'] = templateName;
          query['user'] = sessiondata.user;
          messages.find(query, function(error, docs) {
            if (error) {
              callback('Error in deleteTemplateByName when looking up saved template: ' + error);
            } else {
              var resultLength = Object.size(docs);
              if (resultLength === 1) {
                var doc = docs[0];
                var allowedToDelete = (doc.user === sessiondata.user);
                if (allowedToDelete) {
                  console.log('about to delete template by query ' + JSON.stringify(query));
                  messages.remove(query, function(error) {
                    if (error) {
                      callback(error);
                    } else {
                      callback(false);
                    }
                  });
                } else {
                  callback('You are not the one you are supposed to be. Strange!');
                }
              } else {
                callback('Received more than 1 results when looking up the template to delete.');
              }
            }
          });
        }
      });
    }
  });

  socket.on('sendMultiMessages', function(options, callback) {
    console.log('EVENT sendMultiMessages received: ' + JSON.stringify(options));
    var isURL = f.TestURL(options['url']);
    // empty values for count and parallelism are set to 1
    options['count'] = f.IsBlank(options['count']) ? 1 : options['count'];
    options['parallelism'] = f.IsBlank(options['parallelism']) ? 1 : options['parallelism'];
    console.log('processing: ' + JSON.stringify(options));
    mongoStore.get(socket.handshake.sessionID, function(error, sessiondata) {
      if (sessiondata && isURL) {
        if (!transactionActive) {
          if (options['count'] >= config.app.transactionMinMsg) {
            transactionActive = true;  
          }
          f.DoTransaction(request, options['messageBody'], options['url'], options['count'], options['parallelism'], sessiondata.user, function(error) {
            if (error) {
              if (options['count'] >= config.app.transactionMinMsg) {
                transactionActive = false;
                console.log('resetting transaction flag: ' + transactionActive);
              }
              console.log('ERROR in transaction: ' + error);
            } else {
              if (options['count'] >= config.app.transactionMinMsg) {
                transactionActive = false;
                console.log('resetting transaction flag: ' + transactionActive);
              }
              callback(false);                
            }
          });        
        } else {
          callback('Active transaction found, please wait.');
        }
      }
    });
  });

  socket.on('sendSingleMessage', function(options, callback) {
    console.log('EVENT sendSingleMessage received: ' + JSON.stringify(options));
    var isURL = f.TestURL(options['url']);
    mongoStore.get(socket.handshake.sessionID, function(error, sessiondata) {
      if (sessiondata && isURL) {
        f.sendSingleMessage(request, options['messageBody'], options['url'], sessiondata.user, function(error, response) {
          if (error) {
            console.log('ERROR in SingleMessage: ' + error);
            callback(error);
          } else {
            socket.emit('setResponseTextfield', response);
            callback(false);
          }
        });
      }
    });
  })
});


// function for getting the length of an object
Object.size = function(obj) {
    var size = 0, key;
    for (key in obj) {
        if (obj.hasOwnProperty(key)) size++;
    }
    return size;
};
