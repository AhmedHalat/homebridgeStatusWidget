// Check the readme at https://github.com/lwitzani/homebridgeStatusWidget and also for updates!


// Welcome! This script shows basic infos about your Homebridge installation
// All infos shown are based and provided by the Homebridge Config UI X found at https://github.com/oznu/homebridge-config-ui-x
// This script does not work if you don't have the Homebridge service (Homebridge Config UI X) running
// This script was developed with Homebridge Config UI X in version 4.32.0 (2020-11-06), Homebridge at version 1.1.6 and Scriptable app in version 1.6.1 on iOS 14.2
// Maybe you need to update the UI-service OR Homebridge OR the Scriptable app OR your iPhone if this script does not work for you

// CONFIGURATION //////////////////////
// you must at least configure the next 3 lines to make this script work or use credentials in parameter when setting up the widget (see the readme on github)
let hbServiceMachineBaseUrl = '>enter the ip with the port here<'; // location of your system running the hb-service, e.g. http://192.168.178.33:8581
let userName = '>enter username here<'; // username of administrator of the hb-service
let password = '>enter password here<'; // password of administrator of the hb-service

const notificationEnabled = true; // set to false to disable all notifications
const notificationIntervalInDays = 1; // minimum amount of days between the notification about the same topic; 0 means notification everytime the script is run (SPAM). 1 means you get 1 message per status category per day (maximum of 4 messages per day since there are 4 categories). Can also be something like 0.5 which means in a day you can get up to 8 messages
const disableStateBackToNormalNotifications = true; // set to false, if you want to be notified e.g. when Homebridge is running again after it stopped
const systemGuiName = 'Raspberry Pi'; // name of the system your service is running on
const fileManagerMode = 'ICLOUD'; // default is ICLOUD. If you don't use iCloud Drive use option LOCAL
const temperatureUnitConfig = 'CELSIUS'; // options are CELSIUS or FAHRENHEIT
const requestTimeoutInterval = 2; // in seconds; If requests take longer, the script is stopped. Increase it if it doesn't work or you
const pluginsOrSwUpdatesToIgnore = []; // a string array; enter the exact npm-plugin-names e.g. 'homebridge-fritz' or additionally 'HOMEBRIDGE_UTD' or 'NODEJS_UTD' if you do not want to have them checked for their latest versions

const bgColorMode = 'PURPLE'; // default is PURPLE. Other options: BLACK or BLUE_TO_RED
const failIcon = '❌';
const bulletPointIcon = '🔸';
const decimalChar = ','; // if you like a dot as decimal separator make the comma to a dot here
const maxLineWidth = 310; // if layout doesn't look good for you,
const normalLineHeight = 35; // try to tweak the (font-)sizes & remove/add spaces below
// CONFIGURATION END //////////////////////

const authUrl = () => hbServiceMachineBaseUrl + '/api/auth/login';
const cpuUrl = () => hbServiceMachineBaseUrl + '/api/status/cpu';
const hbStatusUrl = () => hbServiceMachineBaseUrl + '/api/status/homebridge';
const ramUrl = () => hbServiceMachineBaseUrl + '/api/status/ram';
const uptimeUrl = () => hbServiceMachineBaseUrl + '/api/status/uptime';
const pluginsUrl = () => hbServiceMachineBaseUrl + '/api/plugins';
const hbVersionUrl = () => hbServiceMachineBaseUrl + '/api/status/homebridge-version';
const nodeJsUrl = () => hbServiceMachineBaseUrl + '/api/status/nodejs';
// logo is downloaded only the first time! It is saved in iCloud and then loaded from there everytime afterwards
const logoUrl = 'https://github.com/homebridge/branding/blob/master/logos/homebridge-silhouette-round-white.png?raw=true';

