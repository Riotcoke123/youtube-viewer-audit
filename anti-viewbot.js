
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const API_KEY = 'YOUR_YOUTUBE_API_KEY';
const CHANNEL_ID = 'YOUR_CHANNEL_ID'; // e.g., UC-lHJZR3Gqxm24_Vd_AJ5Yw
const DATA_LOG_FILE = 'stream_analysis_log.json';

// Get active live stream from a channel
async function getLiveStreamId() {
    const youtube = google.youtube({ version: 'v3', auth: API_KEY });
    const res = await youtube.search.list({
        part: 'id',
        channelId: CHANNEL_ID,
        eventType: 'live',
        type: 'video',
    });

    if (res.data.items.length > 0) {
        return res.data.items[0].id.videoId;
    }

    return null;
}

// Get live stream stats (view count, chat ID)
async function getStreamStats(videoId) {
    const youtube = google.youtube({ version: 'v3', auth: API_KEY });
    const res = await youtube.videos.list({
        part: 'liveStreamingDetails,statistics',
        id: videoId,
    });

    const video = res.data.items[0];
    return {
        viewCount: parseInt(video.statistics.viewCount),
        concurrentViewers: parseInt(video.liveStreamingDetails.concurrentViewers || 0),
        activeChatId: video.liveStreamingDetails.activeLiveChatId,
    };
}

// Collect chat messages over a period
async function getChatMessages(chatId, durationSec = 30) {
    const youtube = google.youtube({ version: 'v3', auth: API_KEY });
    let messages = new Set();
    let nextPageToken = null;
    const endTime = Date.now() + durationSec * 1000;

    while (Date.now() < endTime) {
        const res = await youtube.liveChatMessages.list({
            liveChatId: chatId,
            part: 'snippet,authorDetails',
            pageToken: nextPageToken || undefined,
        });

        res.data.items.forEach(msg => {
            messages.add(msg.authorDetails.channelId);
        });

        nextPageToken = res.data.nextPageToken;
        const pollingInterval = res.data.pollingIntervalMillis || 2000;
        await new Promise(r => setTimeout(r, pollingInterval));
    }

    return messages.size;
}

// Estimate bots
function estimateBots(viewers, chatUsers) {
    const ratio = chatUsers / viewers;
    const estimatedReal = Math.round(viewers * ratio);
    const estimatedBots = viewers - estimatedReal;

    return { ratio, estimatedReal, estimatedBots };
}

// Log data
function logToFile(data) {
    let log = [];
    if (fs.existsSync(DATA_LOG_FILE)) {
        log = JSON.parse(fs.readFileSync(DATA_LOG_FILE));
    }

    log.push(data);
    fs.writeFileSync(DATA_LOG_FILE, JSON.stringify(log, null, 2));
}

// Main loop
async function runDetectionLoop() {
    setInterval(async () => {
        try {
            const videoId = await getLiveStreamId();
            if (!videoId) {
                console.log(`[${new Date().toISOString()}] No live stream found.`);
                return;
            }

            const stats = await getStreamStats(videoId);
            const chatUserCount = await getChatMessages(stats.activeChatId);
            const estimates = estimateBots(stats.concurrentViewers, chatUserCount);

            const result = {
                timestamp: new Date().toISOString(),
                channelId: CHANNEL_ID,
                viewers: stats.concurrentViewers,
                chatUsers: chatUserCount,
                estimatedRealViewers: estimates.estimatedReal,
                estimatedBotViewers: estimates.estimatedBots,
                chatToViewerRatio: estimates.ratio.toFixed(2),
            };

            console.log(`[${result.timestamp}] Analysis logged.`);
            logToFile(result);
        } catch (err) {
            console.error('Error during detection:', err.message);
        }
    }, 60000); // Every 60 seconds
}

runDetectionLoop().catch(console.error);
