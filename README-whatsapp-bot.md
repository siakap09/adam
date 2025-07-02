# WhatsApp Chatbot Automation with Google Sheets Integration

This project provides a comprehensive WhatsApp chatbot automation solution that tracks all interactions and logs them to Google Sheets for analysis and customer relationship management.

## Features

- 🤖 **Automated WhatsApp Bot** - Responds to messages automatically
- 📊 **Google Sheets Integration** - Logs all interactions for tracking
- 👥 **First Contact Detection** - Identifies and handles new customers
- ⏱️ **Response Time Tracking** - Monitors bot performance
- 🕐 **Business Hours Support** - Different responses during/outside business hours
- 📱 **Multi-media Support** - Handles text, images, documents, audio, video
- 🔧 **Admin Commands** - Built-in status and help commands
- 📝 **Comprehensive Logging** - File and console logging with different levels

## Prerequisites

1. **Node.js** (version 16 or higher)
2. **Google Cloud Project** with Sheets API enabled
3. **WhatsApp Account** for the bot
4. **Google Sheets** document for logging

## Installation

1. **Clone the repository and install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` file with your configuration.

3. **Set up Google Sheets API:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing one
   - Enable Google Sheets API
   - Create a Service Account
   - Download the JSON credentials file
   - Copy it to `config/google-credentials.json`

4. **Create Google Sheets:**
   - Create a new Google Sheets document
   - Copy the Sheet ID from the URL
   - Share the sheet with your service account email (found in credentials JSON)
   - Add the Sheet ID to your `.env` file

## Configuration

### Environment Variables (.env)

```env
# Required
GOOGLE_SHEETS_ID=your_google_sheets_id_here
GOOGLE_CREDENTIALS_PATH=./config/google-credentials.json

# Optional
BOT_NAME=WhatsApp Tracker Bot
AUTO_REPLY_ENABLED=true
TRACK_ALL_MESSAGES=true
BUSINESS_START_HOUR=9
BUSINESS_END_HOUR=17
BUSINESS_DAYS=1,2,3,4,5
```

### Google Sheets Setup

The bot automatically creates the following columns in your Google Sheet:
- **Timestamp** - When the message was received
- **Contact Name** - Sender's name from WhatsApp
- **Phone Number** - Sender's phone number
- **Message Type** - Type of message (text, image, document, etc.)
- **Message Content** - Content of the message
- **Is First Contact** - Whether this is the first time contacting
- **Response Time** - How long the bot took to respond
- **Bot Response** - What the bot replied
- **Status** - Current status (Received, Responded, etc.)
- **Notes** - Additional notes or updates

## Usage

### Starting the Bot

```bash
npm start
```

### Development Mode

```bash
npm run dev
```

### First Time Setup

1. Run the bot: `npm start`
2. Scan the QR code with your WhatsApp mobile app
3. The bot will authenticate and start monitoring messages
4. Test by sending a message to the WhatsApp number

### Bot Commands

Users can send these commands to the bot:

- `/status` - Check bot status and uptime
- `/help` - Show available commands and business hours

### Admin Features

- **First Contact Detection**: Automatically detects new customers
- **Auto-replies**: Customizable responses based on keywords
- **Business Hours**: Different responses during/outside business hours
- **Message Tracking**: All interactions logged to Google Sheets
- **Response Time Monitoring**: Tracks how quickly bot responds

## Message Handling

The bot handles various message types:

- **Text Messages**: Full content logged
- **Images**: Logged as "[Image] caption"
- **Documents**: Logged as "[Document] filename"
- **Audio**: Logged as "[Audio message]"
- **Video**: Logged as "[Video] caption"
- **Location**: Logged as "[Location shared]"
- **Contact Cards**: Logged as "[Contact card shared]"

## Customization

### Auto-Reply Messages

Edit the bot responses in `src/bot.js`:

```javascript
generateAutoReply(message) {
    const messageBody = message.body.toLowerCase();
    
    if (messageBody.includes('price')) {
        return 'Custom pricing response...';
    }
    
    // Add more custom responses
}
```

### Business Logic

Modify `src/bot.js` to add:
- Custom keyword detection
- Integration with CRM systems
- Advanced message routing
- Custom admin commands

### Google Sheets Customization

Modify `src/sheets.js` to:
- Add custom columns
- Implement data validation
- Add formatting rules
- Create summary sheets

## Monitoring and Logs

### Log Files

Logs are saved to `./logs/bot.log` with different levels:
- **INFO**: General information
- **ERROR**: Error messages
- **WARN**: Warning messages
- **SUCCESS**: Success operations
- **DEBUG**: Detailed debugging (when LOG_LEVEL=debug)

### Google Sheets Analytics

Use the logged data to analyze:
- Customer interaction patterns
- Response times
- Message types and frequency
- First contact conversion rates
- Business hours effectiveness

## Troubleshooting

### Common Issues

1. **QR Code not appearing**
   - Check if port 3000 is available
   - Ensure proper Node.js version (16+)

2. **Google Sheets not updating**
   - Verify service account has edit access to the sheet
   - Check credentials file path and format
   - Ensure Sheets API is enabled

3. **Bot not responding**
   - Check WhatsApp Web session is active
   - Verify environment variables
   - Check logs for error messages

4. **Authentication failures**
   - Delete `.wwebjs_auth` folder and re-authenticate
   - Ensure WhatsApp account is not logged in elsewhere

### Debug Mode

Enable debug logging:
```env
LOG_LEVEL=debug
```

## Security Considerations

- Keep your Google credentials file secure
- Don't commit `.env` or credentials to version control
- Regularly rotate service account keys
- Monitor bot usage and access logs
- Implement rate limiting for production use

## Production Deployment

For production deployment:

1. Use process managers like PM2
2. Set up proper logging rotation
3. Implement health checks
4. Use environment-specific configurations
5. Set up monitoring and alerting
6. Consider using webhooks instead of polling

## Support

For issues and questions:
1. Check the logs first
2. Verify configuration settings
3. Test with a simple message
4. Check Google Sheets permissions

## License

MIT License - feel free to modify and distribute as needed.
