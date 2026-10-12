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

    console.log(`Routing corrected GET query to FastSaver endpoint for: ${instagramUrl}`);

    const response = await axios.get('https://rapidapi.com', {
        params: { url: instagramUrl },
        headers: {
            'x-rapidapi-key': RAPIDAPI_KEY,
            'x-rapidapi-host': '://rapidapi.com'
        },
        timeout: 30000
    });

    const data = response.data;
    if (!data) throw new Error("Empty response received from the API endpoint wrapper.");

    let mediaResults = [];

    if (data.type === 'album' && Array.isArray(data.items)) {
        mediaResults = data.items.map(item => ({
            type: item.type === 'video' ? 'video' : 'image',
            url: item.download_url
        }));
    } else if (data.type === 'video' && data.download_url) {
        mediaResults.push({ type: 'video', url: data.download_url });
    } else if (data.type === 'image' && data.download_url) {
        mediaResults.push({ type: 'image', url: data.download_url });
    }

    return mediaResults.filter(item => item.url);
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
        console.error(`FastSaver API Processing Fault:`, error.message);
        return res.status(500).json({ error: error.message });
    }
});

// 2. NEW PROXY ROUTE: Downloads data on server and forces direct browser attachment download to PC folder
app.get('/api/proxy-download', async (req, res) => {
    const targetMediaUrl = req.query.url;
    const clientFileName = req.query.filename || 'instagram_download.mp4';

    if (!targetMediaUrl) {
        return res.status(400).send('Missing download source URL parameter.');
    }

    try {
        console.log(`Streaming file payload from CDN source: ${targetMediaUrl}`);
        
        // Fetch raw asset byte data directly from CDN as a stream
        const cdnResponse = await axios({
            method: 'get',
            url: targetMediaUrl,
            responseType: 'stream',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        // Force browser to save file directly instead of opening it
        res.setHeader('Content-Disposition', `attachment; filename="${clientFileName}"`);
        res.setHeader('Content-Type', cdnResponse.headers['content-type'] || 'application/octet-stream');

        // Pipe streaming data seamlessly straight into browser response down onto computer drive
        cdnResponse.data.pipe(res);

    } catch (error) {
        console.error('Proxy attachment pipeline stream failure:', error.message);
        res.status(500).send('Could not package file bytes into attachment stream. Open link manually.');
    }
});

app.listen(PORT, () => {
    console.log(`Server successfully initialized and running on port ${PORT}`);
});
