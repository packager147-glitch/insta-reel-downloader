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

// High-success extraction utilizing the direct ApiDojo high-bypass core framework
async function fetchInstagramMedia(url) {
    if (!APIFY_TOKEN) {
        throw new Error("API Token missing. Please check your APIFY_TOKEN key configuration inside Render.");
    }
    
    // Target the specific ApiDojo premium scraper API runner layer
    const targetApiUrl = "https://apify.com";

    console.log(`Routing optimized ApiDojo framework request for URL: ${url}`);
    
    // The ApiDojo scraper uses the 'posts' target query mode for specific direct URLs
    const response = await axios.post(
        targetApiUrl,
        {
            "directUrls": [url],
            "resultsType": "details"
        },
        { 
            params: { token: APIFY_TOKEN },
            headers: { 'Content-Type': 'application/json' },
            timeout: 60000 
        }
    );

    const items = response.data;
    if (!items || !Array.isArray(items) || items.length === 0) {
        throw new Error("No data returned from high-bypass engine. Confirm the account profile is entirely public.");
    }

    const postData = items[0]; // Isolate the primary container data node object
    let mediaResults = [];

    // Extract dynamic variations from ApiDojo object schema mapping
    if (postData.childPosts && Array.isArray(postData.childPosts) && postData.childPosts.length > 0) {
        // Scenario A: Carousel Post layouts
        mediaResults = postData.childPosts.map(child => {
            return {
                type: (child.isVideo || child.videoUrl) ? 'video' : 'image',
                url: child.videoUrl || child.displayUrl || child.imageUrl
            };
        });
    } else if (postData.isVideo || postData.videoUrl) {
        // Scenario B: Single Video / Reel
        mediaResults.push({
            type: 'video',
            url: postData.videoUrl || postData.displayUrl
        });
    } else if (postData.displayUrl || postData.imageUrl) {
        // Scenario C: Single Image Post
        mediaResults.push({
            type: 'image',
            url: postData.displayUrl || postData.imageUrl
        });
    }

    // Filter out missing strings or malformed properties cleanly
    const finalCleaned = mediaResults.filter(item => item.url && item.url !== 'undefined');

    if (finalCleaned.length === 0) {
        throw new Error("Extraction complete, but failed to locate raw media links inside the payload block.");
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
        const media = await fetchInstagramMedia(url);
        return res.json({ success: true, media });
    } catch (error) {
        console.error(`ApiDojo Processing Failed:`, error.message);
        return res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server successfully initialized and running on port ${PORT}`);
});
