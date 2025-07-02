#!/usr/bin/env node

require('dotenv').config();
const AnalyticsManager = require('../src/analytics');
const logger = require('../src/utils/logger');
const moment = require('moment');

class AnalyticsCLI {
    constructor() {
        this.analytics = new AnalyticsManager();
    }

    async run() {
        const args = process.argv.slice(2);
        const command = args[0];

        try {
            switch (command) {
                case 'daily':
                    await this.runDailyReport(args[1]);
                    break;
                case 'weekly':
                    await this.runWeeklyReport(args[1]);
                    break;
                case 'help':
                    this.showHelp();
                    break;
                default:
                    console.log('Unknown command. Use "help" for available commands.');
                    this.showHelp();
            }
        } catch (error) {
            logger.error('Analytics CLI error', { error: error.message });
            process.exit(1);
        }
    }

    async runDailyReport(date) {
        try {
            const targetDate = date || moment().format('YYYY-MM-DD');
            logger.info(`Generating daily report for ${targetDate}`);
            
            const report = await this.analytics.generateDailyReport(targetDate);
            
            console.log('\n📊 DAILY ANALYTICS REPORT');
            console.log('========================');
            console.log(`Date: ${report.date}`);
            console.log(`Total Messages: ${report.totalMessages}`);
            console.log(`First Time Contacts: ${report.firstTimeContacts}`);
            console.log(`Response Time Average: ${report.responseTimeStats.average}s`);
            
            console.log('\n📱 Message Types:');
            Object.entries(report.messageTypes).forEach(([type, count]) => {
                console.log(`  ${type}: ${count}`);
            });
            
            console.log('\n⏰ Busy Hours:');
            console.log(`  Peak Hour: ${report.busyHours.peakHour}:00 (${report.busyHours.peakHourCount} messages)`);
            
            console.log('\n🔍 Top Keywords:');
            Object.entries(report.keywordAnalysis).slice(0, 5).forEach(([keyword, count]) => {
                console.log(`  ${keyword}: ${count}`);
            });
            
        } catch (error) {
            logger.error('Failed to generate daily report', { error: error.message });
        }
    }

    async runWeeklyReport(startDate) {
        try {
            const start = startDate || moment().startOf('week').format('YYYY-MM-DD');
            logger.info(`Generating weekly report starting from ${start}`);
            
            const report = await this.analytics.generateWeeklyReport(start);
            
            console.log('\n📊 WEEKLY ANALYTICS REPORT');
            console.log('==========================');
            console.log(`Week: ${report.weekStart} to ${report.weekEnd}`);
            console.log(`Total Messages: ${report.totalMessages}`);
            console.log(`Total First Contacts: ${report.totalFirstContacts}`);
            console.log(`Average Response Time: ${report.averageResponseTime}s`);
            
            console.log('\n📅 Daily Breakdown:');
            report.dailyReports.forEach(day => {
                const dayName = moment(day.date).format('dddd');
                console.log(`  ${dayName} (${day.date}): ${day.totalMessages} messages, ${day.firstTimeContacts} new contacts`);
            });
            
        } catch (error) {
            logger.error('Failed to generate weekly report', { error: error.message });
        }
    }

    showHelp() {
        console.log('\n📊 WhatsApp Bot Analytics CLI');
        console.log('==============================');
        console.log('Usage: npm run analytics <command> [options]');
        console.log('');
        console.log('Commands:');
        console.log('  daily [date]     Generate daily report (default: today)');
        console.log('                   Date format: YYYY-MM-DD');
        console.log('  weekly [start]   Generate weekly report (default: current week)');
        console.log('                   Start date format: YYYY-MM-DD');
        console.log('  help             Show this help message');
        console.log('');
        console.log('Examples:');
        console.log('  npm run analytics daily');
        console.log('  npm run analytics daily 2023-12-25');
        console.log('  npm run analytics weekly');
        console.log('  npm run analytics weekly 2023-12-18');
        console.log('');
    }
}

// Run the CLI
const cli = new AnalyticsCLI();
cli.run().catch(error => {
    console.error('CLI execution failed:', error.message);
    process.exit(1);
});
