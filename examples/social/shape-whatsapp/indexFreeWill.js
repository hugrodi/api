const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js'); // Added MessageMedia
const qrcode = require('qrcode');
const express = require('express');
const ngrok = require('ngrok');
const { OpenAI } = require('openai');
const dotenv = require('dotenv');
const fs = require('fs'); // To save media files
const path = require('path'); // For path manipulation
const { v4: uuidv4 } = require('uuid'); // For unique filenames

dotenv.config();

const SHAPES_API_KEY = process.env.SHAPESINC_API_KEY;
const SHAPES_USERNAME = process.env.SHAPESINC_SHAPE_USERNAME;
const BOT_NAME = SHAPES_USERNAME || 'Bot';

if (!SHAPES_API_KEY || !SHAPES_USERNAME) {
    console.error(" Missing SHAPESINC_API_KEY or SHAPESINC_SHAPE_USERNAME in .env");
    process.exit(1);
}

const app = express();
let currentQr = null;
let ngrokUrl = null; // To store the ngrok URL

// --- Media Directory Setup ---
const MEDIA_DIR = path.join(__dirname, 'public', 'media');
if (!fs.existsSync(MEDIA_DIR)) {
    fs.mkdirSync(MEDIA_DIR, { recursive: true });
}
app.use('/media', express.static(MEDIA_DIR)); // Serve media files
// --- End Media Directory Setup ---

app.get('/', (_req, res) => {
    if (!currentQr) return res.send('QR not yet generated. Please wait...');
    qrcode.toDataURL(currentQr, (_err, url) => {
        res.send(`<img src="${url}" alt="QR Code"><p>Scan with WhatsApp</p>`);
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    try {
        const url = await ngrok.connect({ port: PORT, authtoken: process.env.NGROK_AUTHTOKEN });
        ngrokUrl = url; // Store the ngrok URL
        console.log(`✅ QR Code Web Server is live: ${ngrokUrl}`);
        console.log(`Media will be served from: ${ngrokUrl}/media`);
    } catch (error) {
        console.error('Error starting ngrok:', error);
        console.log(`QR Code Web Server potentially live on http://localhost:${PORT} (ngrok failed)`);
        console.warn('Media serving will likely not work externally if ngrok failed.');
    }
});

const shapes = new OpenAI({
    apiKey: SHAPES_API_KEY,
    baseURL: 'https://api.shapes.inc/v1',
});

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-zygote',
            '--disable-extensions'
        ],
        headless: true
    }
});

// ... (client.on('qr'), client.on('ready'), etc. from your previous full code) ...
// For brevity, I'll skip the unchanged parts of listeners like ready, authenticated, etc.
// Just make sure they are there.

client.on('qr', qr => {
    currentQr = qr;
    console.log('QR Code received. Access it via your ngrok URL or http://localhost:', PORT);
});

client.on('ready', () => {
    console.log(`Client is ready! Logged in as ${client.info.wid.user} (${BOT_NAME})`);
    setInterval(async () => {
        await checkAndRespond();
    }, 60000 * 2);
});

client.on('authenticated', () => {
    console.log('Authenticated successfully');
});
client.on('auth_failure', msg => {
    console.error('Authentication failed:', msg);
});
client.on('disconnected', reason => {
    console.warn('Disconnected:', reason);
});


const chatHistories = {};
let requestQueue = [];
let isProcessing = false;
const RPM_LIMIT = 5;
const REQUEST_DELAY = (60 / RPM_LIMIT) * 1000;

const LEVEL_OF_FREE_WILL = 0.10;
const FAVORITE_PEOPLE_NUMBERS = ['351968456317', '968456317']; // Example
const FREE_WILL_KEYWORDS = [
    'Erza Scarlet', 'magic', 'guild', 'adventure', 'cake', 'Erza',
    'Fairy Tail', 'Titania', 'Swordsmanship', 'Strawberry cake', 'Strawberry',
    'Training', 'Strong', 'Fierce', 'Warrior', 'Armor', 'Red Hair', 'Knight',
    'S-Class', 'Sword', 'Fairy Tail Guild', 'Mage', 'Requip Magic'
];
const CONTEXT_KEYWORDS = [ /* ... your extensive list ... */
    'Erza Scarlet', 'hi', 'lol', 'sup', 'magic', 'guild', 'friends', 'adventure', 'cake', 'Erza',
    'Fairy Tail', 'Titania', 'Swordsmanship', 'Strawberry cake', 'Strawberry', 'Training',
    'Laughter', 'Mischief', 'Strong', 'Fierce', 'Warrior', 'Armor', 'Red Hair', 'Knight',
    'S-Class', 'Sword', 'Hello', 'Thanks', 'Love', 'Fun', 'Game', 'Chat', 'Help',
    'Portugal', 'Portuguese', 'Fairy Tail Guild', 'Mage', 'Requip Magic'
];

