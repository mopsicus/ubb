require('dotenv').config()
require('log-timestamp');
const { Telegraf, Markup } = require('telegraf')
const { promises: { readdir } } = require('fs')
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const path = require('path');
const fs = require('fs');

let bot

const getUser = async (ctx) => {
    return (ctx.update.callback_query) ? ctx.update.callback_query.from.id : ctx.update.message.from.id
}

const checkUser = async (ctx) => {
    let from = (ctx.update.callback_query) ? ctx.update.callback_query.from : ctx.update.message.from
    let result = process.env.WHITE_LIST.split(',').includes(String(from.id))
    if (!result) {
        console.warn(`unknown user ${from}`)
        throw new Error('unknown user')
    }
}

const validateCommand = async (ctx) => {
    let message = (ctx.update.callback_query) ? ctx.update.callback_query.message.text : ctx.update.message.text
    let data = message.split(' ')
    switch (data[0].slice(1)) {
        case 'add':
            if (data.length < 2) {
                throw new Error('repository url is missing')
            }
            if (data.length < 3) {
                throw new Error('branch is missing')
            }
            if (data.length > 3) {
                throw new Error('invalid arguments count')
            }
            if (!data[1].includes('.git')) {
                throw new Error('invalid repository url')
            }
            break;
        case 'remove':
            if (data.length < 2) {
                throw new Error('project name is missing')
            }
            if (data.length > 2) {
                throw new Error('invalid arguments count')
            }
            break;
        case 'checkout':
            if (data.length < 2) {
                throw new Error('project name is missing')
            }
            if (data.length < 3) {
                throw new Error('branch is missing')
            }
            if (data.length > 3) {
                throw new Error('invalid arguments count')
            }
            break;
        case 'clear':
            if (data.length < 2) {
                throw new Error('project name is missing')
            }
            break;
        case 'log':
            if (data.length < 2) {
                throw new Error('project name is missing')
            }
            if (data.length < 3) {
                throw new Error('platform is missing')
            }
            if (data.length < 4) {
                throw new Error('log type is missing')
            }
            if (data.length > 4) {
                throw new Error('invalid arguments count')
            }
            break;
        case 'build':
            if (data.length < 2) {
                throw new Error('project name is missing')
            }
            if (data.length < 3) {
                throw new Error('branch is missing')
            }
            if (data.length < 4) {
                throw new Error('platform is missing')
            }
            if (data.length < 5) {
                throw new Error('defines is missing')
            }
            if (data.length > 5) {
                throw new Error('invalid arguments count')
            }
            break;
        default:
            throw new Error('unknown command')
            break;
    }
    data.shift()
    return data
}

const addProject = async (ctx) => {
    let user = await getUser(ctx)
    try {
        await checkUser(ctx)
        let args = await validateCommand(ctx)
        let url = args[0];
        let branch = args[1];
        let project = url.replace(/^.*[\\\/]/, '').slice(0, -4)
        console.log(`(${user}) add ${project}`)
        let dir = path.join(process.env.PROJECTS_DIR, project);
        await ctx.reply(`[${project}] clone...`)
        console.log(`(${user}) [${project}] clone...`)
        await exec(`git -C ${process.env.PROJECTS_DIR} clone ${url}`, { timeout: Number(process.env.TIMEOUT) })
        await ctx.reply(`[${project}] checkout ${branch}...`)
        console.log(`(${user}) [${project}] checkout ${branch}...`)
        await exec(`git checkout ${branch}`, { cwd: dir })
        await ctx.reply(`[${project}] pull updates...`)
        console.log(`(${user}) [${project}] pull updates...`)
        await exec(`git pull`, { cwd: dir })
        await ctx.reply(`[${project}] use ${project} as project name`)
        await ctx.reply(`[${project}] done ✅`)
        console.log(`(${user}) add ${project} completed`)
    } catch (error) {
        console.error(`(${user}) add failed:`, error)
        await ctx.reply(`error: ${error.message} ❌`)
    }
}

