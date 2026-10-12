const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || "";

function deepFindMediaUrls(obj, extracted = []) {
    if (!obj) return extracted;
    if (typeof obj === 'string') {
        if (obj.startsWith('http://') || obj.startsWith('https://')) {
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
        for (const element of obj) deepFindMediaUrls(element, extracted);
    } else if (typeof obj === 'object') {
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) deepFindMediaUrls(obj[key], extracted);
        }
    }
    return extracted;
}

async function fetchMediaViaAllInOneAPI(targetMediaUrl) {
    if (!RAPIDAPI_KEY) {
        throw new Error("RapidAPI Key configuration missing. Please add RAPIDAPI_KEY inside Render.");
    }

    console.log(`[Multi-Downloader] Processing API pipeline fetch for: ${targetMediaUrl}`);

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

    let mediaResults = [];

    // Map strict properties if present in API payload
    if (data.type === 'album' && Array.isArray(data.items)) {
        mediaResults = data.items.map(item => ({
            type: item.type === 'video' ? 'video' : 'image',
            url: item.download_url || item.url
        }));
    } else if (Array.isArray(data.url)) {
        mediaResults = data.url.map(item => ({
            type: (item.type === 'video' || (item.url && item.url.includes('.mp4'))) ? 'video' : 'image',
            url: item.url || item.download_url || item
        }));
    } else if (data.download_url || data.url) {
        const directLink = data.download_url || data.url;
        if (typeof directLink === 'string') {
            const isVid = data.type === 'video' || directLink.includes('.mp4') || targetMediaUrl.includes('youtube.com');
            mediaResults.push({ type: isVid ? 'video' : 'image', url: directLink });
        }
    }

    // Fallback regex scanner if properties are nested uniquely by YouTube/TikTok engines
    if (mediaResults.length === 0) {
        mediaResults = deepFindMediaUrls(data);
    }

    const seenUrls = new Set();
    return mediaResults.filter(item => {
        if (!item.url || typeof item.url !== 'string') return false;
        const base = item.url.split('?')[0];
        if (seenUrls.has(base)) return false;
        seenUrls.add(base);
        return true;
    });
}

// Extraction API
app.post('/api/download', async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'Please provide a valid URL link.' });

    try {
        const media = await fetchMediaViaAllInOneAPI(url);
        return res.json({ success: true, media });
    } catch (error) {
        console.error(`Download endpoint error:`, error.message);
        return res.status(500).json({ error: error.message });
    }
});

// Proxy stream delivery to PC downloads folder
app.get('/api/proxy-download', async (req, res) => {
    const targetMediaUrl = req.query.url;
    const clientFileName = req.query.filename || 'download.mp4';

    if (!targetMediaUrl) return res.status(400).send('Missing download stream configurations.');

    try {
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
    console.log(`Multi-downloader core running smoothly on port ${PORT}`);
});
