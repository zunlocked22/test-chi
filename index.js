const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// The base URL of the original HTTP stream
// Example: 'http://source-stream.com/live'

// ... (keep your express, axios, cors imports and app.use(cors()) line) ...

const TARGET_BASE_URL = 'http://mains.services';

// REPLACE YOUR OLD .m3u/.m3u8 ROUTE WITH THIS NEW ONE
// REPLACE YOUR .m3u/.m3u8 ROUTE WITH THIS FINAL, CORRECTED VERSION
app.get('/*.(m3u|m3u8)', async (req, res) => {
    const playlistPath = req.path;
    const targetUrl = `${TARGET_BASE_URL}${playlistPath}`;

    console.log(`Attempting to fetch playlist: ${targetUrl}`);

    try {
        const response = await axios.get(targetUrl, { 
            responseType: 'text',
            timeout: 10000 
        });

        console.log('SUCCESS: Playlist content received from source.');

        const myProxyUrl = `${req.protocol}://${req.get('host')}`;
        
        // --- THIS IS THE CORRECTED LINE ---
        // It now finds any line that starts with a '/' and rewrites it.
        const rewrittenPlaylist = response.data.replace(/^\/.+$/gm, (match) => `${myProxyUrl}${match}`);

        console.log('Playlist rewritten successfully. Sending to client.');

        res.set('Content-Type', 'application/vnd.apple.mpegurl');
        res.send(rewrittenPlaylist);

    } catch (error) {
        // ... your error handling code can stay the same ...
        console.error('!!! ERROR FETCHING PLAYLIST !!!');
        if (error.response) {
            console.error('Data:', error.response.data);
            console.error('Status:', error.response.status);
            console.error('Headers:', error.response.headers);
        } else if (error.request) {
            console.error('Request Error: No response received.', error.request);
        } else {
            console.error('General Error:', error.message);
        }
        res.status(500).send('Error fetching M3U8 playlist.');
    }
});
// Keep your app.get('/*.ts', ...) route and app.listen(...) the same
// ...

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
