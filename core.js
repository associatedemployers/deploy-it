/*
  Core Handler
*/

var winston = require('winston');

var Promise = require('bluebird');

var exec = require('child_process').exec,
    manifest = require('./config/manifest'),
    settings = require('./config/server'),
    SlackBot = require('slackbots'),
    fs       = require('fs'),
    _        = require('lodash');

if ( !settings.slackbot.disable ) {
  var slackBot = new SlackBot({
    token: settings.slackbot.token,
    name: settings.slackbot.name
  });

  var defaultSlackParams = {
    'icon_url': settings.slackbot.icon
  };
}

function _sendSlackMessage ( text ) {
  if ( settings.slackbot.disable || !slackBot ) {
    return;
  }

  slackBot.postMessageToChannel(settings.slackbot.channel, text, defaultSlackParams);
}

if ( !settings.slackbot.disable && slackBot ) {
  slackBot.on('start', function () {
    winston.debug('Connected to Slack.');
  });

  slackBot.on('message', function ( message ) {
    if ( !message.text || message.type !== 'message' ) {
      return undefined;
    }

    var msg = message.text;

    var matches = /what.*version.*is\s*(.*)(\?.*$)/i.exec(msg);

    if ( !matches || !matches[1] ) {
      return undefined;
    }

    var user = _.find(slackBot.users, { id: message.user }),
        userName = user && user.name ? user.name : 'you',
        originalName = matches[1],
        dasherized = originalName.trim().toLowerCase().replace(/\s/g, '-'),
        repo = manifest[dasherized];

    if ( !repo ) {
      return _sendSlackMessage('@' + userName + ' Yo, I\'m not finding "' + originalName + '" in my list. Sorry. :broken_heart:');
    }

    var unknownVersion = function () {
      _sendSlackMessage(':scream: @' + userName + '... It looks like ' + originalName + ' doesn\'t have a version! ');
    };

    if ( !repo.versionLocation ) {
      return unknownVersion();
    }

    fs.stat(repo.versionLocation, function ( err ) {
      if ( err ) {
        return unknownVersion();
      }

      var versionInfo = JSON.parse(fs.readFileSync(repo.versionLocation));

      if ( !versionInfo.version ) {
        return unknownVersion();
      }

      _sendSlackMessage(':tada: I got it, @' + userName + '. ' + originalName + ' is, on my side, at version: ' + versionInfo.version);
    });
  });
}

function _cloneTarget ( target, githubData ) {
  _sendSlackMessage(':phone::fax::pager::iphone: Hold the phones everyone, I\'m deploying a new version of ' + githubData.repository.name + '. Standby...');

  return new Promise(function ( resolve, reject ) {
    winston.log('debug', 'Cloning target...');

    var _path = target.clonePath || settings.defaultClonePath,
        _cloneUrl = githubData.repository.private ? githubData.repository.ssh_url : githubData.repository.clone_url,
        ref = target.ref ? target.ref.split('/') : target.ref,
        onBranch = ref && ref[ref.length] !== 'master' ? ref[ref.length] : false,
        cloneCmd = 'cd && mkdir -p ' + _path + ' && cd ' + _path + ' && git clone ' + onBranch ? ' -b ' + onBranch + ' --single-branch ' : '' + _cloneUrl;

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

  // Match ref so branches don't update the repo
  if ( target.ref && target.ref !== req.body.ref ) {
    return __finish();
  }

  if ( !target.clone ) {
    __finish();
    _runCommands(target).catch(__handleError);
  } else {
    _cloneTarget(target, req.body).then(function ( /* path */ ) {
      __finish();
      return _runCommands(target).catch(function ( err ) {
        _sendSlackMessage('Something happened while I was deploying ' + req.body.repository.name + '. :broken_heart: I didn\'t deploy the update. I\'m seriously upset. ERROR: ' + JSON.stringify(err));
        throw err;
      });
    }).then(function () {
      _sendSlackMessage(':punch: Fist bump! Just deployed a new version of ' + req.body.repository.name + '.');
    }).catch(__handleError);
  }
};
