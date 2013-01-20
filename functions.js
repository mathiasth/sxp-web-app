function Auth(username, password, callback) {
  var userOk = (username === 'test' && password === 'test');
  if (userOk) {
    callback(false, true);
  } else {
    callback('Unauthorized', false);
  }
}

function IsBlank(str) {
  return (!str || /^\s*$/.test(str));
};

function TestURL(str) {
  var urlPattern = /(http|https):\/\/[\w-]+(\.[\w-]+)+([\w.,@?^=%&amp;:\/~+#-]*[\w@?^=%&amp;\/~+#-])?/
  return urlPattern.test(str);
};

exports.Auth = Auth;
exports.IsBlank = IsBlank;
exports.TestURL = TestURL;