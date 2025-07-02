const { google } = require('googleapis');
const fs = require('fs');
const logger = require('./utils/logger');

class GoogleSheetsManager {
    constructor() {
        this.sheetsId = process.env.GOOGLE_SHEETS_ID;
        this.credentialsPath = process.env.GOOGLE_CREDENTIALS_PATH || './config/google-credentials.json';
        this.sheets = null;
        this.auth = null;
    }

    async initialize() {
        try {
            // Load credentials
            if (!fs.existsSync(this.credentialsPath)) {
                throw new Error(`Google credentials file not found at ${this.credentialsPath}`);
            }

            const credentials = JSON.parse(fs.readFileSync(this.credentialsPath, 'utf8'));
            
            // Create JWT auth
            this.auth = new google.auth.JWT(
                credentials.client_email,
                null,
                credentials.private_key,
                ['https://www.googleapis.com/auth/spreadsheets']
            );

            // Initialize Sheets API
            this.sheets = google.sheets({ version: 'v4', auth: this.auth });
            
            // Test connection and create headers if needed
            await this.setupSheetHeaders();
            
            logger.success('Google Sheets integration initialized successfully');
            return true;
        } catch (error) {
            logger.error('Failed to initialize Google Sheets', { error: error.message });
            throw error;
        }
    }

    async setupSheetHeaders() {
        try {
            const headers = [
                'Timestamp',
                'Contact Name',
                'Phone Number',
                'Message Type',
                'Message Content',
                'Is First Contact',
                'Response Time (seconds)',
                'Bot Response',
                'Status',
                'Notes'
            ];

            // Check if headers exist
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.sheetsId,
                range: 'A1:J1',
            });

            if (!response.data.values || response.data.values.length === 0) {
                // Add headers
                await this.sheets.spreadsheets.values.update({
                    spreadsheetId: this.sheetsId,
                    range: 'A1:J1',
                    valueInputOption: 'RAW',
                    resource: {
                        values: [headers]
                    }
                });
                logger.info('Sheet headers created successfully');
            }
        } catch (error) {
            logger.error('Failed to setup sheet headers', { error: error.message });
            throw error;
        }
    }

    async logInteraction(data) {
        try {
            const {
                contactName,
                phoneNumber,
                messageType,
                messageContent,
                isFirstContact,
                responseTime,
                botResponse,
                status = 'Received',
                notes = ''
            } = data;

            const timestamp = new Date().toISOString();
            
            const row = [
                timestamp,
                contactName || 'Unknown',
                phoneNumber,
                messageType,
                messageContent,
                isFirstContact ? 'Yes' : 'No',
                responseTime || '',
                botResponse || '',
                status,
                notes
            ];

            await this.sheets.spreadsheets.values.append({
                spreadsheetId: this.sheetsId,
                range: 'A:J',
                valueInputOption: 'RAW',
                insertDataOption: 'INSERT_ROWS',
                resource: {
                    values: [row]
                }
            });

            logger.info('Interaction logged to Google Sheets', { 
                phoneNumber, 
                messageType, 
                isFirstContact 
            });
            
            return true;
        } catch (error) {
            logger.error('Failed to log interaction to Google Sheets', { 
                error: error.message,
                data 
            });
            return false;
        }
    }

    async getContactHistory(phoneNumber) {
        try {
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.sheetsId,
                range: 'A:J',
            });

            if (!response.data.values) {
                return [];
            }

            const rows = response.data.values;
            const headers = rows[0];
            const phoneIndex = headers.indexOf('Phone Number');
            
            if (phoneIndex === -1) {
                return [];
            }

            const contactHistory = rows.slice(1).filter(row => 
                row[phoneIndex] === phoneNumber
            ).map(row => ({
                timestamp: row[0],
                contactName: row[1],
                phoneNumber: row[2],
                messageType: row[3],
                messageContent: row[4],
                isFirstContact: row[5] === 'Yes',
                responseTime: row[6],
                botResponse: row[7],
                status: row[8],
                notes: row[9]
            }));

            return contactHistory;
        } catch (error) {
            logger.error('Failed to get contact history', { 
                error: error.message, 
                phoneNumber 
            });
            return [];
        }
    }

    async updateInteractionStatus(phoneNumber, timestamp, newStatus, notes = '') {
        try {
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.sheetsId,
                range: 'A:J',
            });

            if (!response.data.values) {
                return false;
            }

            const rows = response.data.values;
            const headers = rows[0];
            const phoneIndex = headers.indexOf('Phone Number');
            const timestampIndex = headers.indexOf('Timestamp');
            const statusIndex = headers.indexOf('Status');
            const notesIndex = headers.indexOf('Notes');

            for (let i = 1; i < rows.length; i++) {
                if (rows[i][phoneIndex] === phoneNumber && 
                    rows[i][timestampIndex] === timestamp) {
                    
                    const range = `${String.fromCharCode(65 + statusIndex)}${i + 1}:${String.fromCharCode(65 + notesIndex)}${i + 1}`;
                    
                    await this.sheets.spreadsheets.values.update({
                        spreadsheetId: this.sheetsId,
                        range: range,
                        valueInputOption: 'RAW',
                        resource: {
                            values: [[newStatus, notes]]
                        }
                    });

                    logger.info('Interaction status updated', { 
                        phoneNumber, 
                        newStatus 
                    });
                    return true;
                }
            }

            return false;
        } catch (error) {
            logger.error('Failed to update interaction status', { 
                error: error.message, 
                phoneNumber, 
                newStatus 
            });
            return false;
        }
    }
}

module.exports = GoogleSheetsManager;