const FREE_WILL_INSTRUCTIONS = `Respond as Erza Scarlet... (your full instructions) ...dialogue.`;


// --- MODIFIED processWithShapes ---
async function processWithShapes(textPrompt, userId, threadId, chatHistoryForPrompt, instructions, mediaPayload = null) {
    return new Promise((resolve) => {
        requestQueue.push(async () => {
            try {
                const richContent = [];
                if (textPrompt && textPrompt.trim() !== '') {
                    richContent.push({ type: "text", text: textPrompt });
                }

                if (mediaPayload) {
                    if (mediaPayload.type === 'image') {
                        richContent.push({ type: "image_url", image_url: { url: mediaPayload.url } });
                        if (richContent.length === 1) { // Only image, no text prompt yet
                            richContent.unshift({ type: "text", text: "What's in this image?" });
                        }
                    } else if (mediaPayload.type === 'audio') {
                        richContent.push({ type: "audio_url", audio_url: { url: mediaPayload.url } });
                         if (richContent.length === 1) { // Only audio, no text prompt yet
                            richContent.unshift({ type: "text", text: "Transcribe this audio and respond to it." });
                        }
                    }
                }

                if (richContent.length === 0) {
                    console.warn("processWithShapes called with no text or media.");
                    resolve("Please provide some text or media.");
                    return;
                }

                const messages = chatHistoryForPrompt.map(message => ({
                    role: message.from === userId ? "user" : "assistant",
                    content: message.body // Assuming history content is always text for now
                }));

                messages.push({ role: "system", content: instructions });
                messages.push({ role: "user", content: richContent }); // Content is now potentially an array

                const headers = {
                    "X-User-Id": userId,
                    ...(threadId && { "X-Channel-Id": threadId }),
                };

                const response = await shapes.chat.completions.create({
                    model: `shapesinc/${SHAPES_USERNAME}`,
                    messages: messages,
                }, { headers });

                resolve(response.choices[0]?.message?.content || "I didn't quite get that. Could you rephrase?");
            } catch (error) {
                console.error('Shapes API Error:', error);
                if (error.response && error.response.data) {
                    console.error('Shapes API Error Details:', error.response.data);
                }
                resolve("I encountered a little hiccup trying to understand that. Can you try again?");
            }
        });
        processQueue();
    });
}

async function processQueue() {
    if (isProcessing || requestQueue.length === 0) return;
    isProcessing = true;
    const request = requestQueue.shift();
    await request();
    isProcessing = false;
    setTimeout(processQueue, REQUEST_DELAY);
}

function isDirectedToBot(msg, botInfo) {
    const messageBody = msg.body.toLowerCase().trim();
    const mentionedUsers = msg.mentionedIds || [];
    const isMentionedDirectly = mentionedUsers.includes(botInfo?.wid?._serialized);
    const botNameRegex = new RegExp(`\\b${BOT_NAME.toLowerCase()}\\b`, 'i');
    const isNameCalled = botNameRegex.test(messageBody);
    return isMentionedDirectly || isNameCalled;
}

// ... (checkAndRespond, checkKeywords, analyzeChatHistory functions remain mostly the same as your previous full version)
// Ensure checkAndRespond and other functions that call processWithShapes are updated if they need to pass media (likely not for free will)

