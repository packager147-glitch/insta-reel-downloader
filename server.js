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

    console.log(`Routing clean GET query to FastSaver endpoint for: ${instagramUrl}`);

    // Official documentation mapping: GET request to /fetch with encoded URL parameters
    const response = await axios.get('https://instagram-tiktok-youtube-downloader.p.rapidapi.com/fetch', {
        params: { url: instagramUrl },
        headers: {
            'x-rapidapi-key': RAPIDAPI_KEY,
            'x-rapidapi-host': 'instagram-tiktok-youtube-downloader.p.rapidapi.com'
        },
        timeout: 30000 // 30 seconds execution limit
    });

    const data = response.data;
    
    if (!data) {
        throw new Error("Empty response received from the API endpoint wrapper.");
    }

    let mediaResults = [];

    // Scenario A: Carousel Post layouts (Official API structure: type === 'album' containing an items array)
    if (data.type === 'album' && Array.isArray(data.items)) {
        mediaResults = data.items.map(item => ({
            type: item.type === 'video' ? 'video' : 'image',
            url: item.download_url
        }));
    } 
    // Scenario B: Single Video / Reel post format
    else if (data.type === 'video' && data.download_url) {
        mediaResults.push({
            type: 'video',
            url: data.download_url
        });
    } 
    // Scenario C: Single Default Static Image format
    else if (data.type === 'image' && data.download_url) {
        mediaResults.push({
            type: 'image',
            url: data.download_url
        });
    }

    // Filter out items that resolved without a direct source URL link string
    const finalCleaned = mediaResults.filter(item => item.url);

    if (finalCleaned.length === 0) {
        throw new Error("API processed smoothly but could not map active public download URLs from this post type.");
    }

    return finalCleaned;
}

// Unified Download API Endpoint Gateway
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

app.listen(PORT, () => {
    console.log(`Server successfully initialized and running on port ${PORT}`);
});
