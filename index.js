const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// The base URL of the original HTTP stream
// Example: 'http://source-stream.com/live'
const TARGET_BASE_URL = 'http://mains.services'; // <--- CHANGE THIS

app.get('/*.(m3u|m3u8)', async (req, res) {
    const playlistPath = req.path;
    const targetUrl = `${TARGET_BASE_URL}${playlistPath}`;

    try {
        console.log(`Fetching playlist: ${targetUrl}`);
        const response = await axios.get(targetUrl, { responseType: 'text' });

        // IMPORTANT: Rewrite the playlist content
        // This replaces segment URLs (e.g., 'segment1.ts') with URLs pointing back to our proxy
        const myProxyUrl = `${req.protocol}://${req.get('host')}`;
        const rewrittenPlaylist = response.data.replace(/^(?!#)(.*\.ts)$/gm, `${myProxyUrl}/$1`);

        res.set('Content-Type', 'application/vnd.apple.mpegurl');
        res.send(rewrittenPlaylist);
    } catch (error) {
        console.error('Error fetching M3U8 playlist:', error.message);
        res.status(500).send('Error fetching M3U8 playlist.');
    }
});

app.get('/*.ts', async (req, res) => {
    const segmentPath = req.path;
    const targetUrl = `${TARGET_BASE_URL}${segmentPath}`;

    try {
        console.log(`Fetching segment: ${targetUrl}`);
        const response = await axios.get(targetUrl, { responseType: 'stream' });
        
        res.set('Content-Type', 'video/mp2t');
        response.data.pipe(res); // Pipe the video data directly to the client
    } catch (error) {
        console.error('Error fetching TS segment:', error.message);
        res.status(500).send('Error fetching TS segment.');
    }
});

app.listen(PORT, () => {
    console.log(`M3U8 Proxy server is running on port ${PORT}`);
});
