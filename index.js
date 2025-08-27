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

    if (requestedPath === streamConfig.alias) {
        originalUrl = streamConfig.source;
    } else {
        const chunkName = requestedPath.substring(streamConfig.alias.length).replace(/^\//, '');
        const sourceBasePath = streamConfig.source.substring(0, streamConfig.source.lastIndexOf('/') + 1);
        originalUrl = sourceBasePath + chunkName;
    }
    
    const sourceHost = sourceBaseUrl.host;
    const sourceOrigin = sourceBaseUrl.origin;

    console.log(`[INFO] Request for: ${requestedPath} -> Fetching source: ${originalUrl}`);

    try {
        const headers = {
            'Host': sourceHost,
            'User-Agent': 'VLC/3.0.20 LibVLC/3.0.20',
            'Referer': sourceOrigin + '/',
            'Accept': '*/*',
        };
        
        const fetchOptions = { method: 'GET', headers: headers };

        console.log(`[INFO] Applying proxy for domain: ${sourceHost}`);
        const proxyUrl = `http://${process.env.PROXY_USERNAME}:${process.env.PROXY_PASSWORD}@${process.env.PROXY_HOST}:${process.env.PROXY_PORT}`;
        if (process.env.PROXY_HOST) {
            fetchOptions.dispatcher = new Agent({ connect: { proxy: new URL(proxyUrl) } });
        }

        const response = await fetch(originalUrl, fetchOptions);

        if (!response.ok) {
            throw new Error(`Upstream server responded with status: ${response.status}`);
        }

        const contentType = response.headers.get('content-type') || '';

        if (contentType.includes('application/x-mpegurl') || contentType.includes('application/vnd.apple.mpegurl')) {
            console.log('[INFO] Playlist detected. Rewriting URLs...');
            let playlistText = await response.text();
            
            // --- THIS IS THE NEW DIAGNOSTIC LOG ---
            console.log('--- START PLAYLIST CONTENT ---');
            console.log(playlistText);
            console.log('--- END PLAYLIST CONTENT ---');
            // --- END OF DIAGNOSTIC LOG ---

            const lines = playlistText.split('\n');
            const rewrittenLines = lines.map(line => {
                line = line.trim();
                if (line && !line.startsWith('#')) {
                    return `${streamConfig.alias}/${line.replace(/^\//, '')}`;
                }
                return line;
            });
            
            const rewrittenPlaylist = rewrittenLines.join('\n');
            res.set('Content-Type', contentType);
            res.send(rewrittenPlaylist);

        } else {
            console.log(`[INFO] Video chunk or other content detected (${contentType}). Piping directly.`);
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
