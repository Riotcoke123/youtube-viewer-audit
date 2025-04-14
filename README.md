
<h1 align="center">📺 YouTube Viewer Audit</h1>
<p align="center">
  <b>Detect suspicious viewers on YouTube live streams</b><br>
  An anti-viewbot detection tool using viewer/chat activity analysis.
</p>

<hr>

<h2>🔍 What It Does</h2>
<ul>
  <li>Analyzes viewer counts vs. chat participation</li>
  <li>Estimates real viewers vs. suspected bots</li>
  <li>Monitors any YouTube channel's live stream</li>
  <li>Logs results every 60 seconds to a JSON file</li>
</ul>

<h2>🛠 Requirements</h2>
<ul>
  <li><a href="https://nodejs.org/">Node.js</a> (v14+ recommended)</li>
  <li>A <a href="https://console.cloud.google.com/">YouTube Data API key</a></li>
</ul>

<h2>📦 Installation</h2>

<pre><code>git clone https://github.com/Riotcoke123/youtube-viewer-audit.git
cd youtube-viewer-audit
npm install
</code></pre>

<h2>⚙️ Configuration</h2>

<ol>
  <li>Open <code>anti-viewbot.js</code></li>
  <li>Replace <code>YOUR_YOUTUBE_API_KEY</code> with your actual API key</li>
  <li>Replace <code>YOUR_CHANNEL_ID</code> with the target YouTube channel's ID</li>
  <li>Set <code>DATA_LOG_FILE</code> to your desired output path</li>
</ol>

<h2>🚀 Usage</h2>

<pre><code>node anti-viewbot.js</code></pre>

<p>This will check for an active live stream every 60 seconds, gather chat data, and log results.</p>

<h2>📄 Sample Log Output</h2>

<pre><code>[
  {
    "timestamp": "2025-04-14T18:32:25.875Z",
    "channelId": "UCxxxxxxx",
    "viewers": 1200,
    "chatUsers": 130,
    "estimatedRealViewers": 130,
    "estimatedBotViewers": 1070,
    "chatToViewerRatio": "0.11"
  }
]</code></pre>

<h2>🧠 How It Works</h2>
<ul>
  <li>Uses YouTube API to detect live streams and retrieve live chat messages</li>
  <li>Estimates engagement ratio between chatters and viewers</li>
  <li>Assumes lower ratios may indicate viewbotting</li>
</ul>

<h2>📌 Notes</h2>
<ul>
  <li>This is a statistical estimate, not an official measure by YouTube</li>
  <li>Some real viewers may not chat, so false positives are possible</li>
</ul>

<h2>🛡 License</h2>
<p>
  This project is licensed under the 
  <a href="https://www.gnu.org/licenses/gpl-3.0.en.html">GNU General Public License v3.0</a>.
  <br>
  You are free to use, modify, and redistribute under the same license.
</p>

<h2>🙌 Contributions</h2>
<p>Pull requests are welcome! If you have ideas, feel free to open an issue or fork the repo and improve it.</p>

<hr>
<p align="center">Made with ❤️ by <a href="https://github.com/Riotcoke123">Riotcoke123</a></p>
