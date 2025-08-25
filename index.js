const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

const TARGET_BASE_URL = 'https://jungotvstream.chanall.tv';

// Spoof headers to make our request look like a real browser
const BROWSER_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
    'Referer': `${TARGET_BASE_URL}/` // Pretend the request is coming from their own site
};

// Playlist route
app.get('/*.(m3u|m3u8)', async (req, res) => {
    const playlistPath = req.path;
    const targetUrl = `${TARGET_BASE_URL}${playlistPath}`;
    console.log(`Attempting to fetch playlist: ${targetUrl}`);

    try {
        const response = await axios.get(targetUrl, { 
            responseType: 'text',
            timeout: 10000,
            headers: BROWSER_HEADERS // Use the spoofed headers
        });
        console.log('SUCCESS: Playlist content received from source.');

        const myProxyUrl = `https://${req.get('host')}`;
        const rewrittenPlaylist = response.data.replace(/^\/.+$/gm, (match) => `${myProxyUrl}${match}`);
        
        console.log(`Rewriting segments to use base URL: ${myProxyUrl}`);
        res.set('Content-Type', 'application/vnd.apple.mpegurl');
        res.send(rewrittenPlaylist);
    } catch (error) {
        console.error('!!! ERROR FETCHING PLAYLIST !!!');
        if (error.response) {
            console.error('Status:', error.response.status);
        } else {
            console.error('General Error:', error.message);
        }
        res.status(500).send('Error fetching M3U8 playlist.');
    }
});

// Video Segment route
app.get('/play/hls/*', async (req, res) => {
    const segmentPath = req.path;
    const targetUrl = `${TARGET_BASE_URL}${segmentPath}`;

    try {
        console.log(`Fetching HLS segment: ${targetUrl}`);
        const response = await axios.get(targetUrl, { 
            responseType: 'stream',
            headers: BROWSER_HEADERS // Use the spoofed headers
        });
        
        res.set('Content-Type', 'video/mp2t'); 
        response.data.pipe(res);
    } catch (error) {
        console.error('Error fetching HLS segment:', error.message);
        res.status(500).send('Error fetching HLS segment.');
    }
});

app.listen(PORT, () => {
    console.log(`M3U8 Proxy server is running on port ${PORT}`);
});