async function checkAndRespond() {
    if (!client.info) return;
    const chats = await client.getChats();

    for (const chat of chats) {
        if (chat.isGroup && !chat.isReadOnly) {
            const messages = await chat.fetchMessages({ limit: 20 });
            const fiveMinutesAgo = Math.floor(Date.now() / 1000) - (5 * 60);
            const recentMessagesFromOthers = messages.filter(msg =>
                !msg.fromMe &&
                msg.author &&
                msg.timestamp > fiveMinutesAgo
            ).sort((a, b) => b.timestamp - a.timestamp);

            if (recentMessagesFromOthers.length > 0) {
                const lastMessage = recentMessagesFromOthers[0];
                const messageBody = lastMessage.body ? lastMessage.body.toLowerCase().trim() : ""; // Handle if body is null

                const containsFreeWillKeywords = checkKeywords(messageBody, FREE_WILL_KEYWORDS);
                const senderPhoneNumber = lastMessage.author ? lastMessage.author.split('@')[0] : '';
                const isFromFavoritePerson = FAVORITE_PEOPLE_NUMBERS.includes(senderPhoneNumber);
                let shouldProactivelyRespond = false;

                if (containsFreeWillKeywords) {
                    if (Math.random() < LEVEL_OF_FREE_WILL) {
                        shouldProactivelyRespond = true;
                    }
                } else if (isFromFavoritePerson) {
                    if (Math.random() < (LEVEL_OF_FREE_WILL * 1.5) && Math.random() < 0.3) {
                        shouldProactivelyRespond = true;
                    }
                }

                if (shouldProactivelyRespond) {
                    const userId = lastMessage.author;
                    const threadId = chat.id._serialized;
                    const chatHistoryForPrompt = chatHistories[threadId] || [];
                    const context = analyzeChatHistory(chatHistoryForPrompt, CONTEXT_KEYWORDS);
                    let prompt = `The ongoing conversation seems to be about: ${context || 'various topics'}. A recent message that caught my attention was: "${lastMessage.body}". As Erza Scarlet, I'd like to naturally chime in.`;

                    console.log(`[Free Will] Thinking of responding in ${chat.name} to message: "${lastMessage.body}"`);
                    // Free will currently doesn't process media from past messages, only text
                    const reply = await processWithShapes(prompt, userId, threadId, chatHistoryForPrompt, FREE_WILL_INSTRUCTIONS, null);

                    if (reply && reply.trim() && reply.trim() !== "I didn't quite get that. Could you rephrase?" && reply.trim() !== "I encountered a little hiccup trying to understand that. Can you try again?") {
                        await chat.sendStateTyping();
                        await chat.sendMessage(reply);
                        await chat.clearState();
                    }
                }
            }
        }
    }
}

