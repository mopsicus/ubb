# Unity Builder Bot (UBB)
Telegram bot for build debug Unity projects. 
Bot works with [Unity Builder Helper](https://github.com/mopsicus/unity-builder-helper) (UBH).
Build APK for Google/Huawei and debug IPA for iOS. 
Upload all files on your server and make HTML page and manifest for install APK or IPA from server.

## Features
1. Add project from Git repository
2. Remove project
3. List all projects
4. Checkout project branch
5. Update repository before build
6. Build Unity project
7. Build Xcode project
8. Compile, archive and export to IPA with configurated manifest
9. Generate HTML with install links
10. Upload all objects to remote server via sshpass
11. Get build logs for project
12. Clear project's logs and builds

## Requirements
1. Node.js
2. sshpass
3. The steady hands

## Installation
1. Pull repository
2. Run ```npm install```

## How to use
1. Create new bot via BotFather
2. Get bot token
3. Edit ```.env``` file
5. Add [Unity Builder Helper](https://github.com/mopsicus/unity-builder-helper) to unity project
4. Run bot (i.e. ```pm2``` or ```node index.js```)
5. Get bot ID from console
5. Open UBH via hotkey ```cmd+g``` or menu
6. Paste bot ID 
7. Run build 

## Commands
```/add <repository url>``` Add project to bot

```/remove <project name>``` Remove project

```/checkout <project name> <branch>``` Checkout git branch

```/build <project name> <branch> <platform>``` Build project and upload to host

```/log <project name> <platform> <type>``` Get log file

```/clear <project name>``` Clear builds and logs

```/list``` Request projects list

```/help``` Show commands list

## Options
```BOT_TOKEN``` Telegram bot token

```WHITE_LIST``` List of users separated by comma can send commands to bot. You can get your ID by [@userinfobot](https://t.me/userinfobot)

```PROJECTS_DIR``` Directory for projects

```OUTPUT_DIR``` Directory for builds

```LOGS_DIR``` Directory for logs

```UNITY``` Path to installed Unity, i.e. /Applications/Unity/Hub/Editor/2020.3.35f1/Unity.app/Contents/MacOS/Unity

```BUILD_METHOD``` Method in [Unity Builder Helper](https://github.com/mopsicus/unity-builder-helper). It will build project and support files for bot.

```TIMEOUT``` Timeout for Git and other shell operations

```BUILD_BRANCH``` Default branch to build

```REMOTE_PATH``` Url for downloading builds, i.e. https://mopsicus.ru/builds

```IOS_TEAM``` Your iOS Team ID for signing Xcode project

```SSH_LOGIN``` SSH login

```SSH_PASS``` SSH password

```SSH_HOST``` Host for uploading files

```SSH_PATH``` Path on host for storing files, i.e. ~/domains/mopsicus.ru/builds/

## Roadmap
1. Add WebGL build
2. Add iOS production build
3. Add upload to AppStore