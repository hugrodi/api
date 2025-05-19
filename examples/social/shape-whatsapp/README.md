# Shape WhatsApp Bot

A WhatsApp bot powered by the Shapes API that provides AI-powered conversational interactions directly through WhatsApp.

## Features

- Direct messaging with Shape AI Character
- Supports both direct and group chat interactions

## Prerequisites

- Node.js (v14 or later)
- WhatsApp account
- Shapes Inc. API Key
- Ngrok account (for exposing local server)

### Installing Ngrok

1. Sign up for a free account at [ngrok.com](https://ngrok.com/)

2. Install Ngrok globally via npm:
   ```bash
   npm install -g ngrok
   ```

3. Authenticate Ngrok with your account:
   ```bash
   ngrok authtoken YOUR_NGROK_AUTHTOKEN
   ```
   (You can find your authtoken in the Ngrok dashboard)

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/shape-whatsapp-bot.git
   cd shape-whatsapp-bot
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the project root and add the following environment variables:
   ```
   SHAPESINC_SHAPE_USERNAME=put your shape username here (is after the / in the link you use for accessing your shape
   SHAPESINC_API_KEY=put the API from your shape here
   FREE_WILL_INSTRUCTIONS = "put the free will instructions you use on your shape here (don't remove the " in begining and end)"
   LEVEL_OF_FREE_WILL=put a value between 0 and 1 , 0 means it won't have free will and 1 means will reply always when some talks on group chat
   DAILY_LEVEL_OF_FREE_WILL= put a value between 0 and 1 , 0 means it won't have free will and 1 means will reply always this is checking the chat once in a while
   numberRecentMessages= put the number of messages you want your shape to check when checking using free will
   DAILY_TIME_CHECK= put the number you want on this case 86400000 means a full day 12000 means every 12 seconds so basically adding 000 after how many seconds youw ants shape to check the group chat
   FAVORITE_PEOPLE ="add here the number plus the country check digits and the the @c.us after, you can add multiple numbers divinding them with "," from example if the country digits aree +351 (this one is from Portugal)    it will be like this (351123456789@c.us,351987654321@c.us) (don't remove the " in begining and end)"
   KEYWORDS_OF_INTEREST="put any keyword you want dividing it by "," for example (erza,cake,potatoes) (don't remove the " in begining and end)"
   ```

## Running the Bot

1. Start the application:
   ```bash
   npm start
   ```

2. Open the generated Ngrok URL in your browser to scan the QR code with WhatsApp.

## Usage Commands
- `!ping`: Triggers the bot
- Automatically process replies on DM
- Automatically reply on na group chat when you reply to a message from bot or when you use a keyword of interest on your message
- Free will!!!! your shape can reply sometimes, depends on the strenght you put on the level of free will, without even being mention or there is a keyword of interest plus it can check the group chat without the user sending a messsage

## Environment Configuration

   - `SHAPESINC_SHAPE_USERNAME`: put your shape username here (is after the / in the link you use for accessing your shape
   -`SHAPESINC_API_KEY`: put the API from your shape here

   -`FREE_WILL_INSTRUCTIONS` : "put the free will instructions you use on your shape here (don't remove the " in begining and end)"

   -`LEVEL_OF_FREE_WILL`:put a value between 0 and 1 , 0 means it won't have free will and 1 means will reply always when some talks on group chat

   -`DAILY_LEVEL_OF_FREE_WILL`: put a value between 0 and 1 , 0 means it won't have free will and 1 means will reply always this is checking the chat once in a while

   -`numberRecentMessages`: put the number of messages you want your shape to check when checking using free will

   - `DAILY_TIME_CHECK`: put the number you want on this case 86400000 means a full day 12000 means every 12 seconds so basically adding 000 after how many seconds youw ants shape to check the group chat

   -`FAVORITE_PEOPLE` :"add here the number plus the country check digits and the the @c.us after, you can add multiple numbers divinding them with "," from example if the country digits aree +351 (this one is from Portugal) it will be like this (351123456789@c.us,351987654321@c.us) (don't remove the " in begining and end)"

   -`KEYWORDS_OF_INTEREST`:"put any keyword you want dividing it by "," for example (erza,cake,potatoes) (don't remove the " in begining and end)"

## Notes

- The bot uses WhatsApp Web JS for WhatsApp integration
- Requires internet connection
- First-time setup may require scanning QR code

## Troubleshooting

- Ensure API keys are correctly set
- Check network connectivity
- Verify WhatsApp Web compatibility

## License

© 2025 Shapes Inc. All rights reserved.

## Disclaimer

This is an example application and should be used responsibly and in compliance with WhatsApp's terms of service.
