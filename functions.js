function Auth(username, password, callback) {
  var validLogin = (username === password && is_int(username));
  if (validLogin) {
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

function DoTransaction(request, messageBody, destinationUrl, messageCount, messageParallel, createdBy, callback) {
  callback(false);
};

function sendSingleMessage(request, messageBody, destinationUrl, createdBy, callback) {
  request.post({url: destinationUrl, body: messageBody}, function(error, r, body) {
    if (error) {
      console.log('ERROR in sendSingleMessage: ' + JSON.stringify(error));
      callback(error['code'], false);
    } else {
      callback(false, body);
    }
  });
};

function is_int(value){
  if ((parseFloat(value) == parseInt(value)) && !isNaN(value)) {
    return true;
  } else {
    return false;
  }
}

exports.Auth = Auth;
exports.IsBlank = IsBlank;
exports.TestURL = TestURL;
exports.sendSingleMessage = sendSingleMessage;
exports.DoTransaction = DoTransaction;