const removeProject = async (ctx) => {
    let user = await getUser(ctx)
    try {
        await checkUser(ctx)
        let args = await validateCommand(ctx)
        let project = args[0];
        console.log(`(${user}) remove ${project}`)
        let dir = path.join(process.env.PROJECTS_DIR, project);
        if (!fs.existsSync(dir)) {
            throw new Error('project not found')
        }
        await ctx.reply(`[${project}] remove...`)
        console.log(`(${user}) [${project}] remove...`)
        await exec(`rm -R ${dir}`)
        await ctx.reply(`[${project}] done ✅`)
        console.log(`(${user}) remove ${project} completed`)
    } catch (error) {
        console.error(`(${user}) remove failed:`, error)
        await ctx.reply(`error: ${error.message} ❌`)
    }
}

const clearProject = async (ctx) => {
    let user = await getUser(ctx)
    try {
        await checkUser(ctx)
        let args = await validateCommand(ctx)
        let project = args[0];
        console.log(`(${user}) clear ${project}`)
        let dir = path.join(process.env.OUTPUT_DIR, project);
        await ctx.reply(`[${project}] clear logs...`)
        console.log(`(${user}) [${project}] clear logs...`)
        await exec(`rm -rf ${project}*.log`, { cwd: process.env.LOGS_DIR, timeout: Number(process.env.TIMEOUT) })
        await ctx.reply(`[${project}] clear builds...`)
        console.log(`(${user}) [${project}] clear builds...`)
        let list = await getConfigs(project)
        for (const item of list) {
            console.log(`(${user}) [${project}] clear items for ${item}...`)
            await exec(`rm -rf ${item}*`, { cwd: process.env.OUTPUT_DIR, timeout: Number(process.env.TIMEOUT) })
        }
        await ctx.reply(`[${project}] done ✅`)
        console.log(`(${user}) clear ${project} completed`)
    } catch (error) {
        console.error(`(${user}) clear failed:`, error)
        await ctx.reply(`error: ${error.message} ❌`)
    }
}

const getConfigs = async (project) => {
    let config
    let data
    let platforms = ['ios', 'google', 'huawei', 'web']
    let list = []
    for (const item of platforms) {
        let file = `${project}.${item}.build.json`
        if (fs.existsSync(path.join(process.env.OUTPUT_DIR, file))) {
            data = await fs.promises.readFile(path.join(process.env.OUTPUT_DIR, file));
            if (data !== undefined) {
                config = JSON.parse(data.toString())
                list.push(config.name)
            }
        }
    }
    return list
}

const checkoutProject = async (ctx) => {
    let user = await getUser(ctx)
    try {
        await checkUser(ctx)
        let args = await validateCommand(ctx)
        let project = args[0];
        let branch = args[1];
        console.log(`(${user}) ${project} checkout ${branch}`)
        let dir = path.join(process.env.PROJECTS_DIR, project);
        await ctx.reply(`[${project}] checkout ${branch}...`)
        if (!fs.existsSync(dir)) {
            throw new Error('project not found')
        }
        await exec(`git checkout ${branch}`, { cwd: dir })
        await ctx.reply(`[${project}] done ✅`)
        console.log(`(${user}) ${project} checkout ${branch} completed`)
    } catch (error) {
        console.error(`(${user}) checkout failed:`, error)
        await ctx.reply(`error: ${error.message} ❌`)
    }
}

const getLog = async (ctx) => {
    let user = await getUser(ctx)
    try {
        await checkUser(ctx)
        let args = await validateCommand(ctx)
        let project = args[0];
        let platform = args[1];
        let type = args[2];
        console.log(`(${user}) get log ${project} ${platform} ${type}`)
        let file = `${process.env.LOGS_DIR}/${project}-${platform}-${type}.log`;
        await ctx.reply(`[${project}] get log ${platform} ${type}...`)
        if (!fs.existsSync(file)) {
            throw new Error('log file not found')
        }
        await ctx.replyWithDocument({ source: file })
        await ctx.reply(`[${project}] done ✅`)
        console.log(`(${user}) get log ${project} ${platform} ${type} completed`)
    } catch (error) {
        console.error(`(${user}) get log:`, error)
        await ctx.reply(`error: ${error.message} ❌`)
    }
}

