var config = {};

config.xmleditor = {};
config.db = {};
config.app = {};

config.xmleditor.mode = 'text/xml';
config.xmleditor.theme = 'ambiance';
config.xmleditor.tabSize = 2;
config.xmleditor.lineNumbers = true;
config.xmleditor.autofocus = true;

config.db.host = '127.0.0.1';
config.db.port = 27017;
config.db.name = 'sxp';

// define the minimal size for a transaction (triggers application locking)
config.app.transactionMinMsg = 30;

module.exports = config;