const timeFormatter = new DateFormatter();
timeFormatter.dateFormat = 'dd.MM.yyyy HH:mm:ss';
const headerFont = Font.boldMonospacedSystemFont(12);
const infoFont = Font.systemFont(10);
const chartAxisFont = Font.systemFont(7);
const updatedAtFont = Font.systemFont(7);
const fontColorWhite = new Color('FFFFFF');
const bgColorPurple = new Color('#421367');
const bgColorBrighterPurple = new Color('#481367');
const purpleBgGradient = new LinearGradient();
purpleBgGradient.locations = [0, 1];
purpleBgGradient.colors = [bgColorPurple, bgColorBrighterPurple];
const blackBgGradient = new LinearGradient();
blackBgGradient.locations = [0, 1];
blackBgGradient.colors = [new Color('111111'), new Color('222222')];
const blueToRedBgGradient = new LinearGradient();
blueToRedBgGradient.locations = [0, 1];
blueToRedBgGradient.colors = [new Color('3e00fa'), new Color('7a04d4')];

const chartColor = new Color('#FFFFFF');
const UNAVAILABLE = 'UNAVAILABLE';

const NOTIFICATION_JSON_VERSION = 1; // never change this!
const NOTIFICATION_JSON_FILE_NAME = 'notificationState.json'; // never change this!
const HB_LOGO_FILE_NAME = 'hbLogo.png'; // never change this!

class LineChart {
    // LineChart by https://kevinkub.de/
    // taken from https://gist.github.com/kevinkub/b74f9c16f050576ae760a7730c19b8e2
    constructor(width, height, values) {
        this.ctx = new DrawContext();
        this.ctx.size = new Size(width, height);
        this.values = values;
    }

    _calculatePath() {
        let maxValue = Math.max(...this.values);
        let minValue = Math.min(...this.values);
        let difference = maxValue - minValue;
        let count = this.values.length;
        let step = this.ctx.size.width / (count - 1);
        let points = this.values.map((current, index, all) => {
            let x = step * index;
            let y = this.ctx.size.height - (current - minValue) / difference * this.ctx.size.height;
            return new Point(x, y);
        });
        return this._getSmoothPath(points);
    }

    _getSmoothPath(points) {
        let path = new Path();
        path.move(new Point(0, this.ctx.size.height));
        path.addLine(points[0]);
        for (let i = 0; i < points.length - 1; i++) {
            let xAvg = (points[i].x + points[i + 1].x) / 2;
            let yAvg = (points[i].y + points[i + 1].y) / 2;
            let avg = new Point(xAvg, yAvg);
            let cp1 = new Point((xAvg + points[i].x) / 2, points[i].y);
            let next = new Point(points[i + 1].x, points[i + 1].y);
            let cp2 = new Point((xAvg + points[i + 1].x) / 2, points[i + 1].y);
            path.addQuadCurve(avg, cp1);
            path.addQuadCurve(next, cp2);
        }
        path.addLine(new Point(this.ctx.size.width, this.ctx.size.height));
        path.closeSubpath();
        return path;
    }

    configure(fn) {
        let path = this._calculatePath();
        if (fn) {
            fn(this.ctx, path);
        } else {
            this.ctx.addPath(path);
            this.ctx.fillPath(path);
        }
        return this.ctx;
    }
}

// WIDGET INIT //////////////////////
let widget = await createWidget();
if (!config.runsInWidget) {
    await widget.presentMedium();
}

Script.setWidget(widget);
Script.complete();

// WIDGET INIT END //////////////////////


