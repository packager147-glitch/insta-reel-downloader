const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Secure token loaded via the Render Environment configuration panel
const APIFY_TOKEN = process.env.APIFY_TOKEN || ""; 

// High-success extraction function utilizing the SnapCDN API actor routing framework
async function fetchInstagramMedia(url) {
    if (!APIFY_TOKEN) {
        throw new Error("API Token missing. Please check your APIFY_TOKEN key configuration inside Render.");
    }
    
    // Target the specific SnapCDN API endpoint structure
    const targetApiUrl = `https://elis--instagram-downloader-api.apify.actor/api/v1/download`;

    console.log(`Routing optimized SnapCDN API query request for URL: ${url}`);
    
    const response = await axios.get(targetApiUrl, {
        params: { url: url },
        headers: { 
            'Authorization': `Bearer ${APIFY_TOKEN}`,
            'Content-Type': 'application/json'
        },
        timeout: 45000 // 45-second connection execution constraint
    });

    const data = response.data;
    
    if (!data || data.status !== "success" || !Array.isArray(data.result) || data.result.length === 0) {
        throw new Error("The API engine could not find any active public links for this URL.");
    }

    // Map SnapCDN payload schema keys directly to the frontend's expected schema
    const mediaResults = data.result.map(item => {
        // Evaluate media layout signature variables cleanly
        const isVideoType = item.type === 'video' || item.url.includes('.mp4') || item.url.includes('mp4=');
        return {
            type: isVideoType ? 'video' : 'image',
            url: item.url
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
        const media = await fetchInstagramMedia(url);
        return res.json({ success: true, media });
    } catch (error) {
        console.error(`SnapCDN Extraction Failed:`, error.message);
        return res.status(500).json({ 
            error: error.message || 'Failed to parse media structures from the targeted network stream.' 
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server successfully initialized and running on port ${PORT}`);
});
