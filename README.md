<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
</head>
<body>
 <img src="https://github.com/user-attachments/assets/b614eaf4-1498-4127-b7a7-16047e06587c"    alt="YouTube Anti-Viewbot Detector" width="550" height="350">
  <h1>YouTube Viewer Audit</h1>
  <p>This Node.js script audits live viewer counts on a specified YouTube livestream to estimate how many viewers are real versus potentially bots, using live chat engagement heuristics.</p>

  <h2>🔧 Features</h2>
  <ul>
    <li>Fetches concurrent viewer counts via the YouTube Data API v3</li>
    <li>Collects live chat messages and identifies unique users</li>
    <li>Estimates real viewers using lurker-adjusted chat ratios</li>
    <li>Detects potentially suspicious users based on message frequency</li>
    <li>Logs all analyses to a JSON file for historical tracking</li>
  </ul>

  <h2>📦 Requirements</h2>
  <ul>
    <li>Node.js 16+</li>
    <li>A valid <strong>YouTube Data API v3</strong> key</li>
    <li>Internet connection</li>
  </ul>

  <h2>📚 Documentation</h2>
  <p>This project uses the <a href="https://developers.google.com/youtube/v3" target="_blank" rel="noopener noreferrer">YouTube Data API v3</a>. You will need to set up an API key through the Google Developer Console and enable the YouTube Data API for your project.</p>

  <h2>🚀 Setup</h2>
  <pre><code>git clone https://github.com/Riotcoke123/youtube-viewer-audit
cd youtube-viewer-audit
npm install

# Run the script (API key and channel ID are hardcoded inside bot.js)
node bot.js
</code></pre>

  <h2>⚙️ Configuration</h2>
  <p>Configuration is done by editing <code>bot.js</code> directly:</p>
  <ul>
    <li><code>API_KEY</code>: Your YouTube API key</li>
    <li><code>CHANNEL_ID</code>: The channel to monitor</li>
    <li><code>CHAT_COLLECTION_DURATION_SEC</code>: Duration of chat monitoring per cycle</li>
    <li><code>BOT_ESTIMATION_INTERVAL_MS</code>: How often the script runs analysis</li>
  </ul>
  <p><strong>Note:</strong> Avoid committing your real API key to public repositories. Consider using environment variables or secrets management for production environments.</p>

  <h2>📈 Output</h2>
  <p>Logs are written to <code>stream_analysis_log.json</code> and include timestamps, viewer counts, chatter counts, and bot estimation ratios.</p>

  <h2>🔐 License</h2>
  <p>This project is licensed under the <a href="https://www.gnu.org/licenses/gpl-3.0.en.html" target="_blank" rel="noopener noreferrer">GNU General Public License v3.0</a>.</p>
  <p>You are free to use, modify, and redistribute under the same license.</p>

</body>
</html>

