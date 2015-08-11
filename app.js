var bodyParser = require('body-parser'),
    winston    = require('winston'),
    chalk      = require('chalk'),
    morgan     = require('morgan');

var coreHandler = require('./core'),
    xhub        = require('express-x-hub');

exports.init = function ( app ) {
  winston.debug(chalk.dim('Setting server options...'));

  app.enable('trust proxy');
  app.disable('x-powered-by');

  winston.debug(chalk.dim('Setting up middleware...'));

  var logRoute = process.env.environment === 'test' ? process.env.verboseLogging : true;

  if( logRoute ) {
    app.use( morgan('dev') );
  }

  app.use(xhub({
    algorithm: 'sha1',
    secret: require('./config/server').githubSecret
  }));
  app.use( bodyParser.json() );
  app.use(bodyParser.urlencoded({
    extended: true
  }));

  app.post('/notify-push', coreHandler.pushed);

  return app;
};
