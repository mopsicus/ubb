require('dotenv').config()
require('log-timestamp');
const { Telegraf } = require('telegraf')
const { promises: { readdir } } = require('fs')
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const path = require('path');
const fs = require('fs');

let bot

const checkUser = async (ctx) => {
    let result = process.env.WHITE_LIST.split(',').includes(String(ctx.update.message.from.id))
    if (!result) {
        console.warn(`unknown user ${ctx.update.message.from}`)
        throw new Error('unknown user')
    }
}

const validateCommand = async (text) => {
    let data = text.split(' ')
    switch (data[0].slice(1)) {
        case 'add':
            if (data.length < 2) {
                throw new Error('repository url is missing')
            }
            if (data.length > 2) {
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
            if (data.length > 4) {
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
    try {
        await checkUser(ctx)
        let args = await validateCommand(ctx.update.message.text)
        let url = args[0];
        let project = url.replace(/^.*[\\\/]/, '').slice(0, -4)
        console.log(`(${ctx.update.message.from.id}) add ${project}`)
        let dir = path.join(process.env.PROJECTS_DIR, project);
        await ctx.reply(`[${project}] clone...`)
        await exec(`git -C ${process.env.PROJECTS_DIR} clone ${url}`, { timeout: Number(process.env.TIMEOUT) })
        await ctx.reply(`[${project}] checkout to build branch...`)
        await exec(`git checkout ${process.env.BUILD_BRANCH}`, { cwd: dir })
        await ctx.reply(`[${project}] clone core...`)
        await exec(`git clone ${process.env.CORE} Assets/Core`, { cwd: dir, timeout: Number(process.env.TIMEOUT) })
        await ctx.reply(`[${project}] use ${project} as project name`)
        await ctx.reply(`[${project}] done ✅`)
        console.log(`(${ctx.update.message.from.id}) add ${project} completed`)
    } catch (error) {
        console.error(`(${ctx.update.message.from.id}) add failed:`, error)
        await ctx.reply(`error: ${error.message} ❌`)
    }
}

const removeProject = async (ctx) => {
    try {
        await checkUser(ctx)
        let args = await validateCommand(ctx.update.message.text)
        let project = args[0];
        console.log(`(${ctx.update.message.from.id}) remove ${project}`)
        let dir = path.join(process.env.PROJECTS_DIR, project);
        await ctx.reply(`[${project}] remove...`)
        await exec(`rm -R ${dir}`)
        await ctx.reply(`[${project}] done ✅`)
        console.log(`(${ctx.update.message.from.id}) remove ${project} completed`)
    } catch (error) {
        console.error(`(${ctx.update.message.from.id}) remove failed:`, error)
        await ctx.reply(`error: ${error.message} ❌`)
    }
}

const clearProject = async (ctx) => {
    try {
        await checkUser(ctx)
        let args = await validateCommand(ctx.update.message.text)
        let project = args[0];
        console.log(`(${ctx.update.message.from.id}) clear ${project}`)
        let dir = path.join(process.env.OUTPUT_DIR, project);
        await ctx.reply(`[${project}] clear logs...`)
        await exec(`rm -rf ${project}*.log`, { cwd: process.env.LOGS_DIR, timeout: Number(process.env.TIMEOUT) })
        await ctx.reply(`[${project}] clear builds...`)
        let list = await getConfigs(project)
        for (const item of list) {
            await exec(`rm -rf ${item}*`, { cwd: process.env.OUTPUT_DIR, timeout: Number(process.env.TIMEOUT) })
        }
        await ctx.reply(`[${project}] done ✅`)
        console.log(`(${ctx.update.message.from.id}) clear ${project} completed`)
    } catch (error) {
        console.error(`(${ctx.update.message.from.id}) clear failed:`, error)
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
    try {
        await checkUser(ctx)
        let args = await validateCommand(ctx.update.message.text)
        let project = args[0];
        let branch = args[1];
        console.log(`(${ctx.update.message.from.id}) checkout ${project} to ${branch}`)
        let dir = path.join(process.env.PROJECTS_DIR, project);
        await ctx.reply(`[${project}] checkout to ${branch}...`)
        if (!fs.existsSync(dir)) {
            throw new Error('project not found')
        }
        await exec(`git checkout ${branch}`, { cwd: dir })
        await ctx.reply(`[${project}] done ✅`)
        console.log(`(${ctx.update.message.from.id}) checkout ${project} to ${branch} completed`)
    } catch (error) {
        console.error(`(${ctx.update.message.from.id}) checkout failed:`, error)
        await ctx.reply(`error: ${error.message} ❌`)
    }
}

const getLog = async (ctx) => {
    try {
        await checkUser(ctx)
        let args = await validateCommand(ctx.update.message.text)
        let project = args[0];
        let platform = args[1];
        let type = args[2];
        console.log(`(${ctx.update.message.from.id}) get log ${project} ${platform} ${type}`)
        let file = `${process.env.LOGS_DIR}/${project}-${platform}-${type}.log`;
        await ctx.reply(`[${project}] get log ${platform} ${type}...`)
        if (!fs.existsSync(file)) {
            throw new Error('log file not found')
        }
        await ctx.replyWithDocument({ source: file })
        await ctx.reply(`[${project}] done ✅`)
        console.log(`(${ctx.update.message.from.id}) get log ${project} ${platform} ${type} completed`)
    } catch (error) {
        console.error(`(${ctx.update.message.from.id}) get log:`, error)
        await ctx.reply(`error: ${error.message} ❌`)
    }
}

const listProjects = async (ctx) => {
    try {
        await checkUser(ctx)
        console.log(`(${ctx.update.message.from.id}) request project list`)
        let list = await readdir(process.env.PROJECTS_DIR, { withFileTypes: true })
        let dirs = list.filter(dirent => dirent.isDirectory()).map(dirent => dirent.name)
        await ctx.reply('[builder] projects list...')
        await ctx.reply(dirs.join('\n'))
        await ctx.reply('[builder] done ✅')
        console.log(`(${ctx.update.message.from.id}) request project list completed`)
    } catch (error) {
        console.error(`(${ctx.update.message.from.id}) request project list failed:`, error)
        await ctx.reply(`error: ${error.message} ❌`)
    }
}

const buildProject = async (ctx) => {
    try {
        await checkUser(ctx)
        let args = await validateCommand(ctx.update.message.text)
        let project = args[0];
        let branch = args[1];
        let platform = args[2]
        let target = (platform === 'google' || platform === 'huawei') ? 'android' : platform
        let dir = path.join(process.env.PROJECTS_DIR, project);
        let output = path.resolve(process.env.OUTPUT_DIR)
        console.log(`(${ctx.update.message.from.id}) build ${project}`)
        await ctx.reply(`[${project}] building...`)
        if (!fs.existsSync(dir)) {
            throw new Error('project not found')
        }
        await ctx.reply(`[${project}] checkout to ${branch}...`)
        await exec(`git checkout ${branch}`, { cwd: dir })
        await ctx.reply(`[${project}] pull updates...`)
        await exec('git pull', { cwd: dir })
        await ctx.reply(`[${project}] build unity...`)
        await exec(`${process.env.UNITY} -batchmode -quit -projectPath ${dir} -executeMethod ${process.env.BUILD_METHOD} -output ${output} -platform ${platform} -project ${project} -buildTarget ${target} -logFile ${process.env.LOGS_DIR}/${project}-${platform}-build.log`)
        let data = await fs.promises.readFile(path.join(output, `${project}.${platform}.build.json`));
        let config = JSON.parse(data.toString())
        if (platform === 'ios') {
            await ctx.reply(`[${project}] build xcode...`)
            dir = path.resolve(process.env.OUTPUT_DIR, config.source);
            output = path.resolve(process.env.OUTPUT_DIR, config.source, 'build');
            if (!fs.existsSync(output)) {
                await exec(`mkdir -p ${output}`)
            }
            let xproject = (fs.existsSync(`${dir}/Unity-iPhone.xcworkspace`)) ? `-workspace ${dir}/Unity-iPhone.xcworkspace` : `-project ${dir}/Unity-iPhone.xcodeproj`
            await exec(`xcodebuild ${xproject} -scheme Unity-iPhone -quiet > ${process.env.LOGS_DIR}/${project}-${platform}-xcode-build.log 2>&1`, { timeout: Number(process.env.TIMEOUT) })
            await ctx.reply(`[${project}] archive xcode...`)
            await exec(`xcodebuild ${xproject} -scheme Unity-iPhone archive -archivePath ${output}/Unity-iPhone.xcarchive -quiet > ${process.env.LOGS_DIR}/${project}-${platform}-xcode-archive.log 2>&1`, { timeout: Number(process.env.TIMEOUT) })
            await prepareOptions(config, ctx.update.message.from.id)
            await ctx.reply(`[${project}] export IPA...`)
            let options = path.resolve(process.env.OUTPUT_DIR, `${config.source}.options.plist`, ctx.update.message.from.id)
            await exec(`xcodebuild -exportArchive -archivePath ${output}/Unity-iPhone.xcarchive -exportOptionsPlist ${options} -exportPath ${output} -allowProvisioningUpdates -quiet > ${process.env.LOGS_DIR}/${project}-${platform}-xcode-export.log 2>&1`, { timeout: Number(process.env.TIMEOUT) })
            await ctx.reply(`[${project}] patch manifest...`)
            await exec(`mv ${output}/*.ipa ${process.env.OUTPUT_DIR}/${config.source}.ipa`, { timeout: Number(process.env.TIMEOUT) })
            await patchManifest(project, config, ctx.update.message.from.id)
        }
        await ctx.reply(`[${project}] generate page...`)
        await generateHTML(project, platform, config, ctx.update.message.from.id)
        await ctx.reply(`[${project}] upload files...`)
        let url = await upload(platform, config, ctx.update.message.from.id)
        await ctx.reply(`[${project}] ${url}`)
        await ctx.reply(`[${project}] done ✅`)
        console.log(`(${ctx.update.message.from.id}) build ${project} completed`)
    } catch (error) {
        console.error(`(${ctx.update.message.from.id}) build failed:`, error)
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
    try {
        console.log(`(${ctx.update.message.from.id}) get help`)
        let list = await readdir(process.env.PROJECTS_DIR, { withFileTypes: true })
        let dirs = list.filter(dirent => dirent.isDirectory()).map(dirent => dirent.name)
        await ctx.reply('[builder] commands list...')
        await ctx.replyWithHTML('<code>/add git@github.com:username/project.git</code>\n add project to bot')
        await ctx.replyWithHTML('<code>/remove project</code>\n remove project')
        await ctx.replyWithHTML('<code>/checkout project build</code>\n checkout git branch')
        await ctx.replyWithHTML('<code>/build project build ios|android</code>\n build project and upload to host')
        await ctx.replyWithHTML('<code>/log project ios|android build|xcode-build|xcode-archive|xcode-export</code>\n get log file')
        await ctx.replyWithHTML('<code>/clear project</code>\n clear builds and logs')
        await ctx.replyWithHTML('<code>/list</code>\n list all projects in bot')
        await ctx.reply('[builder] done ✅')
        console.log(`(${ctx.update.message.from.id}) get help completed`)
    } catch (error) {
        console.error(`(${ctx.update.message.from.id}) get help failed:`, error)
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
        console.log(`bot ${bot.botInfo.id} started`)
    } catch (error) {
        console.error(`start failed:`, error.message)
    }
}

start()


