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

// Upgraded deep scanner to extract hidden media links regardless of Meta or Google formats
function deepFindMediaUrls(obj, extracted = []) {
    if (!obj) return extracted;

    if (typeof obj === 'string') {
        if (obj.startsWith('http://') || obj.startsWith('https://')) {
            // Include googlevideo signatures to capture YouTube Shorts streams accurately
            const isVideo = obj.includes('.mp4') || obj.includes('mp4=') || obj.includes('/v/') || obj.includes('video') || obj.includes('googlevideo.com');
            const isImage = obj.includes('.jpg') || obj.includes('.jpeg') || obj.includes('.png') || obj.includes('.webp') || obj.includes('image');
            
            if (isVideo || isImage) {
                extracted.push({
                    type: isVideo ? 'video' : 'image',
                    url: obj.replace(/\\u0026/g, '&')
                });
            }
        }
    } else if (Array.isArray(obj)) {
        for (const element of obj) {
            deepFindMediaUrls(element, extracted);
        }
    } else if (typeof obj === 'object') {
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                deepFindMediaUrls(obj[key], extracted);
            }
        }
    }
    return extracted;
}

async function fetchMediaViaAllInOneAPI(targetMediaUrl) {
    if (!RAPIDAPI_KEY) {
        throw new Error("RapidAPI Key configuration missing. Please add RAPIDAPI_KEY inside Render.");
    }

    console.log(`[Multi-Downloader] Processing API fetch for: ${targetMediaUrl}`);

    const response = await axios.get('https://rapidapi.com', {
        params: { url: targetMediaUrl },
        headers: {
            'x-rapidapi-key': RAPIDAPI_KEY,
            'x-rapidapi-host': '://rapidapi.com'
        },
        timeout: 35000
    });

    const data = response.data;
    if (!data) throw new Error("Empty payload data received from the downloader API endpoint.");

    console.log("[Raw Downloader Data Stream Debug]:", JSON.stringify(data));

    let mediaResults = [];

    // Approach A: Check specific key parameters from the API documentation
    if (data.type === 'album' && Array.isArray(data.items)) {
        mediaResults = data.items.map(item => ({
            type: item.type === 'video' ? 'video' : 'image',
            url: item.download_url || item.url
        }));
    } else if (Array.isArray(data.url)) {
        mediaResults = data.url.map(item => {
            const urlStr = item.url || item.download_url || (typeof item === 'string' ? item : null);
            const isVid = item.type === 'video' || (urlStr && (urlStr.includes('.mp4') || urlStr.includes('googlevideo.com')));
            return {
                type: isVid ? 'video' : 'image',
                url: urlStr
            };
        });
    } else if (data.download_url || data.url) {
        const directLink = data.download_url || data.url;
        if (typeof directLink === 'string') {
            const isVid = data.type === 'video' || directLink.includes('.mp4') || directLink.includes('googlevideo.com') || targetMediaUrl.includes('youtube.com') || targetMediaUrl.includes('youtu.be');
            mediaResults.push({ type: isVid ? 'video' : 'image', url: directLink });
        }
    }

    // Approach B: Ultimate Fallback regex scanner if strings are uniquely nested
    if (mediaResults.length === 0) {
        console.log("[Scanner] Strict keys empty. Launching deep layout scanner node...");
        mediaResults = deepFindMediaUrls(data);
    }

    // Filter duplicates and malformed parameters cleanly
    const seenUrls = new Set();
    return mediaResults.filter(item => {
        if (!item.url || typeof item.url !== 'string') return false;
        // YouTube parameters are highly dynamic, split signature fields to de-duplicate
        const baseSignature = item.url.split('?');
        if (seenUrls.has(baseSignature)) return false;
        seenUrls.add(baseSignature);
        return true;
    });
}

// Unified Download API Endpoint Gateway
app.post('/api/download', async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'Please provide a valid URL link.' });

    try {
        const media = await fetchMediaViaAllInOneAPI(url);
        return res.json({ success: true, media });
    } catch (error) {
        console.error(`Download Endpoint Error:`, error.message);
        return res.status(500).json({ error: error.message });
    }
});

// Direct storage proxy download stream pipeline tunnel
app.get('/api/proxy-download', async (req, res) => {
    const targetMediaUrl = req.query.url;
    const clientFileName = req.query.filename || 'download.mp4';

    if (!targetMediaUrl) return res.status(400).send('Missing download parameters.');

    try {
        console.log(`Piping media byte streams down to PC file folder...`);
        const cdnResponse = await axios({
            method: 'get',
            url: targetMediaUrl,
            responseType: 'stream',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        res.setHeader('Content-Disposition', `attachment; filename="${clientFileName}"`);
        res.setHeader('Content-Type', cdnResponse.headers['content-type'] || 'application/octet-stream');
        cdnResponse.data.pipe(res);
    } catch (error) {
        console.error('File stream pipeline failure:', error.message);
        res.status(500).send('Could not bundle media bytes into direct storage layout.');
    }
});

app.listen(PORT, () => {
    console.log(`Server successfully initialized and running on port ${PORT}`);
});
