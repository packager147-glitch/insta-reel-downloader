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

    console.log(`Routing clean JSON payload via All-In-One API gateway for: ${instagramUrl}`);

    // This premium engine accepts clean JSON bodies via standard POST requests
    const response = await axios.post(
        'https://rapidapi.com',
        { 
            url: instagramUrl 
        },
        {
            headers: {
                'x-rapidapi-key': RAPIDAPI_KEY,
                'x-rapidapi-host': 'instagram-tiktok-youtube-downloader.p.rapidapi.com',
                'content-type': 'application/json'
            },
            timeout: 30000 // 30 seconds execution limit
        }
    );

    const data = response.data;
    
    // Validate that data objects were successfully unpacked
    if (!data || !data.media || !Array.isArray(data.media) || data.media.length === 0) {
        throw new Error("The API engine could not find any active public media structures for this URL.");
    }

    // Map platform parameters directly to our clean frontend layout rules
    const mediaResults = data.media.map(item => {
        // Evaluates item types directly (video, image)
        const isVid = item.type === 'video' || (item.url && item.url.includes('.mp4'));
        return {
            type: isVid ? 'video' : 'image',
            url: item.url || item.download_url
        };
    });

    return mediaResults;
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
        console.error(`API Execution Failure:`, error.message);
        return res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server successfully initialized and running on port ${PORT}`);
});
