const fs = require('fs');
const path = require('path');
const moment = require('moment');

class Logger {
    constructor() {
        this.logLevel = process.env.LOG_LEVEL || 'info';
        this.logToFile = process.env.LOG_TO_FILE === 'true';
        this.logFilePath = process.env.LOG_FILE_PATH || './logs/bot.log';
        
        // Create logs directory if it doesn't exist
        if (this.logToFile) {
            const logDir = path.dirname(this.logFilePath);
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }
        }
    }

    formatMessage(level, message, data = null) {
        const timestamp = moment().format('YYYY-MM-DD HH:mm:ss');
        let logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
        
        if (data) {
            logMessage += ` | Data: ${JSON.stringify(data)}`;
        }
        
        return logMessage;
    }

    writeToFile(message) {
        if (this.logToFile) {
            fs.appendFileSync(this.logFilePath, message + '\n');
        }
    }

    info(message, data = null) {
        const logMessage = this.formatMessage('info', message, data);
        console.log('\x1b[36m%s\x1b[0m', logMessage); // Cyan
        this.writeToFile(logMessage);
    }

    error(message, data = null) {
        const logMessage = this.formatMessage('error', message, data);
        console.error('\x1b[31m%s\x1b[0m', logMessage); // Red
        this.writeToFile(logMessage);
    }

    warn(message, data = null) {
        const logMessage = this.formatMessage('warn', message, data);
        console.warn('\x1b[33m%s\x1b[0m', logMessage); // Yellow
        this.writeToFile(logMessage);
    }

    success(message, data = null) {
        const logMessage = this.formatMessage('success', message, data);
        console.log('\x1b[32m%s\x1b[0m', logMessage); // Green
        this.writeToFile(logMessage);
    }

    debug(message, data = null) {
        if (this.logLevel === 'debug') {
            const logMessage = this.formatMessage('debug', message, data);
            console.log('\x1b[35m%s\x1b[0m', logMessage); // Magenta
            this.writeToFile(logMessage);
        }
    }
}

module.exports = new Logger();