async function createWidget() {
    // fileManagerMode must be LOCAL if you do not use iCloud drive
    let fm = fileManagerMode === 'LOCAL' ? FileManager.local() : FileManager.iCloud();
    if (args.widgetParameter) {
// you can provide the credentials via input parameter when setting up the widget
// credentials must be separated by two commas like <username>,,<password>,,<hbServiceMachineBaseUrl>
// a valid real example: admin,,mypassword123,,http://192.168.178.33:8581
// this is useful if you update this script via https://scriptdu.de
        let successFullySet = useCredentialsFromWidgetParameter(args.widgetParameter);
        if (!successFullySet) {
            throw('Format of provided credentials parameter seems not valid\nValid example:\nadmin,,mypassword123,,http://192.168.178.33:8581');
        }
    }
    // authenticate against the hb-service
    let token = await getAuthToken();
    if (token === undefined) {
        throw('Credentials not valid');
    }
    let widget = new ListWidget();
    // Widget background color
    if (bgColorMode === 'BLACK') {
        widget.backgroundGradient = blackBgGradient;
    } else if (bgColorMode === 'BLUE_TO_RED') {
        widget.backgroundGradient = blueToRedBgGradient;
    } else {
        widget.backgroundGradient = purpleBgGradient;
    }

    if (token !== UNAVAILABLE) {
        widget.addSpacer(10);
    }

    // LOGO AND HEADER //////////////////////
    let titleStack = widget.addStack();
    titleStack.size = new Size(maxLineWidth, normalLineHeight);
    const logo = await getHbLogo(fm);
    const imgWidget = titleStack.addImage(logo);
    imgWidget.imageSize = new Size(40, 30);

    let headerText = titleStack.addText(' Homebridge ');
    headerText.font = headerFont;
    headerText.size = new Size(60, normalLineHeight);
    headerText.textColor = fontColorWhite;
    // LOGO AND HEADER END //////////////////////


    if (token === UNAVAILABLE) {
        // script ends after the next line
        return addNotAvailableInfos(widget, titleStack);
    }

    // fetch all the data necessary
    let hbStatus = await getHomebridgeStatus(token);
    let hbUpToDate = await getHomebridgeUpToDate(token);
    let pluginsUpToDate = await getPluginsUpToDate(token);
    let nodeJsUpToDate = await getNodeJsUpToDate(token);
    let cpuData = await fetchData(token, cpuUrl());
    let ramData = await fetchData(token, ramUrl());
    let usedRamText = await getUsedRamString(ramData);
    let uptimesArray = await getUptimesArray(token);

    // STATUS PANEL IN THE HEADER ///////////////////
    let statusInfo = titleStack.addStack();
    statusInfo.layoutVertically();

    let firstLine = statusInfo.addStack();
    firstLine.addSpacer(15);
    addStatusInfo(firstLine, hbStatus, 'Running');
    firstLine.addSpacer(30);
    addStatusInfo(firstLine, hbUpToDate, 'UTD');
    statusInfo.addSpacer(5); // space between the lines

    let secondLine = statusInfo.addStack();
    secondLine.addSpacer(15);
    addStatusInfo(secondLine, pluginsUpToDate, 'Plugins UTD');
    secondLine.addSpacer(9);

    addStatusInfo(secondLine, nodeJsUpToDate, 'Node.js UTD');
    // STATUS PANEL IN THE HEADER END ////////////////

    widget.addSpacer(10);

    if (cpuData && ramData) {
        let mainColumns = widget.addStack();
        mainColumns.size = new Size(maxLineWidth, 70);
        mainColumns.addSpacer(1);

        // FIRST COLUMN //////////////////////
        let firstColumn = mainColumns.addStack();
        firstColumn.layoutVertically();
        let cpuLoadTitle = firstColumn.addText('CPU Load: ' + getAsRoundedString(cpuData.currentLoad, 1) + '%');
        cpuLoadTitle.font = infoFont;
        cpuLoadTitle.textColor = fontColorWhite;

        let cpuChartStack = firstColumn.addStack();
        cpuChartStack.addSpacer(5);
        let minMaxCpuLoadTextStack = cpuChartStack.addStack();
        minMaxCpuLoadTextStack.layoutVertically();

        let maxCpuText = minMaxCpuLoadTextStack.addText(getMaxString(cpuData.cpuLoadHistory, 2) + '%');
        maxCpuText.font = chartAxisFont;
        maxCpuText.textColor = fontColorWhite;
        minMaxCpuLoadTextStack.addSpacer(6);
        let minCpuText = minMaxCpuLoadTextStack.addText(getMinString(cpuData.cpuLoadHistory, 2) + '%');
        minCpuText.font = chartAxisFont;
        minCpuText.textColor = fontColorWhite;
        minMaxCpuLoadTextStack.addSpacer(6);

        cpuChartStack.addSpacer(2);

        let cpuLoadChart = new LineChart(500, 100, cpuData.cpuLoadHistory).configure((ctx, path) => {
            ctx.opaque = false;
            ctx.setFillColor(chartColor);
            ctx.addPath(path);
            ctx.fillPath(path);
        }).getImage();
        let cpuLoadChartImage = cpuChartStack.addImage(cpuLoadChart);
        cpuLoadChartImage.imageSize = new Size(100, 25);

        firstColumn.addSpacer(2);

        let temperatureString = getTemperatureString(cpuData?.cpuTemperature.main);
        if (temperatureString !== 'unknown') {
            let cpuTempText = firstColumn.addText('CPU Temp: ' + temperatureString);
            cpuTempText.font = infoFont;
            cpuTempText.size = new Size(150, 30);
            cpuTempText.textColor = fontColorWhite;
        }
        // FIRST COLUMN END //////////////////////

        mainColumns.addSpacer(15);

        // SECOND COLUMN //////////////////////
        let secondColumn = mainColumns.addStack();
        secondColumn.layoutVertically();
        let ramUsageTitle = secondColumn.addText('RAM Usage: ' + usedRamText + '%');
        ramUsageTitle.font = infoFont;
        ramUsageTitle.textColor = fontColorWhite;

        let ramChartStack = secondColumn.addStack();
        ramChartStack.addSpacer(5);
        let minMaxRamUsageTextStack = ramChartStack.addStack();
        minMaxRamUsageTextStack.layoutVertically();

        let maxRamText = minMaxRamUsageTextStack.addText(getMaxString(ramData.memoryUsageHistory, 2) + '%');
        maxRamText.font = chartAxisFont;
        maxRamText.textColor = fontColorWhite;
        minMaxRamUsageTextStack.addSpacer(6);
        let minRamText = minMaxRamUsageTextStack.addText(getMinString(ramData.memoryUsageHistory, 2) + '%');
        minRamText.font = chartAxisFont;
        minRamText.textColor = fontColorWhite;
        minMaxRamUsageTextStack.addSpacer(6);

        ramChartStack.addSpacer(2);

        let ramUsageChart = new LineChart(500, 100, ramData.memoryUsageHistory).configure((ctx, path) => {
            ctx.opaque = false;
            ctx.setFillColor(chartColor);
            ctx.addPath(path);
            ctx.fillPath(path);
        }).getImage();
        let ramUsageChartImage = ramChartStack.addImage(ramUsageChart);
        ramUsageChartImage.imageSize = new Size(100, 25);

        secondColumn.addSpacer(2);

        if (uptimesArray) {
            let uptimesStack = secondColumn.addStack();

            let upStack = uptimesStack.addStack();
            let uptimesTitleText = upStack.addText('Uptimes:');
            uptimesTitleText.font = infoFont;
            uptimesTitleText.textColor = fontColorWhite;

            let vertPointsStack = upStack.addStack();
            vertPointsStack.layoutVertically();
            let firstBullet = vertPointsStack.addText(bulletPointIcon + systemGuiName + ': ' + uptimesArray[0]);
            firstBullet.font = infoFont;
            firstBullet.textColor = fontColorWhite;

            let secondBullet = vertPointsStack.addText(bulletPointIcon + 'UI-Service: ' + uptimesArray[1]);
            secondBullet.font = infoFont;
            secondBullet.textColor = fontColorWhite;
        }
        // SECOND COLUMN END//////////////////////

        widget.addSpacer(10);

        // BOTTOM UPDATED TEXT //////////////////////
        let updatedAt = widget.addText('Updated: ' + timeFormatter.string(new Date()));
        updatedAt.font = updatedAtFont;
        updatedAt.textColor = fontColorWhite;
        updatedAt.centerAlignText();
        // BOTTOM UPDATED TEXT END //////////////////

        if (notificationEnabled) {
            handleNotifications(fm, hbStatus, hbUpToDate, pluginsUpToDate, nodeJsUpToDate);
        }
        return widget;
    }
}

