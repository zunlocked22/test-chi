const express = require('express');
const axios = require('axios');
const cors = require('cors'); // <-- Ensures this is here

const app = express();
const PORT = process.env.PORT || 3000;

// IMPORTANT: Enable CORS for all routes. This is the fix.
app.use(cors()); // <-- Ensures this is here and in the right place

const TARGET_BASE_URL = 'http://mains.services';

// Playlist route
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
        const rewrittenPlaylist = response.data.replace(/^\/.+$/gm, (match) => `${myProxyUrl}${match}`);
        
        console.log('Playlist rewritten successfully. Sending to client.');
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
app.get('/*.ts', async (req, res) => {
    const segmentPath = req.path;
    const targetUrl = `${TARGET_BASE_URL}${segmentPath}`;

    try {
        console.log(`Fetching segment: ${targetUrl}`);
        const response = await axios.get(targetUrl, { responseType: 'stream' });
        
        res.set('Content-Type', 'video/mp2t');
        response.data.pipe(res);
    } catch (error) {
        console.error('Error fetching TS segment:', error.message);
        res.status(500).send('Error fetching TS segment.');
    }
});

// You might also need a general route for segments without the .ts extension
app.get('/play/hls/*', async (req, res) => {
    const segmentPath = req.path;
    const targetUrl = `${TARGET_BASE_URL}${segmentPath}`;

    try {
        console.log(`Fetching HLS segment: ${targetUrl}`);
        const response = await axios.get(targetUrl, { responseType: 'stream' });
        
        // The server might not specify the content-type, so we set it
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
