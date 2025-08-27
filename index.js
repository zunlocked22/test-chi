require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const { Agent } = require('undici'); // Used for proxy support with node-fetch
const app = express();
const PORT = process.env.PORT || 3000;

// ######################################################################
// ###                      YOUR STREAM LIST                          ###
// ######################################################################

const STREAMS = [
    {
        alias: '/kuroba.kaito/channel/aniplus/289181',
        source: 'http://qgvwnqgr.mexamo.xyz:80/live/911FA6VS/2T3C7P57/191846.m3u8',
        type: 'raw'
    },
    {
        alias: '/kuroba.kaito/channel/animax/211181',
        source: 'http://qgvwnqgr.mexamo.xyz:80/live/911FA6VS/2T3C7P57/45057.m3u8',
        type: 'raw'
    },
    {
        alias: '/kuroba.kaito/channel/mbcplusanime/331181',
        source: 'http://qgvwnqgr.mexamo.xyz:80/live/911FA6VS/2T3C7P57/45057.m3u8',
        type: 'raw'
    },
];

// ######################################################################
// ###        NO NEED TO EDIT BELOW THIS LINE (Proxy Logic)           ###
// ######################################################################

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
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
            'Referer': sourceOrigin + '/',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
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

        if (!response.ok) {
            throw new Error(`Upstream server responded with status: ${response.status}`);
        }

        // Pipe the successful response stream back to the user
        response.body.pipe(res);

    } catch (error) {
        console.error(`[ERROR] Failed to fetch stream for ${originalUrl}.`);
        console.error(`[ERROR] Message: ${error.message}`);
        res.status(502).send('Error fetching from the original server.');
    }
});

app.listen(PORT, () => {
    console.log(`Multi-stream proxy server listening on port ${PORT}`);
});
