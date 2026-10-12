const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Retrieve your free authentication key loaded inside your Render Environment panel
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || "";

async function fetchMediaViaAllInOneAPI(instagramUrl) {
    if (!RAPIDAPI_KEY) {
        throw new Error("RapidAPI Key configuration missing. Please add RAPIDAPI_KEY inside Render.");
    }

    console.log(`[FastSaver] Routing query to: ${instagramUrl}`);

    // GET request to /fetch with encoded URL parameters per official documentation mapping rules
    const response = await axios.get('https://rapidapi.com', {
        params: { url: instagramUrl },
        headers: {
            'x-rapidapi-key': RAPIDAPI_KEY,
            'x-rapidapi-host': 'instagram-tiktok-youtube-downloader.p.rapidapi.com'
        },
        timeout: 30000 // 30 seconds execution limit
    });

    const data = response.data;
    
    // Log the structure directly inside your Render console to completely stop guesswork
    console.log("[FastSaver Response Payload Summary]:", JSON.stringify(data));

    if (!data) {
        throw new Error("Empty response received from the API endpoint wrapper.");
    }

    let mediaResults = [];

    // Target the primary payload collection array (FastSaver dynamic key structures)
    const targetArray = data.url || data.items || data.album;

    if (Array.isArray(targetArray) && targetArray.length > 0) {
        mediaResults = targetArray.map(item => {
            // Unpack dynamic variable properties safely
            const directUrl = item.download_url || item.url || (typeof item === 'string' ? item : null);
            const isVid = item.type === 'video' || (directUrl && directUrl.includes('.mp4'));
            return {
                type: isVid ? 'video' : 'image',
                url: directUrl
            };
        });
    } 
    // Fallback Scenario B: Single direct output parameters at root object levels
    else if (data.download_url || data.url) {
        const directUrl = data.download_url || (typeof data.url === 'string' ? data.url : null);
        if (directUrl) {
            const isVid = data.type === 'video' || directUrl.includes('.mp4');
            mediaResults.push({
                type: isVid ? 'video' : 'image',
                url: directUrl
            });
        }
    }

    // Filter out items that resolved without a direct source URL link string
    const finalCleaned = mediaResults.filter(item => item.url && item.url !== 'undefined');

    if (finalCleaned.length === 0) {
        throw new Error("The API processed smoothly but our server script couldn't isolate the download fields inside the JSON block. Check your Render logs.");
    }

    return finalCleaned;
}

// 1. Unified Metadata Retrieval API Endpoint
app.post('/api/download', async (req, res) => {
    const { url } = req.body;
    if (!url || (!url.includes('instagram.com') && !url.includes('instagr.am'))) {
        return res.status(400).json({ error: 'Please provide a valid Instagram link.' });
    }

    try {
        const media = await fetchMediaViaAllInOneAPI(url);
        return res.json({ success: true, media });
    } catch (error) {
        console.error(`FastSaver Processing Failure:`, error.message);
        return res.status(500).json({ error: error.message });
    }
});

// 2. FILE PROXY TUNNEL: Pulls raw file bytes down onto server and pipes them as attachment to PC downloads folder
app.get('/api/proxy-download', async (req, res) => {
    const targetMediaUrl = req.query.url;
    const clientFileName = req.query.filename || 'instagram_download.mp4';

    if (!targetMediaUrl) {
        return res.status(400).send('Missing download source URL parameter.');
    }

    try {
        console.log(`Streaming file payload from CDN source: ${targetMediaUrl}`);
        
        // Fetch raw asset byte data directly from Facebook CDN as a stream
        const cdnResponse = await axios({
            method: 'get',
            url: targetMediaUrl,
            responseType: 'stream',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        // Set attachment layouts to force local file generation instead of web routing
        res.setHeader('Content-Disposition', `attachment; filename="${clientFileName}"`);
        res.setHeader('Content-Type', cdnResponse.headers['content-type'] || 'application/octet-stream');

        // Pipe streaming incoming data seamlessly straight into browser response down onto computer drive
        cdnResponse.data.pipe(res);

    } catch (error) {
        console.error('Proxy attachment pipeline stream failure:', error.message);
        res.status(500).send('Could not package file bytes into attachment stream.');
    }
});

app.listen(PORT, () => {
    console.log(`Server successfully initialized and running on port ${PORT}`);
});