function useCredentialsFromWidgetParameter(givenParameter) {
    if (givenParameter.includes(',,')) {
        let credentials = givenParameter.split(',,');
        if (credentials.length === 3 && credentials[0].length > 0 && credentials[1].length > 0 &&
            credentials[2].length > 0 && credentials[2].startsWith('http')) {
            userName = credentials[0].trim();
            password = credentials[1].trim();
            hbServiceMachineBaseUrl = credentials[2].trim();
            return true;
        }
    }
    return false;
}

async function getAuthToken() {
    let req = new Request(authUrl());
    req.timeoutInterval = requestTimeoutInterval;
    let body = {
        'username': userName,
        'password': password,
        'otp': 'string'
    };
    let headers = {
        'accept': '*\/*', 'Content-Type': 'application/json'
    };
    req.body = JSON.stringify(body);
    req.method = 'POST';
    req.headers = headers;
    let authData;
    try {
        authData = await req.loadJSON();
    } catch (e) {
        return UNAVAILABLE;
    }
    return authData.access_token;
}

async function fetchData(token, url) {
    let req = new Request(url);
    req.timeoutInterval = requestTimeoutInterval;
    let headers = {
        'accept': '*\/*', 'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
    };
    req.headers = headers;
    let result;
    try {
        result = req.loadJSON();
    } catch (e) {
        return undefined;
    }
    return result;
}

