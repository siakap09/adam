const GoogleSheetsManager = require('./sheets');
const logger = require('./utils/logger');
const moment = require('moment');

class AnalyticsManager {
    constructor() {
        this.sheetsManager = new GoogleSheetsManager();
    }

    async generateDailyReport(date = null) {
        try {
            const targetDate = date || moment().format('YYYY-MM-DD');
            logger.info('Generating daily report', { date: targetDate });

            // Get all interactions for the day
            const interactions = await this.getInteractionsByDate(targetDate);
            
            const report = {
                date: targetDate,
                totalMessages: interactions.length,
                firstTimeContacts: interactions.filter(i => i.isFirstContact).length,
                messageTypes: this.analyzeMessageTypes(interactions),
                responseTimeStats: this.calculateResponseTimeStats(interactions),
                busyHours: this.analyzeBusyHours(interactions),
                keywordAnalysis: this.analyzeKeywords(interactions)
            };

            logger.success('Daily report generated', report);
            return report;
        } catch (error) {
            logger.error('Failed to generate daily report', { error: error.message });
            throw error;
        }
    }

    async getInteractionsByDate(date) {
        try {
            const response = await this.sheetsManager.sheets.spreadsheets.values.get({
                spreadsheetId: this.sheetsManager.sheetsId,
                range: 'A:J',
            });

            if (!response.data.values) {
                return [];
            }

            const rows = response.data.values;
            const headers = rows[0];
            
            return rows.slice(1)
                .filter(row => {
                    const timestamp = row[0];
                    return timestamp && moment(timestamp).format('YYYY-MM-DD') === date;
                })
                .map(row => ({
                    timestamp: row[0],
                    contactName: row[1],
                    phoneNumber: row[2],
                    messageType: row[3],
                    messageContent: row[4],
                    isFirstContact: row[5] === 'Yes',
                    responseTime: parseInt(row[6]) || 0,
                    botResponse: row[7],
                    status: row[8],
                    notes: row[9]
                }));
        } catch (error) {
            logger.error('Failed to get interactions by date', { error: error.message, date });
            return [];
        }
    }

    analyzeMessageTypes(interactions) {
        const types = {};
        interactions.forEach(interaction => {
            const type = interaction.messageType || 'unknown';
            types[type] = (types[type] || 0) + 1;
        });
        return types;
    }

    calculateResponseTimeStats(interactions) {
        const responseTimes = interactions
            .map(i => i.responseTime)
            .filter(time => time > 0);

        if (responseTimes.length === 0) {
            return { average: 0, min: 0, max: 0, total: 0 };
        }

        const sum = responseTimes.reduce((a, b) => a + b, 0);
        return {
            average: Math.round(sum / responseTimes.length),
            min: Math.min(...responseTimes),
            max: Math.max(...responseTimes),
            total: responseTimes.length
        };
    }

    analyzeBusyHours(interactions) {
        const hourCounts = {};
        
        interactions.forEach(interaction => {
            const hour = moment(interaction.timestamp).hour();
            hourCounts[hour] = (hourCounts[hour] || 0) + 1;
        });

        // Find peak hour
        const peakHour = Object.keys(hourCounts).reduce((a, b) => 
            hourCounts[a] > hourCounts[b] ? a : b, '0');

        return {
            hourlyDistribution: hourCounts,
            peakHour: parseInt(peakHour),
            peakHourCount: hourCounts[peakHour] || 0
        };
    }

    analyzeKeywords(interactions) {
        const keywords = {};
        const commonWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'a', 'an', 'this', 'that', 'these', 'those'];

        interactions.forEach(interaction => {
            if (interaction.messageContent && typeof interaction.messageContent === 'string') {
                const words = interaction.messageContent.toLowerCase()
                    .replace(/[^\w\s]/g, '')
                    .split(/\s+/)
                    .filter(word => word.length > 2 && !commonWords.includes(word));

                words.forEach(word => {
                    keywords[word] = (keywords[word] || 0) + 1;
                });
            }
        });

        // Get top 10 keywords
        const sortedKeywords = Object.entries(keywords)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .reduce((obj, [key, value]) => {
                obj[key] = value;
                return obj;
            }, {});

        return sortedKeywords;
    }

    async generateWeeklyReport(startDate = null) {
        try {
            const start = startDate ? moment(startDate) : moment().startOf('week');
            const reports = [];

            for (let i = 0; i < 7; i++) {
                const date = start.clone().add(i, 'days').format('YYYY-MM-DD');
                const dailyReport = await this.generateDailyReport(date);
                reports.push(dailyReport);
            }

            const weeklyStats = {
                weekStart: start.format('YYYY-MM-DD'),
                weekEnd: start.clone().add(6, 'days').format('YYYY-MM-DD'),
                totalMessages: reports.reduce((sum, r) => sum + r.totalMessages, 0),
                totalFirstContacts: reports.reduce((sum, r) => sum + r.firstTimeContacts, 0),
                averageResponseTime: Math.round(
                    reports.reduce((sum, r) => sum + r.responseTimeStats.average, 0) / 7
                ),
                dailyReports: reports
            };

            logger.success('Weekly report generated', { 
                week: `${weeklyStats.weekStart} to ${weeklyStats.weekEnd}`,
                totalMessages: weeklyStats.totalMessages 
            });

            return weeklyStats;
        } catch (error) {
            logger.error('Failed to generate weekly report', { error: error.message });
            throw error;
        }
    }

    async exportReportToSheet(report, sheetName = 'Analytics') {
        try {
            // This would create a new sheet with analytics data
            // Implementation depends on specific requirements
            logger.info('Exporting report to sheet', { sheetName, reportType: typeof report });
            
            // For now, just log the report
            console.log('Analytics Report:', JSON.stringify(report, null, 2));
            
            return true;
        } catch (error) {
            logger.error('Failed to export report to sheet', { error: error.message });
            return false;
        }
    }
}

module.exports = AnalyticsManager;