const listProjects = async (ctx) => {
    let user = await getUser(ctx)
    try {
        await checkUser(ctx)
        console.log(`(${user}) request project list`)
        let list = await readdir(process.env.PROJECTS_DIR, { withFileTypes: true })
        let dirs = list.filter(dirent => dirent.isDirectory()).map(dirent => dirent.name)
        await ctx.reply('[builder] projects list...')
        await ctx.reply(dirs.join('\n'))
        await ctx.reply('[builder] done ✅')
        console.log(`(${user}) request project list completed`)
    } catch (error) {
        console.error(`(${user}) request project list failed:`, error)
        await ctx.reply(`error: ${error.message} ❌`)
    }
}

const buildProject = async (ctx) => {
    let user = await getUser(ctx)
    try {
        await checkUser(ctx)
        let args = await validateCommand(ctx)
        let project = args[0];
        let branch = args[1];
        let platform = args[2]
        let defines = args[3]
        let target = (platform === 'google' || platform === 'huawei') ? 'android' : platform
        let dir = path.join(process.env.PROJECTS_DIR, project);
        let output = path.resolve(process.env.OUTPUT_DIR)
        await ctx.reply(`[${project}] building...`)
        console.log(`(${user}) [${project}] building...`)
        if (!fs.existsSync(dir)) {
            throw new Error('project not found')
        }
        await ctx.reply(`[${project}] checkout ${branch}...`)
        console.log(`(${user}) [${project}] checkout ${branch}...`)
        await exec(`git checkout ${branch}`, { cwd: dir })
        await ctx.reply(`[${project}] restore changes...`)
        console.log(`(${user}) [${project}] restore changes...`)
        await exec(`git restore .`, { cwd: dir })
        await ctx.reply(`[${project}] pull updates...`)
        console.log(`(${user}) [${project}] pull updates...`)
        await exec('git pull', { cwd: dir })
        await ctx.reply(`[${project}] build unity...`)
        console.log(`(${user}) [${project}] build unity...`)
        await exec(`${process.env.UNITY} -batchmode -quit -projectPath ${dir} -executeMethod ${process.env.BUILD_METHOD} -output ${output} -platform ${platform} -project ${project} -defines "${defines}" -buildTarget ${target} -logFile ${process.env.LOGS_DIR}/${project}-${platform}-build.log`)
        let data = await fs.promises.readFile(path.join(output, `${project}.${platform}.build.json`));
        let config = JSON.parse(data.toString())
        if (platform === 'ios') {
            await ctx.reply(`[${project}] build xcode...`)
            console.log(`(${user}) [${project}] build xcode...`)
            dir = path.resolve(process.env.OUTPUT_DIR, config.source);
            output = path.resolve(process.env.OUTPUT_DIR, config.source, 'build');
            if (!fs.existsSync(output)) {
                await exec(`mkdir -p ${output}`)
            }
            let xproject = (fs.existsSync(`${dir}/Unity-iPhone.xcworkspace`)) ? `-workspace ${dir}/Unity-iPhone.xcworkspace` : `-project ${dir}/Unity-iPhone.xcodeproj`
            await exec(`xcodebuild ${xproject} -scheme Unity-iPhone -quiet > ${process.env.LOGS_DIR}/${project}-${platform}-xcode-build.log 2>&1`, { timeout: Number(process.env.TIMEOUT) })
            await ctx.reply(`[${project}] archive xcode...`)
            console.log(`(${user}) [${project}] archive xcode...`)
            await exec(`xcodebuild ${xproject} -scheme Unity-iPhone archive -archivePath ${output}/Unity-iPhone.xcarchive -quiet > ${process.env.LOGS_DIR}/${project}-${platform}-xcode-archive.log 2>&1`, { timeout: Number(process.env.TIMEOUT) })
            await prepareOptions(config, user)
            await ctx.reply(`[${project}] export IPA...`)
            console.log(`(${user}) [${project}] export IPA...`)
            let options = path.resolve(process.env.OUTPUT_DIR, `${config.source}.options.plist`, user)
            await exec(`xcodebuild -exportArchive -archivePath ${output}/Unity-iPhone.xcarchive -exportOptionsPlist ${options} -exportPath ${output} -allowProvisioningUpdates -quiet > ${process.env.LOGS_DIR}/${project}-${platform}-xcode-export.log 2>&1`, { timeout: Number(process.env.TIMEOUT) })
            await ctx.reply(`[${project}] patch manifest...`)
            console.log(`(${user}) [${project}] patch manifest...`)
            await exec(`mv ${output}/*.ipa ${process.env.OUTPUT_DIR}/${config.source}.ipa`, { timeout: Number(process.env.TIMEOUT) })
            await patchManifest(project, config, user)
        }
        await ctx.reply(`[${project}] generate page...`)
        console.log(`(${user}) [${project}] generate page...`)
        await generateHTML(project, platform, config, user)
        await ctx.reply(`[${project}] upload files...`)
        console.log(`(${user}) [${project}] upload files...`)
        let url = await upload(platform, config, user)
        await ctx.reply(`[${project}] ${url}`)
        await ctx.reply(`[${project}] done ✅`)
        console.log(`(${user}) build ${project} completed`)
    } catch (error) {
        console.error(`(${user}) build failed:`, error)
        await ctx.reply(`error: ${error.message} ❌`)
    }
}

