# deploy-it
### The Github-enabled deployment monitoring server

deploy-it is a node-based server that monitors your github repos via webhooks. There are a few steps to get started, but should automate your deployments.

## Prerequisites
- Node.js

## Install it.
You can either start by downloading the latest release from [The Releases Page](https://github.com/associatedemployers/deploy-it/releases), or via git-clone. In this example, we will use git-clone.

Head over to your target server you will be deploying on and open up a terminal. Navigate to a directory where you store your apps. (ex. `/var/servers/`)

Start by cloning the repo
```shell
~ cd /var/www/ && sudo git clone https://github.com/associatedemployers/deploy-it.git
```

## Configure.
You will need to configure your apps and githubSecret.

First change your githubSecret to something no one will know. (`config/server.json#githubSecret`)
```shell
~ cd deploy-it
~ sudo vim config/server.json
  ... Change githubSecret to your chosen password
      :wq
```

Next, configure your apps (found in `config/manifest.json`). The server will do the following when the webhook is hit.
- If `clone` is `true`, deploy-it will clone your repo into the default clone path specified in `config/server.json#defaultClonePath` or your app's `clonePath` if specified.
- If commands are specified, deploy-it will spawn a child process and execute each command. You can do testing, configuring, etc. (anything you can do in bash)

## Boot.
Deploy-it will need to run on a port on your machine. Refer below for an example.

*Note: You can specify `environment=dev` for verbose logging.*

```shell
~ environment=dev port=3111 node index.js
```

## Confirm.
You can now set up webhooks to `http://yourip:PORT/notify-push` with the github push event in Your Repo>Settings>Webhooks. Make sure to specify your githubSecret to make sure github signs your notification.
*Note: Github will send a PING event that will test your implementation right after you save your webhook. Deploy-it responds to this event just the same as a push event, so it's a great way to test your commands.*
