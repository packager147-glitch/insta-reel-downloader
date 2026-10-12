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
    
    // Exact structural endpoint to trigger the actor container directly
    const targetApiUrl = `https://apify.com`;

    console.log(`Routing optimized SnapCDN API query request for URL: ${url}`);
    
    // The actor expects a POST request with the URL passed inside the JSON payload body
    const response = await axios.post(
        targetApiUrl, 
        {
            "url": url
        }, 
        {
            params: { token: APIFY_TOKEN },
            headers: { 
                'Content-Type': 'application/json'
            },
            timeout: 45000 // 45-second execution constraint
        }
    );

    const dataItems = response.data;
    
    // Check if the dataset items exist or if the array returned empty
    if (!dataItems || !Array.isArray(dataItems) || dataItems.length === 0) {
        throw new Error("The API engine could not find any active public media structures for this URL.");
    }

    // Process the first dataset entry item returned from the run execution array
    const resultItem = dataItems[0];

    if (!resultItem.result || !Array.isArray(resultItem.result) || resultItem.result.length === 0) {
        throw new Error("Extraction complete but no downloadable result links found inside the object block.");
    }

    // Map the internal results payload array directly to your frontend architecture
    const mediaResults = resultItem.result.map(item => {
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
