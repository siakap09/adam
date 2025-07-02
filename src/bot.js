require('dotenv').config();
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const moment = require('moment');
const GoogleSheetsManager = require('./sheets');
const logger = require('./utils/logger');

class WhatsAppBot {
    constructor() {
        this.client = new Client({
            authStrategy: new LocalAuth(),
            puppeteer: {
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--single-process',
                    '--disable-gpu'
                ]
            }
        });

        this.sheetsManager = new GoogleSheetsManager();
        this.contactHistory = new Map(); // Cache for contact history
        this.messageStartTimes = new Map(); // Track message response times
        
        this.setupEventHandlers();
    }

    setupEventHandlers() {
        // QR Code generation
        this.client.on('qr', (qr) => {
            logger.info('QR Code generated. Scan with your WhatsApp mobile app:');
            qrcode.generate(qr, { small: true });
        });

        // Client ready
        this.client.on('ready', async () => {
            logger.success('WhatsApp bot is ready!');
            try {
                await this.sheetsManager.initialize();
                logger.success('Bot fully initialized with Google Sheets integration');
            } catch (error) {
                logger.error('Failed to initialize Google Sheets integration', { error: error.message });
            }
        });

        // Authentication events
        this.client.on('authenticated', () => {
            logger.success('WhatsApp client authenticated');
        });

        this.client.on('auth_failure', (msg) => {
            logger.error('Authentication failed', { message: msg });
        });

        // Disconnection handling
        this.client.on('disconnected', (reason) => {
            logger.warn('WhatsApp client disconnected', { reason });
        });

        // Message handling
        this.client.on('message', async (message) => {
            await this.handleMessage(message);
        });

        // Message acknowledgment (for tracking delivery)
        this.client.on('message_ack', async (message, ack) => {
            await this.handleMessageAck(message, ack);
        });
    }

    async handleMessage(message) {
        try {
            const contact = await message.getContact();
            const chat = await message.getChat();
            const phoneNumber = contact.number;
            const contactName = contact.pushname || contact.name || 'Unknown';
            
            // Skip if message is from status broadcast or groups (optional)
            if (message.from === 'status@broadcast' || chat.isGroup) {
                return;
            }

            // Skip if message is from bot itself
            if (message.fromMe) {
                return;
            }

            logger.info('Received message', {
                from: phoneNumber,
                name: contactName,
                type: message.type,
                body: message.body?.substring(0, 100) + (message.body?.length > 100 ? '...' : '')
            });

            // Check if this is first contact
            const isFirstContact = await this.isFirstTimeContact(phoneNumber);
            
            // Record message start time for response tracking
            const messageId = message.id._serialized;
            this.messageStartTimes.set(messageId, Date.now());

            // Log interaction to Google Sheets
            await this.logMessageToSheets({
                contactName,
                phoneNumber,
                messageType: message.type,
                messageContent: this.getMessageContent(message),
                isFirstContact,
                status: 'Received'
            });

            // Handle different message types
            await this.processMessage(message, contact, isFirstContact);

        } catch (error) {
            logger.error('Error handling message', { error: error.message });
        }
    }

    async handleMessageAck(message, ack) {
        try {
            // Track message delivery status
            const ackStatus = ['Error', 'Pending', 'Sent', 'Delivered', 'Read'][ack] || 'Unknown';
            
            if (message.fromMe && ack >= 2) { // Message sent successfully
                const messageId = message.id._serialized;
                const startTime = this.messageStartTimes.get(messageId);
                
                if (startTime) {
                    const responseTime = Math.round((Date.now() - startTime) / 1000);
                    this.messageStartTimes.delete(messageId);
                    
                    logger.debug('Message delivery tracked', {
                        messageId,
                        status: ackStatus,
                        responseTime: `${responseTime}s`
                    });
                }
            }
        } catch (error) {
            logger.error('Error handling message acknowledgment', { error: error.message });
        }
    }

    async processMessage(message, contact, isFirstContact) {
        try {
            let botResponse = '';
            
            // Handle first-time contacts
            if (isFirstContact) {
                botResponse = process.env.FIRST_TIME_MESSAGE || 
                    'Thank you for contacting us for the first time! We\'ve recorded your information and will get back to you soon.';
                
                await message.reply(botResponse);
                logger.info('Sent first-time contact message', { phoneNumber: contact.number });
            }
            
            // Auto-reply if enabled
            else if (process.env.AUTO_REPLY_ENABLED === 'true') {
                botResponse = this.generateAutoReply(message);
                await message.reply(botResponse);
                logger.info('Sent auto-reply', { phoneNumber: contact.number });
            }

            // Handle specific commands or keywords
            await this.handleSpecialCommands(message, contact);

            // Update the logged interaction with bot response
            if (botResponse) {
                await this.updateLastInteraction(contact.number, botResponse);
            }

        } catch (error) {
            logger.error('Error processing message', { error: error.message });
        }
    }

    generateAutoReply(message) {
        const messageBody = message.body.toLowerCase();
        
        // Business hours check
        if (!this.isBusinessHours()) {
            return 'Thank you for your message! We are currently outside business hours. We will respond during our next business day (9 AM - 5 PM, Monday-Friday).';
        }

        // Keyword-based responses
        if (messageBody.includes('price') || messageBody.includes('cost')) {
            return 'Thank you for your inquiry about pricing! Our team will provide you with detailed pricing information shortly.';
        }
        
        if (messageBody.includes('support') || messageBody.includes('help')) {
            return 'We\'re here to help! Our support team has received your message and will assist you as soon as possible.';
        }
        
        if (messageBody.includes('order') || messageBody.includes('purchase')) {
            return 'Thank you for your interest in placing an order! Our sales team will contact you shortly to assist with your purchase.';
        }

        // Default auto-reply
        return process.env.AUTO_REPLY_MESSAGE || 
            'Thank you for your message! We\'ve received it and will respond as soon as possible.';
    }

    async handleSpecialCommands(message, contact) {
        const messageBody = message.body.toLowerCase().trim();
        
        // Admin commands (you can add phone number verification here)
        if (messageBody === '/status') {
            const uptime = process.uptime();
            const uptimeFormatted = moment.duration(uptime, 'seconds').humanize();
            await message.reply(`Bot Status: Online\nUptime: ${uptimeFormatted}\nTimestamp: ${moment().format('YYYY-MM-DD HH:mm:ss')}`);
        }
        
        if (messageBody === '/help') {
            const helpMessage = `Available commands:
/status - Check bot status
/help - Show this help message

Business Hours: ${process.env.BUSINESS_START_HOUR || 9}:00 - ${process.env.BUSINESS_END_HOUR || 17}:00
Monday - Friday

For immediate assistance, please describe your inquiry and our team will respond promptly.`;
            
            await message.reply(helpMessage);
        }
    }

    isBusinessHours() {
        const now = moment();
        const currentHour = now.hour();
        const currentDay = now.day(); // 0 = Sunday, 1 = Monday, etc.
        
        const businessStartHour = parseInt(process.env.BUSINESS_START_HOUR) || 9;
        const businessEndHour = parseInt(process.env.BUSINESS_END_HOUR) || 17;
        const businessDays = (process.env.BUSINESS_DAYS || '1,2,3,4,5').split(',').map(d => parseInt(d));
        
        return businessDays.includes(currentDay) && 
               currentHour >= businessStartHour && 
               currentHour < businessEndHour;
    }

    async isFirstTimeContact(phoneNumber) {
        try {
            // Check cache first
            if (this.contactHistory.has(phoneNumber)) {
                return false;
            }

            // Check Google Sheets
            const history = await this.sheetsManager.getContactHistory(phoneNumber);
            const isFirst = history.length === 0;
            
            // Cache the result
            if (!isFirst) {
                this.contactHistory.set(phoneNumber, true);
            }
            
            return isFirst;
        } catch (error) {
            logger.error('Error checking first-time contact', { error: error.message, phoneNumber });
            return false; // Assume not first-time on error
        }
    }

    getMessageContent(message) {
        switch (message.type) {
            case 'chat':
                return message.body;
            case 'image':
                return `[Image] ${message.body || 'Image received'}`;
            case 'document':
                return `[Document] ${message.body || 'Document received'}`;
            case 'audio':
                return '[Audio message]';
            case 'video':
                return `[Video] ${message.body || 'Video received'}`;
            case 'location':
                return '[Location shared]';
            case 'contact_card':
                return '[Contact card shared]';
            default:
                return `[${message.type}] ${message.body || 'Media received'}`;
        }
    }

    async logMessageToSheets(data) {
        try {
            await this.sheetsManager.logInteraction(data);
        } catch (error) {
            logger.error('Failed to log message to sheets', { error: error.message });
        }
    }

    async updateLastInteraction(phoneNumber, botResponse) {
        try {
            // This is a simplified approach - in production you might want to track this more precisely
            const history = await this.sheetsManager.getContactHistory(phoneNumber);
            if (history.length > 0) {
                const lastInteraction = history[history.length - 1];
                await this.sheetsManager.updateInteractionStatus(
                    phoneNumber, 
                    lastInteraction.timestamp, 
                    'Responded', 
                    `Bot response: ${botResponse.substring(0, 100)}${botResponse.length > 100 ? '...' : ''}`
                );
            }
        } catch (error) {
            logger.error('Failed to update last interaction', { error: error.message });
        }
    }

    async start() {
        try {
            logger.info('Starting WhatsApp bot...');
            await this.client.initialize();
        } catch (error) {
            logger.error('Failed to start WhatsApp bot', { error: error.message });
            process.exit(1);
        }
    }

    async stop() {
        try {
            logger.info('Stopping WhatsApp bot...');
            await this.client.destroy();
            logger.success('WhatsApp bot stopped successfully');
        } catch (error) {
            logger.error('Error stopping WhatsApp bot', { error: error.message });
        }
    }
}

// Initialize and start the bot
const bot = new WhatsAppBot();

// Graceful shutdown handling
process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down gracefully...');
    await bot.stop();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, shutting down gracefully...');
    await bot.stop();
    process.exit(0);
});

// Start the bot
bot.start().catch((error) => {
    logger.error('Failed to start bot', { error: error.message });
    process.exit(1);
});

module.exports = WhatsAppBot;