async function getHomebridgeStatus(token) {
    const statusData = await fetchData(token, hbStatusUrl());
    if (statusData === undefined) {
        return undefined;
    }
    return statusData.status === 'up';
}

async function getHomebridgeUpToDate(token) {
    if (pluginsOrSwUpdatesToIgnore.includes('HOMEBRIDGE_UTD')) {
        log('You configured Homebridge to not be checked for updates. Widget will show that it\'s UTD!');
        return true;
    }
    const hbVersionData = await fetchData(token, hbVersionUrl());
    if (hbVersionData === undefined) {
        return undefined;
    }
    return !hbVersionData.updateAvailable;
}

async function getNodeJsUpToDate(token) {
    if (pluginsOrSwUpdatesToIgnore.includes('NODEJS_UTD')) {
        log('You configured Node.js to not be checked for updates. Widget will show that it\'s UTD!');
        return true;
    }
    const nodeJsData = await fetchData(token, nodeJsUrl());
    if (nodeJsData === undefined) {
        return undefined;
    }
    return !nodeJsData.updateAvailable;
}

async function getPluginsUpToDate(token) {
    const pluginsData = await fetchData(token, pluginsUrl());
    if (pluginsData === undefined) {
        return undefined;
    }
    for (plugin of pluginsData) {
        if (pluginsOrSwUpdatesToIgnore.includes(plugin.name)) {
            log('You configured ' + plugin.name + ' to not be checked for updates. Widget will show that it\'s UTD!');
            continue;
        }
        if (plugin.updateAvailable) {
            return false;
        }
    }
    return true;
}

async function getUsedRamString(ramData) {
    if (ramData === undefined) return 'unknown';
    return getAsRoundedString(100 - 100 * ramData.mem.available / ramData.mem.total, 2);
}

async function getUptimesArray(token) {
    const uptimeData = await fetchData(token, uptimeUrl());
    if (uptimeData === undefined) return undefined;

    return [formatSeconds(uptimeData.time.uptime), formatSeconds(uptimeData.processUptime)];
}

function formatSeconds(value) {
    if (value > 60 * 60 * 24) {
        return getAsRoundedString(value / 60 / 60 / 24, 1) + 'd';
    } else if (value > 60 * 60) {
        return getAsRoundedString(value / 60 / 60, 1) + 'h';
    } else if (value > 60) {
        return getAsRoundedString(value / 60, 1) + 'm';
    } else {
        return getAsRoundedString(value, 1) + 's';
    }
}

async function loadImage(imgUrl) {
    let req = new Request(imgUrl);
    req.timeoutInterval = requestTimeoutInterval;
    let image = await req.loadImage();
    return image;
}

async function getHbLogo(fm) {
    let path = getFilePath(HB_LOGO_FILE_NAME, fm);
    if (fm.fileExists(path)) {
        return fm.readImage(path);
    } else {
        // logo did not exist -> download it and save it for next time the widget runs
        const logo = await loadImage(logoUrl);
        fm.writeImage(path, logo);
        return logo;
    }
}

function getFilePath(fileName, fm) {
    let dirPath = fm.joinPath(fm.documentsDirectory(), 'homebridgeStatus');
    if (!fm.fileExists(dirPath)) {
        fm.createDirectory(dirPath);
    }
    return fm.joinPath(dirPath, fileName);
}

