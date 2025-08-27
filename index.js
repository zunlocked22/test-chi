require('dotenv').config();
const express = require('express');
const { Agent } = require('undici');
const { Readable } = require('stream');
const crypto = require('crypto');
const app = express();
const PORT = process.env.PORT || 3000;

const STREAMS = [
    {
        alias: '/kuroba.kaito/channel/aniplus/289181',
        source: 'http://qgvwnqgr.mexamo.xyz:80/live/911FA6VS/2T3C7P57/191846.m3u8',
    },
    // Add other streams here if needed
];

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    next();
});

app.get('/*', async (req, res) => {
    const streamConfig = STREAMS.find(s => req.path.startsWith(s.alias));

    if (!streamConfig) {
        return res.status(404).send('Access Denied: Alias not found.');
    }

    const sourceBaseUrl = new URL(streamConfig.source);
    const requestedPath = req.path;
    let originalUrl;
    
    // --- NEW SESSION MANAGEMENT LOGIC ---
    let sessionId = req.query.sid; // Look for a session ID in the query parameter

    if (requestedPath === streamConfig.alias) {
        originalUrl = streamConfig.source;
        // This is the first request, so we generate a NEW session ID
        sessionId = crypto.randomBytes(8).toString('hex');
    } else {
        if (!sessionId) {
            // If a chunk is requested without a session ID, we can't proceed
            return res.status(400).send("Bad Request: Missing session ID for chunk.");
        }
        const chunkPath = req.path.substring(streamConfig.alias.length);
        originalUrl = sourceBaseUrl.origin + chunkPath;
    }
    
    const sourceHost = sourceBaseUrl.host;
    const sourceOrigin = sourceBaseUrl.origin;

    console.log(`[INFO] Request for: ${requestedPath} -> Fetching source: ${originalUrl}`);

    try {
        const headers = { 'Host': sourceHost, 'User-Agent': 'VLC/3.0.20 LibVLC/3.0.20', 'Referer': sourceOrigin + '/', 'Accept': '*/*' };
        const fetchOptions = { method: 'GET', headers: headers };

        console.log(`[INFO] Applying proxy for domain: ${sourceHost}`);
        console.log(`[INFO] Using sticky session ID: ${sessionId}`);
        
        const proxyUsernameWithSession = `${process.env.PROXY_USERNAME}-sid-${sessionId}`;
        const proxyUrl = `http://${proxyUsernameWithSession}:${process.env.PROXY_PASSWORD}@${process.env.PROXY_HOST}:${process.env.PROXY_PORT}`;
        
        if (process.env.PROXY_HOST) {
            fetchOptions.dispatcher = new Agent({ connect: { proxy: new URL(proxyUrl) } });
        }

        const response = await fetch(originalUrl, fetchOptions);

        if (!response.ok) {
            throw new Error(`Upstream server responded with status: ${response.status}`);
        }

        const contentType = response.headers.get('content-type') || '';

        if (contentType.includes('application/x-mpegurl')) {
            console.log('[INFO] Playlist detected. Rewriting URLs to include session ID...');
            let playlistText = await response.text();
            
            const lines = playlistText.split('\n');
            const rewrittenLines = lines.map(line => {
                line = line.trim();
                if (line && !line.startsWith('#')) {
                    // We now add the session ID as a query parameter for all subsequent requests
                    return `${streamConfig.alias}${line}?sid=${sessionId}`;
                }
                return line;
            });
            
            const rewrittenPlaylist = rewrittenLines.join('\n');
            res.set('Content-Type', contentType);
            res.send(rewrittenPlaylist);

        } else {
            console.log(`[INFO] Video chunk detected. Piping directly.`);
            Readable.fromWeb(response.body).pipe(res);
        }

    } catch (error) {
        console.error(`[ERROR] Failed to fetch stream for ${originalUrl}.`);
        console.error(`[ERROR] Message: ${error.message}`);
        res.status(502).send('Error fetching from the original server.');
    }
});

app.listen(PORT, () => {
    console.log(`Multi-stream proxy server listening on port ${PORT}`);
});
