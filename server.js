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

async function fetchMediaViaRapidAPI(instagramUrl) {
    if (!RAPIDAPI_KEY) {
        throw new Error("RapidAPI Key configuration missing. Please add RAPIDAPI_KEY inside Render.");
    }

    // Clean URL query parameters out to standardize data routing
    const targetUrl = instagramUrl.split('?')[0];

    console.log(`Bypassing scraper blockades. Routing connection query via RapidAPI layer for: ${targetUrl}`);

    // Build the specific form-data configuration payload expected by the API endpoint
    const formParams = new URLSearchParams();
    formParams.append('url', targetUrl);

    const response = await axios.post('https://instagram-video-downloader13.p.rapidapi.com/index.php', formParams, {
        headers: {
            'x-rapidapi-key': RAPIDAPI_KEY,
            'x-rapidapi-host': 'instagram-video-downloader13.p.rapidapi.com',
            'content-type': 'application/x-www-form-urlencoded'
        },
        timeout: 25000
    });

    const data = response.data;
    
    // Check if the endpoint explicitly rejected validation structures
    if (!data || data.status !== 'success') {
        throw new Error(data.message || "The network engine failed to pull active public media assets for this URL.");
    }

    let mediaResults = [];

    // Map single files or nested media items depending on what the API outputs
    if (Array.isArray(data.media) && data.media.length > 0) {
        mediaResults = data.media.map(item => {
            const isVid = item.type === 'video' || item.url.includes('.mp4');
            return {
                type: isVid ? 'video' : 'image',
                url: item.url
            };
        });
    } else if (data.url) {
        const isVid = data.url.includes('.mp4');
        mediaResults.push({
            type: isVid ? 'video' : 'image',
            url: data.url
        });
    }

    if (mediaResults.length === 0) {
        throw new Error("Extraction complete, but no direct video or graphic links were found.");
    }

    return mediaResults;
}

// Main Endpoint Gateway
app.post('/api/download', async (req, res) => {
    const { url } = req.body;
    if (!url || (!url.includes('instagram.com') && !url.includes('instagr.am'))) {
        return res.status(400).json({ error: 'Please provide a valid Instagram link.' });
    }

    try {
        const media = await fetchMediaViaRapidAPI(url);
        return res.json({ success: true, media });
    } catch (error) {
        console.error(`RapidAPI Execution Failure:`, error.message);
        return res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server successfully initialized and running on port ${PORT}`);
});