function addNotAvailableInfos(widget, titleStack) {
    let statusInfo = titleStack.addText('                                                 ');
    statusInfo.textColor = fontColorWhite;
    statusInfo.size = new Size(150, normalLineHeight);
    let errorText = widget.addText('   ' + failIcon + ' UI-Service not reachable!\n          👉🏻 Server started?\n          👉🏻 UI-Service process started?\n          👉🏻 Server-URL ' + hbServiceMachineBaseUrl + ' correct?\n          👉🏻 Are you in the same network?');
    errorText.size = new Size(410, 130);
    errorText.font = infoFont;
    errorText.textColor = fontColorWhite;


    widget.addSpacer(15);
    let updatedAt = widget.addText('Updated: ' + timeFormatter.string(new Date()));
    updatedAt.font = updatedAtFont;
    updatedAt.textColor = fontColorWhite;
    updatedAt.centerAlignText();

    return widget;
}

function getAsRoundedString(value, decimals) {
    let factor = Math.pow(10, decimals);
    return (Math.round((value + Number.EPSILON) * factor) / factor).toString().replace('.', decimalChar);
}

function getMaxString(arrayOfNumbers, decimals) {
    let factor = Math.pow(10, decimals);
    return (Math.round((Math.max(...arrayOfNumbers) + Number.EPSILON) * factor) / factor).toString().replace('.', decimalChar);
}

function getMinString(arrayOfNumbers, decimals) {
    let factor = Math.pow(10, decimals);
    return (Math.round((Math.min(...arrayOfNumbers) + Number.EPSILON) * factor) / factor).toString().replace('.', decimalChar);
}

function getTemperatureString(temperatureInCelsius) {
    if (temperatureInCelsius === undefined || temperatureInCelsius < 0) return 'unknown';

    if (temperatureUnitConfig === 'FAHRENHEIT') {
        return getAsRoundedString(convertToFahrenheit(temperatureInCelsius), 1) + '°F';
    } else {
        return getAsRoundedString(temperatureInCelsius, 1) + '°C';
    }
}

function convertToFahrenheit(temperatureInCelsius) {
    return temperatureInCelsius * 9 / 5 + 32;
}

function addStatusIcon(widget, statusBool) {
    let name = '';
    let color;
    if (statusBool === undefined) {
        name = 'questionmark.circle.fill';
        color = Color.yellow();
    } else if (statusBool) {
        name = 'checkmark.circle.fill';
        color = Color.green();
    } else {
        name = 'exclamationmark.triangle.fill';
        color = Color.red();
    }
    let sf = SFSymbol.named(name);
    sf.applyFont(Font.heavySystemFont(50));
    let iconImage = sf.image;
    let imageWidget = widget.addImage(iconImage);
    imageWidget.resizable = true;
    imageWidget.imageSize = new Size(13, 13);
    imageWidget.tintColor = color;
}

function addStatusInfo(lineWidget, statusBool, shownText) {
    let itemStack = lineWidget.addStack();
    itemStack.centerAlignContent();
    addStatusIcon(itemStack, statusBool);
    itemStack.addSpacer(2);
    let text = itemStack.addText(shownText);
    text.font = Font.semiboldMonospacedSystemFont(10);
    text.textColor = fontColorWhite;
}

