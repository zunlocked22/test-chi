require('dotenv').config();
const express = require('express');
const { Agent } = require('undici');
const { Readable } = require('stream');
const app = express();
const PORT = process.env.PORT || 3000;

const STREAMS = [
    {
        alias: '/kuroba.kaito/channel/aniplus/289181',
        source: 'http://qgvwnqgr.mexamo.xyz:80/live/911FA6VS/2T3C7P57/191846.m3u8',
        type: 'raw'
    },
    // ... other streams
];

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    next();
});

app.get('/*', async (req, res) => {
    const streamConfig = STREAMS.find(s => s.alias === req.path);

    if (!streamConfig) {
        return res.status(404).send('Access Denied: Alias not found.');
    }

    const originalUrl = streamConfig.source;
    const sourceHost = new URL(originalUrl).host;
    const sourceOrigin = new URL(originalUrl).origin;

    console.log(`[INFO] Request for alias: ${streamConfig.alias} -> Source: ${originalUrl}`);

    try {
        const headers = {
            'Host': sourceHost,
            'User-Agent': 'VLC/3.0.20 LibVLC/3.0.20', 
            'Referer': sourceOrigin + '/',
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.5'
        };
        
        let fetchOptions = {
            method: 'GET',
            headers: headers,
        };

        if (originalUrl.includes('qgvwnqgr.mexamo.xyz')) {
            console.log(`[INFO] Applying proxy for domain: qgvwnqgr.mexamo.xyz`);
            
            const proxyUrl = `http://${process.env.PROXY_USERNAME}:${process.env.PROXY_PASSWORD}@${process.env.PROXY_HOST}:${process.env.PROXY_PORT}`;
            
            if (process.env.PROXY_HOST) {
                fetchOptions.dispatcher = new Agent({
                    connect: {
                        proxy: new URL(proxyUrl),
                    },
                });
            } else {
                 console.log('[WARNING] PROXY_HOST environment variable not set. Proxy will not be used.');
            }
        }
        
        const response = await fetch(originalUrl, fetchOptions);

        // --- CRITICAL LOGGING ADDED HERE ---
        console.log(`[DEBUG] Upstream response status: ${response.status}`);
        console.log(`[DEBUG] Upstream response headers:`, JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2));
        // --- END OF CRITICAL LOGGING ---

        if (!response.ok) {
            console.error(`[ERROR] Upstream server responded with non-OK status: ${response.status}`);
            throw new Error(`Upstream server responded with status: ${response.status}`);
        }
        
        Readable.fromWeb(response.body).pipe(res);

    } catch (error) {
        console.error(`[ERROR] Failed to fetch stream for ${originalUrl}.`);
        console.error(`[ERROR] Message: ${error.message}`);
        res.status(502).send('Error fetching from the original server.');
    }
});

app.listen(PORT, () => {
    console.log(`Multi-stream proxy server listening on port ${PORT}`);
});
