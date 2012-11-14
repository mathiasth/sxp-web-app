function auth(username, password, callback) {
  var userOk = (username === 'test' && password === 'test');
  if (userOk) {
    callback(false, true);
  } else {
    callback('Unauthorized', false);
  }
}

exports.auth = auth;