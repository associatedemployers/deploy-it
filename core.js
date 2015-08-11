/*
  Core Handler
*/

var winston = require('winston');

var Promise = require('bluebird'),
    crypto = require('crypto');

var exec = require('child_process').exec,
    manifest = require('./config/manifest'),
    settings = require('./config/server'),
    githubSecret = settings.githubSecret;

function _verifyIntegrity ( body, signature ) {
  return new Promise(function ( resolve, reject ) {
    if ( !signature || !body ) {
      return reject('No data signature provided. Request is not valid.');
    }

    var textBody = JSON.stringify(body);
    var hash = crypto.createHmac('sha1', githubSecret).update(textBody).digest('hex');

    if ( hash === signature ) {
      return resolve();
    } else {
      return reject('Invalid data signature detected.');
    }
  });
}

function _cloneTarget ( target, githubData ) {
  return new Promise(function ( resolve, reject ) {
    winston.log('debug', 'Cloning target...');

    const _path = target.clonePath || settings.defaultClonePath;
    var cloneCmd = 'cd && mkdir -p ' + _path + ' && cd ' + _path + ' && git clone ' + githubData.respository.clone_url;

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
        exec(command, function ( error ) {
          if ( error ) {
            return reject(error);
          }

          ret.push(command);
          resolve(ret);
        });
      });
    };

    return Promise.reduce(target.commands, _runCmd, []).then(function ( commands ) {
      winston.log('debug', 'Ran', commands.length + 'commands.');
    });
  });
}

exports.pushed = function ( req, res ) {
  winston.log('debug', 'Got request for push action');

  _verifyIntegrity(res.body, req.header('X-Hub-Signature')).then(function () {
    winston.log('debug', 'Verified data signature.');

    var target = manifest[req.body.respository.name];

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
      return _runCommands(target).then(__finish).catch(__handleError);
    } else {
      _cloneTarget(target, req.body).then(function ( /* path */ ) {
        return _runCommands(target);
      }).then(__finish).catch(__handleError);
    }
  }).catch(function ( err ) {
    winston.error(err);
    res.status(401).send({
      error: err
    });
  });
};
