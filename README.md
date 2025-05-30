<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
</head>
<body>
  <img src="https://github.com/user-attachments/assets/d226105a-a065-407c-93b3-b1372f56edbb" alt="YouTube Anti-Viewbot Detector" width="365" height="250">

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

# Create a .env file in the root directory with the following content:
API_KEY=your_youtube_api_key

# Replace CHANNEL_ID and other settings in the script or .env as needed
node audit.js
</code></pre>

  <h2>⚙️ Configuration</h2>
  <p>Edit the top of the script or use a <code>.env</code> file to configure:</p>
  <ul>
    <li><code>API_KEY</code>: Your YouTube API key (loaded securely from <code>.env</code>)</li>
    <li><code>CHANNEL_ID</code>: The channel to monitor</li>
    <li><code>CHAT_COLLECTION_DURATION_SEC</code>: Duration of chat monitoring per cycle</li>
    <li><code>BOT_ESTIMATION_INTERVAL_MS</code>: How often the script runs analysis</li>
  </ul>
  <p><strong>Note:</strong> It's highly recommended to use a <code>.env</code> file or a secure config system in production to avoid exposing sensitive credentials in your source code.</p>

  <h2>📈 Output</h2>
  <p>Logs are written to <code>stream_analysis_log.json</code> and include timestamps, viewer counts, chatter counts, and bot estimation ratios.</p>

  <h2>🔐 License</h2>
  <p>This project is licensed under the <a href="https://www.gnu.org/licenses/gpl-3.0.en.html" target="_blank" rel="noopener noreferrer">GNU General Public License v3.0</a>.</p>
  <p>You are free to use, modify, and redistribute under the same license.</p>
</body>
</html>
