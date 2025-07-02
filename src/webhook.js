const express = require('express');
const logger = require('./utils/logger');
const AnalyticsManager = require('./analytics');

class WebhookServer {
    constructor(bot) {
        this.app = express();
        this.bot = bot;
        this.analytics = new AnalyticsManager();
        this.port = process.env.PORT || 3000;
        
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));
        
        // CORS middleware
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
            next();
        });

        // Request logging
        this.app.use((req, res, next) => {
            logger.debug('HTTP Request', {
                method: req.method,
                url: req.url,
                ip: req.ip,
                userAgent: req.get('User-Agent')
            });
            next();
        });
    }

    setupRoutes() {
        // Health check endpoint
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                botStatus: this.bot.client ? 'connected' : 'disconnected'
            });
        });

        // Bot status endpoint
        this.app.get('/status', async (req, res) => {
            try {
                const info = this.bot.client ? await this.bot.client.info : null;
                res.json({
                    botStatus: this.bot.client ? 'connected' : 'disconnected',
                    clientInfo: info,
                    uptime: process.uptime(),
                    timestamp: new Date().toISOString(),
                    version: process.env.npm_package_version || '1.0.0'
                });
            } catch (error) {
                res.status(500).json({
                    error: 'Failed to get bot status',
                    message: error.message
                });
            }
        });

        // Send message endpoint (for external integrations)
        this.app.post('/send-message', async (req, res) => {
            try {
                const { phoneNumber, message } = req.body;
                
                if (!phoneNumber || !message) {
                    return res.status(400).json({
                        error: 'Missing required fields: phoneNumber and message'
                    });
                }

                // Format phone number
                const formattedNumber = phoneNumber.includes('@c.us') ? 
                    phoneNumber : `${phoneNumber}@c.us`;

                await this.bot.client.sendMessage(formattedNumber, message);
                
                logger.info('Message sent via webhook', { phoneNumber, message });
                
                res.json({
                    success: true,
                    message: 'Message sent successfully',
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                logger.error('Failed to send message via webhook', { error: error.message });
                res.status(500).json({
                    error: 'Failed to send message',
                    message: error.message
                });
            }
        });

        // Analytics endpoints
        this.app.get('/analytics/daily/:date?', async (req, res) => {
            try {
                const date = req.params.date;
                const report = await this.analytics.generateDailyReport(date);
                res.json(report);
            } catch (error) {
                logger.error('Failed to generate daily analytics', { error: error.message });
                res.status(500).json({
                    error: 'Failed to generate analytics',
                    message: error.message
                });
            }
        });

        this.app.get('/analytics/weekly/:startDate?', async (req, res) => {
            try {
                const startDate = req.params.startDate;
                const report = await this.analytics.generateWeeklyReport(startDate);
                res.json(report);
            } catch (error) {
                logger.error('Failed to generate weekly analytics', { error: error.message });
                res.status(500).json({
                    error: 'Failed to generate analytics',
                    message: error.message
                });
            }
        });

        // Webhook endpoint for external services
        this.app.post('/webhook', async (req, res) => {
            try {
                const { event, data } = req.body;
                
                logger.info('Webhook received', { event, data });
                
                // Handle different webhook events
                switch (event) {
                    case 'new_lead':
                        await this.handleNewLead(data);
                        break;
                    case 'update_contact':
                        await this.handleContactUpdate(data);
                        break;
                    default:
                        logger.warn('Unknown webhook event', { event });
                }
                
                res.json({
                    success: true,
                    message: 'Webhook processed successfully'
                });
            } catch (error) {
                logger.error('Webhook processing failed', { error: error.message });
                res.status(500).json({
                    error: 'Webhook processing failed',
                    message: error.message
                });
            }
        });

        // Dashboard endpoint (simple HTML interface)
        this.app.get('/dashboard', (req, res) => {
            const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>WhatsApp Bot Dashboard</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 40px; }
                    .card { border: 1px solid #ddd; padding: 20px; margin: 20px 0; border-radius: 8px; }
                    .status { padding: 10px; border-radius: 4px; margin: 10px 0; }
                    .online { background-color: #d4edda; color: #155724; }
                    .offline { background-color: #f8d7da; color: #721c24; }
                    button { padding: 10px 20px; margin: 5px; border: none; border-radius: 4px; cursor: pointer; }
                    .btn-primary { background-color: #007bff; color: white; }
                    .btn-success { background-color: #28a745; color: white; }
                </style>
            </head>
            <body>
                <h1>WhatsApp Bot Dashboard</h1>
                
                <div class="card">
                    <h3>Bot Status</h3>
                    <div id="status" class="status">Loading...</div>
                    <button class="btn-primary" onclick="checkStatus()">Refresh Status</button>
                </div>
                
                <div class="card">
                    <h3>Analytics</h3>
                    <button class="btn-success" onclick="getDailyReport()">Daily Report</button>
                    <button class="btn-success" onclick="getWeeklyReport()">Weekly Report</button>
                    <div id="analytics"></div>
                </div>
                
                <div class="card">
                    <h3>Send Message</h3>
                    <input type="text" id="phoneNumber" placeholder="Phone Number (with country code)" style="width: 200px; padding: 8px;">
                    <input type="text" id="messageText" placeholder="Message" style="width: 300px; padding: 8px;">
                    <button class="btn-primary" onclick="sendMessage()">Send</button>
                </div>
                
                <script>
                    async function checkStatus() {
                        try {
                            const response = await fetch('/status');
                            const data = await response.json();
                            const statusDiv = document.getElementById('status');
                            statusDiv.className = 'status ' + (data.botStatus === 'connected' ? 'online' : 'offline');
                            statusDiv.innerHTML = \`Status: \${data.botStatus}<br>Uptime: \${Math.round(data.uptime)}s\`;
                        } catch (error) {
                            console.error('Failed to check status:', error);
                        }
                    }
                    
                    async function getDailyReport() {
                        try {
                            const response = await fetch('/analytics/daily');
                            const data = await response.json();
                            document.getElementById('analytics').innerHTML = '<pre>' + JSON.stringify(data, null, 2) + '</pre>';
                        } catch (error) {
                            console.error('Failed to get daily report:', error);
                        }
                    }
                    
                    async function getWeeklyReport() {
                        try {
                            const response = await fetch('/analytics/weekly');
                            const data = await response.json();
                            document.getElementById('analytics').innerHTML = '<pre>' + JSON.stringify(data, null, 2) + '</pre>';
                        } catch (error) {
                            console.error('Failed to get weekly report:', error);
                        }
                    }
                    
                    async function sendMessage() {
                        const phoneNumber = document.getElementById('phoneNumber').value;
                        const messageText = document.getElementById('messageText').value;
                        
                        if (!phoneNumber || !messageText) {
                            alert('Please fill in both phone number and message');
                            return;
                        }
                        
                        try {
                            const response = await fetch('/send-message', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ phoneNumber, message: messageText })
                            });
                            
                            if (response.ok) {
                                alert('Message sent successfully!');
                                document.getElementById('messageText').value = '';
                            } else {
                                alert('Failed to send message');
                            }
                        } catch (error) {
                            console.error('Failed to send message:', error);
                            alert('Failed to send message');
                        }
                    }
                    
                    // Auto-refresh status every 30 seconds
                    setInterval(checkStatus, 30000);
                    checkStatus();
                </script>
            </body>
            </html>`;
            
            res.send(html);
        });

        // 404 handler
        this.app.use((req, res) => {
            res.status(404).json({
                error: 'Endpoint not found',
                availableEndpoints: [
                    'GET /health',
                    'GET /status', 
                    'GET /dashboard',
                    'POST /send-message',
                    'GET /analytics/daily/:date?',
                    'GET /analytics/weekly/:startDate?',
                    'POST /webhook'
                ]
            });
        });
    }

    async handleNewLead(data) {
        // Handle new lead from external system
        logger.info('Processing new lead', data);
        // Could send welcome message, update CRM, etc.
    }

    async handleContactUpdate(data) {
        // Handle contact update from external system
        logger.info('Processing contact update', data);
        // Could update Google Sheets, send notification, etc.
    }

    start() {
        if (process.env.ENABLE_WEB_INTERFACE === 'true') {
            this.app.listen(this.port, () => {
                logger.success(`Webhook server started on port ${this.port}`);
                logger.info(`Dashboard available at: http://localhost:${this.port}/dashboard`);
            });
        }
    }

    stop() {
        // Graceful shutdown logic here
        logger.info('Webhook server stopped');
    }
}

module.exports = WebhookServer;
