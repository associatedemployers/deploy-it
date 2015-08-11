/*
  Core Handler
*/

var winston = require('winston');

var Promise = require('bluebird');

var exec = require('child_process').exec,
    manifest = require('./config/manifest'),
    settings = require('./config/server');

function _cloneTarget ( target, githubData ) {
  return new Promise(function ( resolve, reject ) {
    winston.log('debug', 'Cloning target...');

    const _path = target.clonePath || settings.defaultClonePath;
    var cloneCmd = 'cd && mkdir -p ' + _path + ' && cd ' + _path + ' && git clone ' + githubData.repository.clone_url;

    exec(cloneCmd, function ( error/*, sdout, stderr*/ ) {
      if ( error ) {
        return reject(error);
      }

      winston.log('debug', 'Cloned target.');

      resolve(_path);
    });
  });
}

function _runCommands ( target ) {
  return new Promise(function ( resolve ) {
    winston.log('debug', 'Running target commands...');

    if ( !target.commands || target.commands.length < 1 ) {
      winston.log('debug', 'No commands ran.');
      return resolve();
    }

    var _runCmd = function ( ret, command ) {
      return new Promise(function ( resolve, reject ) {
        winston.log('debug', 'Running command:', command);
        exec(command, function ( error, stdout ) {
          if ( error ) {
            return reject(error);
          }

          winston.log('debug', stdout);

          ret.push(command);
          resolve(ret);
        });
      });
    };

    return Promise.reduce(target.commands, _runCmd, []).then(function ( commands ) {
      winston.log('debug', 'Ran', commands.length, 'commands.');
    }).then(resolve);
  });
}

exports.pushed = function ( req, res ) {
  winston.log('debug', 'Got request for push action');

  if ( !req.isXHub ) {
    return res.status(401).send({
      error: 'No data signature provided. Request is not valid.'
    });
  }

  if ( !req.isXHubValid() ) {
    return res.status(401).send({
      error: 'Invalid data signature detected.'
    });
  }

  winston.log('debug', 'Verified data signature.');

  var target = manifest[req.body.repository.name];

  if ( !target ) {
    return res.status(400).send({
      error: 'Unable to find manifest for repo.'
    });
  }

  var __handleError = function ( err ) {
    res.status(500).end();
    winston.error(err);
    throw err;
  };

  var __finish = function () {
    res.status(200).end();
  };

  if ( !target.clone ) {
    __finish();
    _runCommands(target).catch(__handleError);
  } else {

    _cloneTarget(target, req.body).then(function ( /* path */ ) {
      __finish();
      return _runCommands(target);
    }).catch(__handleError);
  }
};
