const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');


const API_KEY = 'API_KEY';
const CHANNEL_ID = 'UCLleZKzwtLupGj6fXySbvuA'; 
const DATA_LOG_FILE = path.join(__dirname, 'stream_analysis_log.json'); 
const CHAT_COLLECTION_DURATION_SEC = 30;    
const BOT_ESTIMATION_INTERVAL_MS = 60000; 

const LURKER_ADJUSTMENT_FACTOR = 0.25; 
                                
const MIN_CHAT_VIEWER_RATIO_FOR_PRIMARY_ESTIMATION = 0.02; 
const SUSPICIOUSLY_HIGH_MESSAGE_COUNT_PER_USER = 10; 

let youtube;
try {
    if (!API_KEY || API_KEY === 'YOUR_API_KEY') {
        console.error("FATAL: API_KEY is not set or is still the placeholder value.");
        console.error("Please replace 'YOUR_API_KEY' in the script with your actual YouTube Data API v3 key.");
        process.exit(1);
    }
    youtube = google.youtube({ version: 'v3', auth: API_KEY });
    console.log("YouTube client initialized successfully.");

} catch (initError) {
    console.error("FATAL: Error during YouTube client initialization:", initError.message);
    process.exit(1);
}


/**
 * @param {string} channelId
 * @returns {Promise<string|null>} 
 */
async function getLiveStreamId(channelId) {
    try {
        const res = await youtube.search.list({
            part: 'id',
            channelId: channelId,
            eventType: 'live',
            type: 'video',
            maxResults: 1
        });

        if (res.data.items && res.data.items.length > 0) {
            return res.data.items[0].id.videoId;
        }
        return null;
    } catch (error) {
        console.error(`Error fetching live stream ID for channel ${channelId}:`, error.message);
        if (error.response && error.response.data && error.response.data.error) {
            console.error("API Error Details:", JSON.stringify(error.response.data.error.errors));
        }
        return null;
    }
}
/**
 * @param {string} videoId 
 * @returns {Promise<Object|null>} 
 */
async function getStreamStats(videoId) {
    try {
        // Uses the global 'youtube' client (lowercase)
        const res = await youtube.videos.list({
            part: 'liveStreamingDetails,statistics',
            id: videoId,
        });

        if (!res.data.items || res.data.items.length === 0) {
            console.warn(`No video details found for video ID: ${videoId}`);
            return null;
        }

        const video = res.data.items[0];
        if (!video.statistics || !video.liveStreamingDetails) {
            console.warn(`Missing statistics or liveStreamingDetails for video ID: ${videoId}`);
            return null;
        }

        return {
            concurrentViewers: parseInt(video.liveStreamingDetails.concurrentViewers || 0),
            activeChatId: video.liveStreamingDetails.activeLiveChatId,
        };
    } catch (error) {
        console.error(`Error fetching stream stats for video ID ${videoId}:`, error.message);
        if (error.response && error.response.data && error.response.data.error) {
            console.error("API Error Details:", JSON.stringify(error.response.data.error.errors));
        }
        return null;
    }
}

/**
 * @param {string} chatId 
 * @param {number} durationSec 
 * @returns {Promise<Object>} 
 */
