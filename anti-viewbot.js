const fs = require('fs');
const path = require('path');
const express = require('express');
const { google } = require('googleapis');

// ========== CONFIG ==========
const API_KEY = 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'; // your API key
const CHANNEL_ID = 'UCLleZKzwtLupGj6fXySbvuA'; // your channel id
const DATA_LOG_FILE = path.join(__dirname, 'stream_analysis_log.json');

const CHAT_COLLECTION_DURATION_SEC = 30;
const BOT_ESTIMATION_INTERVAL_MS = 60000;

const LURKER_ADJUSTMENT_FACTOR = 0.25;
const MIN_CHAT_VIEWER_RATIO_FOR_PRIMARY_ESTIMATION = 0.02;
const SUSPICIOUSLY_HIGH_MESSAGE_COUNT_PER_USER = 10;

// ========== YOUTUBE SETUP ==========
let youtube;
try {
    if (!API_KEY || API_KEY === 'YOUR_API_KEY') {
        console.error("FATAL: API_KEY is not set.");
        process.exit(1);
    }
    youtube = google.youtube({ version: 'v3', auth: API_KEY });
    console.log("YouTube client initialized.");
} catch (err) {
    console.error("FATAL: Initialization error:", err.message);
    process.exit(1);
}

// ========== EXPRESS DASHBOARD ==========
const app = express();
const PORT = 3000;

app.use(express.static(__dirname)); // serve static files (for future use)

// API route to get all logs (most recent first)
app.get('/api/log', (req, res) => {
    if (fs.existsSync(DATA_LOG_FILE)) {
        try {
            const raw = fs.readFileSync(DATA_LOG_FILE, 'utf-8');
            const data = JSON.parse(raw);
            return res.json(Array.isArray(data) ? data.reverse() : []);
        } catch (err) {
            return res.status(500).json({ error: 'Failed to parse log file.' });
        }
    } else {
        return res.json([]);
    }
});

// Serve dashboard HTML page at root
app.get('/', (req, res) => {
    res.send(`
    `);
});

app.listen(PORT, () => {
    console.log(`Dashboard running at http://localhost:${PORT}`);
});

// ========== CORE FUNCTIONS ==========
// Add a timestamp to each log entry for easier sorting in UI
async function getChannelDetails(channelId) {
    try {
        const res = await youtube.channels.list({
            part: 'snippet',
            id: channelId,
        });

        const channel = res.data.items?.[0];
        if (!channel) return null;

        return {
            channelId,
            channelName: channel.snippet.title,
            profileImageUrl: channel.snippet.thumbnails.default.url,
        };
    } catch (err) {
        console.error("Error fetching channel details:", err.message);
        return null;
    }
}

async function getLiveStreamId(channelId) {
    try {
        const res = await youtube.search.list({
            part: 'id',
            channelId,
            eventType: 'live',
            type: 'video',
            maxResults: 1,
        });
        return res.data.items?.[0]?.id?.videoId || null;
    } catch (error) {
        console.error(`Error fetching live stream ID:`, error.message);
        return null;
    }
}

async function getStreamStats(videoId) {
    try {
        const res = await youtube.videos.list({
            part: 'liveStreamingDetails,statistics',
            id: videoId,
        });

        const video = res.data.items?.[0];
        if (!video?.liveStreamingDetails) return null;

        return {
            concurrentViewers: parseInt(video.liveStreamingDetails.concurrentViewers || 0),
            activeChatId: video.liveStreamingDetails.activeLiveChatId,
        };
    } catch (error) {
        console.error(`Error fetching stream stats:`, error.message);
        return null;
    }
}

async function getChatAnalysis(chatId, durationSec) {
    const uniqueChatAuthors = new Map();
    let totalMessagesCollected = 0;
    let nextPageToken = null;
    const endTime = Date.now() + durationSec * 1000;

    console.log(`Collecting chat messages for ${durationSec}s...`);

    while (Date.now() < endTime) {
        try {
            const res = await youtube.liveChatMessages.list({
                liveChatId: chatId,
                part: 'snippet,authorDetails',
                pageToken: nextPageToken || undefined,
                maxResults: 200,
            });

            res.data.items?.forEach(item => {
                totalMessagesCollected++;
                const authorId = item.authorDetails.channelId;

                if (uniqueChatAuthors.has(authorId)) {
                    uniqueChatAuthors.get(authorId).messageCount++;
                } else {
                    uniqueChatAuthors.set(authorId, {
                        displayName: item.authorDetails.displayName,
                        messageCount: 1,
                        isModerator: item.authorDetails.isChatModerator,
                        isOwner: item.authorDetails.isChatOwner,
                        isSponsor: item.authorDetails.isChatSponsor,
                    });
                }
            });

            nextPageToken = res.data.nextPageToken;
            const waitTime = Math.min(res.data.pollingIntervalMillis || 2000, endTime - Date.now());
            if (waitTime > 0) await new Promise(r => setTimeout(r, waitTime));
        } catch (error) {
            console.error(`Chat fetch error:`, error.message);
            break;
        }
    }

    let suspicious = 0;
    uniqueChatAuthors.forEach(user => {
        if (user.messageCount > SUSPICIOUSLY_HIGH_MESSAGE_COUNT_PER_USER && !user.isModerator && !user.isOwner) {
            suspicious++;
        }
    });

    return {
        uniqueChatterCount: uniqueChatAuthors.size,
        totalMessagesCollected,
        averageMessagesPerChatter: uniqueChatAuthors.size > 0 ? totalMessagesCollected / uniqueChatAuthors.size : 0,
        potentiallySuspiciousChatters: suspicious,
    };
}

