var bodyParser = require('body-parser'),
    winston    = require('winston'),
    chalk      = require('chalk'),
    morgan     = require('morgan');

var coreHandler = require('./core');

exports.init = function ( app ) {
  winston.debug(chalk.dim('Setting server options...'));

  app.enable('trust proxy');
  app.set('x-powered-by', 'Associated Employers');

  winston.debug(chalk.dim('Setting up middleware...'));

  var logRoute = process.env.environment === 'test' ? process.env.verboseLogging : true;

  if( logRoute ) {
    app.use( morgan('dev') );
  }

  app.use( bodyParser.json() );

  app.use(bodyParser.urlencoded({
    extended: true
  }));

  app.post('/notify-push', coreHandler.pushed);

  return app;
};