async function getChatAnalysis(chatId, durationSec) {
    let uniqueChatAuthors = new Map(); 
    let totalMessagesCollected = 0;
    let nextPageToken = null;
    const endTime = Date.now() + durationSec * 1000;

    console.log(`Collecting chat messages from chat ID ${chatId} for ${durationSec} seconds...`);

    try {
        while (Date.now() < endTime) {
            const res = await youtube.liveChatMessages.list({
                liveChatId: chatId,
                part: 'snippet,authorDetails',
                pageToken: nextPageToken || undefined,
                maxResults: 200 
            });

            if (!res.data.items) {
                await new Promise(r => setTimeout(r, Math.min(res.data.pollingIntervalMillis || 2000, endTime - Date.now())));
                if (Date.now() >= endTime) break;
                continue;
            }

            res.data.items.forEach(item => {
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
            const pollingInterval = res.data.pollingIntervalMillis || 5000;
            let waitTime;

            if (!nextPageToken) {
                waitTime = Math.min(pollingInterval, endTime - Date.now());
            } else {
                waitTime = Math.min(pollingInterval / 2, endTime - Date.now(), 1000);
            }
            
            if (waitTime > 0) {
                await new Promise(r => setTimeout(r, waitTime));
            }
            if (Date.now() >= endTime) break;
        }
    } catch (error) {
        console.error(`Error fetching chat messages for chat ID ${chatId}:`, error.message);
        if (error.response && error.response.data && error.response.data.error) {
            const apiError = error.response.data.error.errors[0];
            console.error("API Error Details:", JSON.stringify(apiError));
            if (apiError.reason === "forbidden") {
                console.warn(`Chat for ${chatId} might be disabled or inaccessible by the API key.`);
            }
        }
    }

    console.log(`Collected ${totalMessagesCollected} messages from ${uniqueChatAuthors.size} unique chatters.`);

    let potentiallySuspiciousChatters = 0;
    uniqueChatAuthors.forEach(author => {
        if (author.messageCount > SUSPICIOUSLY_HIGH_MESSAGE_COUNT_PER_USER &&
            !author.isModerator && !author.isOwner) {
            potentiallySuspiciousChatters++;
        }
    });

    return {
        uniqueChatterCount: uniqueChatAuthors.size,
        totalMessagesCollected: totalMessagesCollected,
        averageMessagesPerChatter: uniqueChatAuthors.size > 0 ? (totalMessagesCollected / uniqueChatAuthors.size) : 0,
        potentiallySuspiciousChatters: potentiallySuspiciousChatters,
    };
}

/**
 * @param {number} concurrentViewers 
 * @param {Object} chatAnalysis 
 * @returns {Object}
 */
function estimateBotsAndRealViewers(concurrentViewers, chatAnalysis) {
    const { uniqueChatterCount, potentiallySuspiciousChatters } = chatAnalysis;

    if (concurrentViewers <= 0) { // Changed to <= 0 to handle zero viewers
        return {
            estimatedRealViewers: 0,
            estimatedBotViewers: 0,
            estimationMethod: "No concurrent viewers or zero viewers",
            rawChatToViewerRatio: 0,
            adjustedChatToViewerRatio: 0,
        };
    }

    const adjustedUniqueChatterCount = Math.max(0, uniqueChatterCount - potentiallySuspiciousChatters);
    const rawChatToViewerRatio = uniqueChatterCount / concurrentViewers;
    const adjustedChatToViewerRatio = concurrentViewers > 0 ? adjustedUniqueChatterCount / concurrentViewers : 0;

    let estimatedRealViewers;
    let estimationMethod;

    if (adjustedUniqueChatterCount === 0) {
        estimatedRealViewers = 0;
        estimationMethod = "No reliable chatters detected (all suspicious or none).";
    } else if (LURKER_ADJUSTMENT_FACTOR > 0 && adjustedChatToViewerRatio >= MIN_CHAT_VIEWER_RATIO_FOR_PRIMARY_ESTIMATION) {
        estimatedRealViewers = Math.round(adjustedUniqueChatterCount / LURKER_ADJUSTMENT_FACTOR);
        estimationMethod = `Lurker Factor (Factor: ${LURKER_ADJUSTMENT_FACTOR}, AdjChatRatio: ${adjustedChatToViewerRatio.toFixed(3)})`;
    } else {
        estimatedRealViewers = Math.round(concurrentViewers * adjustedChatToViewerRatio);
        estimationMethod = `Fallback Simple Ratio (AdjChatRatio: ${adjustedChatToViewerRatio.toFixed(3)})`;
        if (adjustedChatToViewerRatio < MIN_CHAT_VIEWER_RATIO_FOR_PRIMARY_ESTIMATION && LURKER_ADJUSTMENT_FACTOR > 0) {
             estimationMethod += ` (Chat ratio < ${MIN_CHAT_VIEWER_RATIO_FOR_PRIMARY_ESTIMATION * 100}%)`;
        }
    }

    estimatedRealViewers = Math.min(estimatedRealViewers, concurrentViewers);
    estimatedRealViewers = Math.max(estimatedRealViewers, adjustedUniqueChatterCount);
    estimatedRealViewers = Math.max(0, estimatedRealViewers);

    const estimatedBotViewers = Math.max(0, concurrentViewers - estimatedRealViewers);

    return {
        estimatedRealViewers,
        estimatedBotViewers,
        estimationMethod,
        rawChatToViewerRatio: parseFloat(rawChatToViewerRatio.toFixed(4)),
        adjustedChatToViewerRatio: parseFloat(adjustedChatToViewerRatio.toFixed(4))
    };
}

/**
 * @param {Object} data 
 */
function logToFile(data) {
    let log = [];
    if (fs.existsSync(DATA_LOG_FILE)) {
        try {
            const fileContent = fs.readFileSync(DATA_LOG_FILE, 'utf-8');
            if (fileContent) { 
                log = JSON.parse(fileContent);
                if (!Array.isArray(log)) log = [];
            }
        } catch (e) {
            console.warn("Error reading or parsing log file, starting with a new log array.", e.message);
            log = [];
        }
    }

    log.push(data);
    try {
        fs.writeFileSync(DATA_LOG_FILE, JSON.stringify(log, null, 2));
    } catch (e) {
        console.error("Error writing to log file:", e.message);
    }
}


async function runDetectionLoop() {
    console.log(`Starting YouTube Live Stream Bot Detection`);
    console.log(`Monitoring Channel ID: ${CHANNEL_ID}`);
    console.log(`Analysis Interval: ${BOT_ESTIMATION_INTERVAL_MS / 1000} seconds`);
    console.log(`Chat Collection Duration per Cycle: ${CHAT_COLLECTION_DURATION_SEC} seconds`);
    console.log(`Log File: ${DATA_LOG_FILE}`);
    console.log("---");

    const analysisCycle = async () => {
        const cycleTimestamp = new Date().toISOString();
        console.log(`[${cycleTimestamp}] Starting new analysis cycle...`);

        try {
            const videoId = await getLiveStreamId(CHANNEL_ID);
            if (!videoId) {
                console.log(`[${cycleTimestamp}] No active live stream found for channel ${CHANNEL_ID}.`);
                return;
            }
            console.log(`[${cycleTimestamp}] Active live stream found: ${videoId}`);

            const streamStats = await getStreamStats(videoId);
            if (!streamStats) {
                console.log(`[${cycleTimestamp}] Could not retrieve stream stats for video ${videoId}.`);
                return;
            }
            console.log(`[${cycleTimestamp}] Concurrent Viewers: ${streamStats.concurrentViewers}`);

            if (!streamStats.activeChatId) {
                console.log(`[${cycleTimestamp}] No active chat ID found for video ${videoId}. Logging viewer data only.`);
                const noChatResult = {
                    timestamp: cycleTimestamp,
                    channelId: CHANNEL_ID,
                    videoId: videoId,
                    concurrentViewers: streamStats.concurrentViewers,
                    uniqueChatterCount: 0,
                    totalMessagesCollected: 0,
                    averageMessagesPerChatter: 0,
                    potentiallySuspiciousChatters: 0,
                    estimatedRealViewers: 0,
                    estimatedBotViewers: streamStats.concurrentViewers,
                    rawChatToViewerRatio: 0,
                    adjustedChatToViewerRatio: 0,
                    estimationMethod: "No active chat ID found",
                };
                logToFile(noChatResult);
                console.log(`[${cycleTimestamp}] Basic analysis logged (no chat).`);
                return;
            }
            console.log(`[${cycleTimestamp}] Active Chat ID: ${streamStats.activeChatId}`);

            const chatAnalysis = await getChatAnalysis(streamStats.activeChatId, CHAT_COLLECTION_DURATION_SEC);
            const estimates = estimateBotsAndRealViewers(streamStats.concurrentViewers, chatAnalysis);

            const result = {
                timestamp: cycleTimestamp,
                channelId: CHANNEL_ID,
                videoId: videoId,
                concurrentViewers: streamStats.concurrentViewers,
                uniqueChatterCount: chatAnalysis.uniqueChatterCount,
                totalMessagesCollected: chatAnalysis.totalMessagesCollected,
                averageMessagesPerChatter: parseFloat(chatAnalysis.averageMessagesPerChatter.toFixed(2)),
                potentiallySuspiciousChatters: chatAnalysis.potentiallySuspiciousChatters,
                estimatedRealViewers: estimates.estimatedRealViewers,
                estimatedBotViewers: estimates.estimatedBotViewers,
                rawChatToViewerRatio: estimates.rawChatToViewerRatio,
                adjustedChatToViewerRatio: estimates.adjustedChatToViewerRatio,
                estimationMethod: estimates.estimationMethod,
            };

            console.log(`[${cycleTimestamp}] Analysis complete. Est. Real: ${result.estimatedRealViewers}, Est. Bots: ${result.estimatedBotViewers} (Method: ${result.estimationMethod})`);
            logToFile(result);

        } catch (err) {
            console.error(`[${cycleTimestamp}] Error during detection cycle:`, err.message);
            if (err.response && err.response.data && err.response.data.error && err.response.data.error.errors) {
                const apiError = err.response.data.error.errors[0];
                console.error(`API Error: ${apiError.message} (Reason: ${apiError.reason})`);
                if (apiError.reason === "quotaExceeded") {
                    console.error(">>> YouTube API Quota Exceeded! Bot detection will likely fail until quota resets. <<<");
                }
            } else if (!err.response) { 
                 console.error(err.stack);
            }
        }
    };

    await analysisCycle(); 
    setInterval(analysisCycle, BOT_ESTIMATION_INTERVAL_MS); 
}

runDetectionLoop().catch(error => {
    console.error('FATAL: Failed to start the detection loop:', error);
});

process.on('SIGINT', () => {
    console.log("\nSIGINT received. Shutting down...");

    process.exit(0);
});