function checkKeywords(messageBody, keywords) {
    if (!messageBody || !keywords || keywords.length === 0) return false;
    const regex = new RegExp(keywords.map(kw => `\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).join('|'), 'i');
    return regex.test(messageBody);
}

function analyzeChatHistory(chatHistory, keywordsToAnalyze) {
    if (!chatHistory || chatHistory.length === 0) return null;
    const recentMessagesText = chatHistory.slice(-15).map(message => message.body || "").join(" ").toLowerCase();
    const topic = keywordsToAnalyze.find(keyword => {
        const keywordRegex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        return keywordRegex.test(recentMessagesText);
    });
    return topic || null;
}


// --- MODIFIED client.on('message') ---
client.on('message', async (msg) => {
    if (msg.fromMe || !client.info) return;

    const chat = await msg.getChat();
    const chatId = chat.id._serialized;

    if (!chatHistories[chatId]) {
        chatHistories[chatId] = [];
    }
    chatHistories[chatId].push({
        from: msg.author || msg.from,
        body: msg.body, // Storing only text body in history for simplicity
        timestamp: msg.timestamp
    });
    const maxHistoryLength = 20;
    if (chatHistories[chatId].length > maxHistoryLength) {
        chatHistories[chatId].splice(0, chatHistories[chatId].length - maxHistoryLength);
    }

    const messageBody = msg.body || ""; // Ensure messageBody is a string
    const userId = msg.author || msg.from;
    const isGroup = chat.isGroup;

    let mediaPayload = null; // To store media info for Shapes API

    // --- Media Handling Logic ---
    if (msg.hasMedia && ngrokUrl) { // Only attempt if ngrok is up
        try {
            console.log("Message has media, attempting to download...");
            const media = await msg.downloadMedia();
            if (media && media.mimetype) {
                console.log(`Media downloaded. Mimetype: ${media.mimetype}, Filename: ${media.filename}`);
                const fileExtension = media.mimetype.split('/')[1] || 'bin';
                const uniqueFilename = `${uuidv4()}.${fileExtension.split('+')[0]}`; // e.g. .xml from svg+xml
                const filePath = path.join(MEDIA_DIR, uniqueFilename);

                fs.writeFileSync(filePath, Buffer.from(media.data, 'base64'));
                const publicMediaUrl = `${ngrokUrl}/media/${uniqueFilename}`;
                console.log(`Media saved locally and accessible at: ${publicMediaUrl}`);

                // Determine media type for Shapes API
                if (media.mimetype.startsWith('image/')) {
                    mediaPayload = { type: 'image', url: publicMediaUrl };
                } else if (['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp3'].includes(media.mimetype) || (media.filename && /\.(mp3|wav|ogg)$/i.test(media.filename))) {
                     // Added mp3 explicitly to mimetype check as 'audio/mpeg' is common for mp3
                    mediaPayload = { type: 'audio', url: publicMediaUrl };
                } else {
                    console.log(`Unsupported media type for Shapes API: ${media.mimetype}`);
                    // Optionally, you could send a message like "I can't process this type of file yet."
                }
            }
        } catch (err) {
            console.error("Error processing media:", err);
            // Optionally send a message back to user: await msg.reply("Sorry, I had trouble processing the media you sent.");
        }
    }
    // --- End Media Handling Logic ---


    const lowerMessageBody = messageBody.toLowerCase().trim();

    if (lowerMessageBody.startsWith('!ask ')) {
        const query = messageBody.slice(5).trim();
        if (!query && !mediaPayload) return msg.reply("Please provide a query or media after `!ask`.");
        await chat.sendStateTyping();
        const reply = await processWithShapes(query, userId, chatId, chatHistories[chatId], FREE_WILL_INSTRUCTIONS, mediaPayload);
        await chat.clearState();
        return msg.reply(reply);
    }

    if (isGroup && lowerMessageBody.startsWith('!shape ')) {
        const query = messageBody.slice(7).trim();
        if (!query && !mediaPayload) return msg.reply("Please provide a query or media after `!shape`.");
        await chat.sendStateTyping();
        const reply = await processWithShapes(query, userId, chatId, chatHistories[chatId], FREE_WILL_INSTRUCTIONS, mediaPayload);
        await chat.clearState();
        return msg.reply(reply);
    }

    const quotedMessage = await msg.getQuotedMessage();
    const isReplyToBot = quotedMessage && quotedMessage.fromMe;
    const isDirectlyAddressedToBot = isDirectedToBot(msg, client.info);

    if (!isGroup || isDirectlyAddressedToBot || isReplyToBot) {
        let contentToProcess = messageBody; // Use original casing for AI if preferred
        if (isGroup) {
            const botPhoneNumber = client.info.wid.user;
            const mentionRegex = new RegExp(`@${botPhoneNumber}`, 'gi');
            contentToProcess = contentToProcess.replace(mentionRegex, '').trim();
            const botNameRegex = new RegExp(`\\b${BOT_NAME}\\b`, 'gi');
            contentToProcess = contentToProcess.replace(botNameRegex, '').trim();
        }

        // If only media was sent with no accompanying text, and it's a direct interaction
        if (!contentToProcess.trim() && mediaPayload) {
             // Default prompts are now handled inside processWithShapes if richContent only has media
             // So contentToProcess can remain empty here if only media is sent.
        } else if (!contentToProcess.trim() && !mediaPayload && msg.type === 'chat') {
             // This case is when it's just "@BotName" or "BotName" with no other text or media
            contentToProcess = "Hello!";
        }


        if (!contentToProcess.trim() && !mediaPayload) {
            console.log("No processable text or media content in the message for direct interaction.");
            return; // Avoid sending empty requests
        }

        await chat.sendStateTyping();
        const reply = await processWithShapes(contentToProcess, userId, chatId, chatHistories[chatId], FREE_WILL_INSTRUCTIONS, mediaPayload);
        await chat.clearState();
        return msg.reply(reply);
    }
});


client.on('message_create', async (message) => {
    if (message.body === '!ping' && !message.fromMe) {
        message.reply('Pong!');
    }
});

client.initialize().catch(err => {
    console.error("Client initialization error:", err);
});

process.on('SIGINT', async () => {
    console.log("SIGINT received, shutting down...");
    if (ngrok && ngrokUrl) { // Check if ngrokUrl was set
        try {
            await ngrok.disconnect();
            console.log("Ngrok disconnected.");
        } catch (e) {
            console.error("Error disconnecting ngrok:", e);
        }
    }
    if (client) {
        try {
            await client.destroy();
            console.log("WhatsApp client destroyed.");
        } catch (e) {
            console.error("Error destroying WhatsApp client:", e);
        }
    }
    // Clean up media files on shutdown
    console.log("Cleaning up media files...");
    fs.readdir(MEDIA_DIR, (err, files) => {
        if (err) {
            console.error("Could not list media directory for cleanup:", err);
            process.exit(0); // Exit even if cleanup fails
            return;
        }
        for (const file of files) {
            try {
                fs.unlinkSync(path.join(MEDIA_DIR, file));
            } catch (e) {
                console.error(`Failed to delete media file ${file}:`, e);
            }
        }
        console.log("Media cleanup complete.");
        process.exit(0);
    });
});