function handleNotifications(fm, hbRunning, hbUtd, pluginsUtd, nodeUtd) {
    let path = getFilePath(NOTIFICATION_JSON_FILE_NAME, fm);
    let state = getNotificationState(fm, path);
    let now = new Date();
    let shouldUpdateState = false;
    if (shouldNotify(hbRunning, state.hbRunning.status, state.hbRunning.lastNotified)) {
        state.hbRunning.status = hbRunning;
        state.hbRunning.lastNotified = now;
        shouldUpdateState = true;
        scheduleNotification('Your Homebridge instance stopped 😱');
    } else if (hbRunning && !state.hbRunning.status) {
        state.hbRunning.status = hbRunning;
        state.hbRunning.lastNotified = undefined;
        shouldUpdateState = true;
        if (!disableStateBackToNormalNotifications) {
            scheduleNotification('Your Homebridge instance is back online 😁');
        }
    }

    if (shouldNotify(hbUtd, state.hbUtd.status, state.hbUtd.lastNotified)) {
        state.hbUtd.status = hbUtd;
        state.hbUtd.lastNotified = now;
        shouldUpdateState = true;
        scheduleNotification('Update available for Homebridge 😎');
    } else if (hbUtd && !state.hbUtd.status) {
        state.hbUtd.status = hbUtd;
        state.hbUtd.lastNotified = undefined;
        shouldUpdateState = true;
        if (!disableStateBackToNormalNotifications) {
            scheduleNotification('Homebridge is now up to date ✌️');
        }
    }

    if (shouldNotify(pluginsUtd, state.pluginsUtd.status, state.pluginsUtd.lastNotified)) {
        state.pluginsUtd.status = pluginsUtd;
        state.pluginsUtd.lastNotified = now;
        shouldUpdateState = true;
        scheduleNotification('Update available for one of your Plugins 😎');
    } else if (pluginsUtd && !state.pluginsUtd.status) {
        state.pluginsUtd.status = pluginsUtd;
        state.pluginsUtd.lastNotified = undefined;
        shouldUpdateState = true;
        if (!disableStateBackToNormalNotifications) {
            scheduleNotification('Plugins are now up to date ✌️');
        }
    }

    if (shouldNotify(nodeUtd, state.nodeUtd.status, state.nodeUtd.lastNotified)) {
        state.nodeUtd.status = nodeUtd;
        state.nodeUtd.lastNotified = now;
        shouldUpdateState = true;
        scheduleNotification('Update available for Node.js 😎');
    } else if (nodeUtd && !state.nodeUtd.status) {
        state.nodeUtd.status = nodeUtd;
        state.nodeUtd.lastNotified = undefined;
        shouldUpdateState = true;
        if (!disableStateBackToNormalNotifications) {
            scheduleNotification('Node.js is now up to date ✌️');
        }
    }

    if (shouldUpdateState) {
        saveNotificationState(fm, state, path);
    }
}

function shouldNotify(currentBool, boolFromLastTime, lastNotifiedDate) {
    return (!currentBool && (boolFromLastTime || isTimeToNotifyAgain(lastNotifiedDate)));
}

function isTimeToNotifyAgain(dateToCheck) {
    if (dateToCheck === undefined) return true;

    let dateInThePast = new Date(dateToCheck);
    let now = new Date();
    let timeBetweenDates = parseInt((now.getTime() - dateInThePast.getTime()) / 1000); // seconds
    return timeBetweenDates > notificationIntervalInDays * 24 * 60 * 60;
}

function scheduleNotification(text) {
    let not = new Notification();
    not.title = 'Homebridge Status changed:'
    not.body = text;
    not.addAction('Show me!', hbServiceMachineBaseUrl, false);
    not.sound = 'event';
    not.schedule();
}

function getNotificationState(fm, path) {
    if (fm.fileExists(path)) {
        let raw, savedState;
        try {
            raw = fm.readString(path);
            savedState = JSON.parse(raw);
        } catch (e) {
            // file corrupted -> remove it
            fm.remove(path);
        }

        if (savedState && savedState.jsonVersion === undefined || savedState.jsonVersion < NOTIFICATION_JSON_VERSION) {
            // the version of the json file is outdated -> remove it and recreate it
            fm.remove(path);
        } else {
            return savedState;
        }
    }
    // create a new state json
    let state = {
        'jsonVersion': NOTIFICATION_JSON_VERSION,
        'hbRunning': {
            'status': true,
            'lastNotified': undefined
        },
        'hbUtd': {
            'status': true,
            'lastNotified': undefined
        },
        'pluginsUtd': {
            'status': true,
            'lastNotified': undefined
        },
        'nodeUtd': {
            'status': true,
            'lastNotified': undefined
        }
    };
    saveNotificationState(fm, state, path);
    return state;
}

function saveNotificationState(fm, state, path) {
    let raw = JSON.stringify(state);
    fm.writeString(path, raw);
}