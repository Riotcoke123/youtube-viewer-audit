>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>YouTube Viewer Audit</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      margin: 20px;
      background-color: #f9f9f9;
      color: #333;
    }
    h1, h2, h3 {
      color: #2c3e50;
    }
    code {
      background-color: #eaeaea;
      padding: 2px 4px;
      border-radius: 4px;
      font-family: monospace;
    }
    pre {
      background-color: #eaeaea;
      padding: 10px;
      border-radius: 4px;
      overflow-x: auto;
    }
    ul {
      list-style-type: disc;
      margin-left: 20px;
    }
    a {
      color: #3498db;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <h1>YouTube Viewer Audit</h1>
  <p>Detect suspicious viewers on YouTube live streams</p>
  <p>An anti-viewbot detection tool using viewer/chat activity analysis.</p>

  <hr>

  <h2>What It Does</h2>
  <ul>
    <li>Analyzes viewer counts vs. chat participation</li>
    <li>Estimates real viewers vs. suspected bots</li>
    <li>Monitors any YouTube channel's live stream</li>
    <li>Logs results every 60 seconds to a JSON file</li>
  </ul>

  <h2>Requirements</h2>
  <ul>
    <li><a href="https://nodejs.org/">Node.js</a> (v14+ recommended)</li>
    <li>A <a href="https://console.cloud.google.com/">YouTube Data API key</a></li>
  </ul>

  <h2>Installation</h2>
  <pre><code>git clone https://github.com/Riotcoke123/youtube-viewer-audit.git
cd youtube-viewer-audit
npm install</code></pre>

  <h2>⚙️ Configuration</h2>
  <ol>
    <li>Open <code>anti-viewbot.js</code></li>
    <li>Replace <code>YOUR_YOUTUBE_API_KEY</code> with your actual API key</li>
    <li>Replace <code>YOUR_CHANNEL_ID</code> with the target YouTube channel's ID</li>
    <li>Set <code>DATA_LOG_FILE</code> to your desired log file path</li>
  </ol>

  <h2>Usage</h2>
  <pre><code>node anti-viewbot.js</code></pre>
  <p>This will start the monitoring process and log analysis results every 60 seconds.</p>

  <h2>License</h2>
  <p>This project is licensed under the <a href="https://www.gnu.org/licenses/gpl-3.0.en.html">GNU GPL v3.0</a>.</p>
</body>
</html>