function estimateBotsAndRealViewers(concurrentViewers, chatAnalysis) {
    const { uniqueChatterCount, potentiallySuspiciousChatters } = chatAnalysis;

    if (concurrentViewers <= 0) {
        return {
            estimatedRealViewers: 0,
            estimatedBotViewers: 0,
            estimationMethod: "Zero viewers",
            rawChatToViewerRatio: 0,
            adjustedChatToViewerRatio: 0,
        };
    }

    const adjustedUnique = Math.max(0, uniqueChatterCount - potentiallySuspiciousChatters);
    const rawRatio = uniqueChatterCount / concurrentViewers;
    const adjRatio = adjustedUnique / concurrentViewers;

    let estimatedRealViewers = 0;
    let method;

    if (adjustedUnique === 0) {
        method = "No valid chatters";
    } else if (adjRatio >= MIN_CHAT_VIEWER_RATIO_FOR_PRIMARY_ESTIMATION) {
        estimatedRealViewers = Math.round(adjustedUnique / LURKER_ADJUSTMENT_FACTOR);
        method = `Lurker Factor (${LURKER_ADJUSTMENT_FACTOR})`;
    } else {
        estimatedRealViewers = Math.round(concurrentViewers * adjRatio);
        method = `Fallback Ratio (adjRatio: ${adjRatio.toFixed(3)})`;
    }

    estimatedRealViewers = Math.min(Math.max(adjustedUnique, estimatedRealViewers), concurrentViewers);
    const estimatedBotViewers = Math.max(0, concurrentViewers - estimatedRealViewers);

    return {
        estimatedRealViewers,
        estimatedBotViewers,
        estimationMethod: method,
        rawChatToViewerRatio: parseFloat(rawRatio.toFixed(4)),
        adjustedChatToViewerRatio: parseFloat(adjRatio.toFixed(4)),
    };
}

function logToFile(data) {
    // Add a timestamp
    const timestampedData = { timestamp: Date.now(), ...data };

    let log = [];
    if (fs.existsSync(DATA_LOG_FILE)) {
        try {
            const raw = fs.readFileSync(DATA_LOG_FILE, 'utf-8');
            log = JSON.parse(raw);
            if (!Array.isArray(log)) log = [];
        } catch (err) {
            console.warn("Invalid JSON log. Starting fresh.");
        }
    }

    log.push(timestampedData);
    fs.writeFileSync(DATA_LOG_FILE, JSON.stringify(log, null, 2));
}

async function runDetectionLoop() {
    console.log("=== YouTube Live Bot Detection ===");

    const channelDetails = await getChannelDetails(CHANNEL_ID);
    if (!channelDetails) {
        console.error("FATAL: Could not retrieve channel details.");
        return;
    }

    console.log(`Monitoring: ${channelDetails.channelName} (${CHANNEL_ID})`);
    console.log(`Interval: ${BOT_ESTIMATION_INTERVAL_MS / 1000}s`);
    console.log(`Log file: ${DATA_LOG_FILE}\n`);

    const analyze = async () => {
        console.log(`[Cycle] Analyzing ${channelDetails.channelName}...`);

        const videoId = await getLiveStreamId(CHANNEL_ID);
        if (!videoId) return console.log(`[Cycle] No active stream.`);

        const stats = await getStreamStats(videoId);
        if (!stats) return;

        const { concurrentViewers, activeChatId } = stats;

        if (!activeChatId) {
            logToFile({
                channelId: CHANNEL_ID,
                channelName: channelDetails.channelName,
                profileImageUrl: channelDetails.profileImageUrl,
                videoId,
                concurrentViewers,
                uniqueChatterCount: 0,
                totalMessagesCollected: 0,
                averageMessagesPerChatter: 0,
                potentiallySuspiciousChatters: 0,
                estimatedRealViewers: 0,
                estimatedBotViewers: concurrentViewers,
                rawChatToViewerRatio: 0,
                adjustedChatToViewerRatio: 0,
                estimationMethod: "No chat available",
            });
            return console.log(`[Cycle] Logged viewer-only stats.`);
        }

        const chat = await getChatAnalysis(activeChatId, CHAT_COLLECTION_DURATION_SEC);
        const est = estimateBotsAndRealViewers(concurrentViewers, chat);

        const entry = {
            channelId: CHANNEL_ID,
            channelName: channelDetails.channelName,
            profileImageUrl: channelDetails.profileImageUrl,
            videoId,
            concurrentViewers,
            ...chat,
            averageMessagesPerChatter: parseFloat(chat.averageMessagesPerChatter.toFixed(2)),
            ...est,
        };

        logToFile(entry);
        console.log(`[Cycle] Done. Real: ${est.estimatedRealViewers}, Bots: ${est.estimatedBotViewers}`);
    };

    await analyze();
    setInterval(analyze, BOT_ESTIMATION_INTERVAL_MS);
}

// ========== START EVERYTHING ==========
runDetectionLoop().catch(err => {
    console.error("FATAL: Could not start loop:", err.message);
});
