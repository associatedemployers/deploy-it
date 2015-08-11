var express  = require('express'),
    winston  = require('winston'),
    chalk    = require('chalk'),
    logLevel = process.env.environment === 'development' || process.env.environment === 'dev' ? 'debug' : 'info';

winston.loggers.add('default', {
  transports: [
    new winston.transports.Console({ level: logLevel })
  ]
});

var app = require('./app');

var port = process.env.port || 3000;

process.title = 'Deploy It - Node.js';

app.init(express()).listen(port, function () {
  winston.info(chalk.dim('Deploy-it listening on port:', port));
});