const upload = async (platform, config, user) => {
    console.log(`(${user}) upload ${config.name}`)
    let pageFile = `${config.source}.${platform}.html`
    let page = path.resolve(process.env.OUTPUT_DIR, pageFile)
    if (platform === 'ios') {
        let build = path.resolve(process.env.OUTPUT_DIR, `${config.source}.ipa`)
        let manifest = path.resolve(process.env.OUTPUT_DIR, `${config.source}.plist`)
        await exec(`sshpass -p ${process.env.SSH_PASS} scp ${page} ${build} ${manifest} ${process.env.SSH_LOGIN}@${process.env.SSH_HOST}:${process.env.SSH_PATH}`, { timeout: Number(process.env.TIMEOUT) })
    } else {
        let build = path.resolve(process.env.OUTPUT_DIR, `${config.source}.apk`)
        await exec(`sshpass -p ${process.env.SSH_PASS} scp ${page} ${build} ${process.env.SSH_LOGIN}@${process.env.SSH_HOST}:${process.env.SSH_PATH}`, { timeout: Number(process.env.TIMEOUT) })
    }
    console.log(`(${user}) upload ${config.name} completed`)
    return `${process.env.REMOTE_PATH}/${pageFile}`
}

const generateHTML = async (project, platform, config, user) => {
    console.log(`(${user}) generate HTML ${config.name}`)
    let output = path.resolve(process.env.OUTPUT_DIR)
    let data = await fs.promises.readFile(path.resolve('files/template.html'))
    let html = data.toString()
    let url = (platform === 'ios') ? `itms-services://?action=download-manifest&url=${process.env.REMOTE_PATH}/${config.source}.plist` : `${process.env.REMOTE_PATH}/${config.source}.apk`
    html = html.replace(/{TITLE}/g, project)
        .replace('{PLATFORM}', platform)
        .replace('{VERSION}', `${config.version}.${config.code}`)
        .replace('{DATE}', new Date().toLocaleString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit', weekday: "long", hour: '2-digit', hour12: false, minute: '2-digit', second: '2-digit' }))
        .replace('{URL}', url)
    let page = `${config.source}.${platform}.html`
    fs.promises.writeFile(path.join(output, page), html)
    console.log(`(${user}) generate HTML ${config.name} completed`)
}

const prepareOptions = async (config, user) => {
    console.log(`(${user}) prepare options ${config.name}`)
    let output = path.resolve(process.env.OUTPUT_DIR)
    let data = await fs.promises.readFile(path.resolve('files/options.plist'))
    let plist = data.toString()
    plist = plist.replace('{TEAM}', process.env.IOS_TEAM)
    let page = `${config.source}.options.plist`
    fs.promises.writeFile(path.join(output, page), plist)
    console.log(`(${user}) prepare options ${config.name} completed`)
}

const patchManifest = async (project, config, user) => {
    console.log(`(${user}) patch manifest ${config.name}`)
    let output = path.resolve(process.env.OUTPUT_DIR)
    let data = await fs.promises.readFile(path.resolve('files/manifest.plist'))
    let plist = data.toString()
    let url = `${process.env.REMOTE_PATH}/${config.source}.ipa`
    plist = plist.replace('{TITLE}', project)
        .replace('{VERSION}', config.version)
        .replace('{COMPANY}', config.company)
        .replace('{BUNDLE}', config.bundle)
        .replace('{URL}', url)
    let page = `${config.source}.plist`
    fs.promises.writeFile(path.join(output, page), plist)
    console.log(`(${user}) patch manifest ${config.name} completed`)
}

const getHelp = async (ctx) => {
    let user = await getUser(ctx)
    try {
        console.log(`(${user}) get help`)
        let list = await readdir(process.env.PROJECTS_DIR, { withFileTypes: true })
        let dirs = list.filter(dirent => dirent.isDirectory()).map(dirent => dirent.name)
        await ctx.reply('[builder] commands list...')
        await ctx.replyWithHTML('<code>/add git@github.com:username/project.git develop</code>\n add project to bot and checkout branch')
        await ctx.replyWithHTML('<code>/remove project</code>\n remove project')
        await ctx.replyWithHTML('<code>/checkout project develop</code>\n checkout git branch')
        await ctx.replyWithHTML('<code>/build project develop ios|android defines</code>\n build project and upload to host')
        await ctx.replyWithHTML('<code>/log project ios|android build|xcode-build|xcode-archive|xcode-export</code>\n get log files')
        await ctx.replyWithHTML('<code>/clear project</code>\n clear builds and logs')
        await ctx.replyWithHTML('<code>/list</code>\n list all projects in bot')
        await ctx.replyWithHTML('<code>/help</code>\n show this help')
        await ctx.reply('[builder] done ✅')
        console.log(`(${user}) get help completed`)
    } catch (error) {
        console.error(`(${user}) get help failed:`, error)
        await ctx.reply(`error: ${error.message} ❌`)
    }
}

const init = async () => {
    if (process.env.BOT_TOKEN === '') {
        throw new Error('bot token is missing')
    }
    if (process.env.WHITE_LIST === '') {
        throw new Error('white list users is missing')
    }
    if (process.env.PROJECTS_DIR === '') {
        throw new Error('projects directory is missing')
    }
    if (process.env.OUTPUT_DIR === '') {
        throw new Error('output directory is missing')
    }
    if (process.env.LOGS_DIR === '') {
        throw new Error('logs directory is missing')
    }
    if (process.env.UNITY === '') {
        throw new Error('unity path is missing')
    }
    await exec(`mkdir -p ${process.env.PROJECTS_DIR}`)
    await exec(`mkdir -p ${process.env.OUTPUT_DIR}`)
    await exec(`mkdir -p ${process.env.LOGS_DIR}`)
}

const launch = async () => {
    bot = new Telegraf(process.env.BOT_TOKEN, { handlerTimeout: Number(process.env.TIMEOUT) })
    bot.command('add', (ctx) => addProject(ctx))
    bot.command('remove', (ctx) => removeProject(ctx))
    bot.command('list', (ctx) => listProjects(ctx))
    bot.command('checkout', (ctx) => checkoutProject(ctx))
    bot.command('build', (ctx) => buildProject(ctx))
    bot.command('clear', (ctx) => clearProject(ctx))
    bot.command('log', (ctx) => getLog(ctx))
    bot.action('build', (ctx) => buildProject(ctx))
    bot.help((ctx) => getHelp(ctx))
    bot.catch(err => console.error('ACHTUNG', err))
    await bot.launch()
    process.once('SIGINT', () => bot.stop('SIGINT'))
    process.once('SIGTERM', () => bot.stop('SIGTERM'))
}

const start = async () => {
    try {
        await init();
        await launch();
        console.log(`UBB started`)
    } catch (error) {
        console.error(`start failed:`, error)
    }
}

start()


