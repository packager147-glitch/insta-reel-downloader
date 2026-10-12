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

// High-success extraction function utilizing the corrected ApiDojo workflow input mapping
async function fetchInstagramMedia(url) {
    if (!APIFY_TOKEN) {
        throw new Error("API Token missing. Please check your APIFY_TOKEN key configuration inside Render.");
    }
    
    // Exact sync runner API endpoint route for the ApiDojo Instagram Scraper API
    const targetApiUrl = "https://apify.com";

    console.log(`Routing optimized ApiDojo framework request for URL: ${url}`);
    
    // Correct input mapping: ApiDojo expects 'startUrls' for target direct links
    const response = await axios.post(
        targetApiUrl,
        {
            "startUrls": [url],
            "maxItems": 1
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

    // Isolate the main post metadata item object node from the returned array collection
    const postData = items[0]; 
    let mediaResults = [];

    // 1. Check for Carousel Post layouts (Multiple images or videos side-by-side)
    if (postData.childPosts && Array.isArray(postData.childPosts) && postData.childPosts.length > 0) {
        mediaResults = postData.childPosts.map(child => {
            const isVid = child.isVideo || !!child.videoUrl;
            return {
                type: isVid ? 'video' : 'image',
                url: child.videoUrl || child.displayUrl || child.imageUrl
            };
        });
    } 
    // 2. Check for single Video / Reel formats
    else if (postData.isVideo || postData.videoUrl) {
        mediaResults.push({
            type: 'video',
            url: postData.videoUrl || postData.displayUrl
        });
    } 
    // 3. Check for standalone single Photo/Image Post formats
    else if (postData.displayUrl || postData.imageUrl) {
        mediaResults.push({
            type: 'image',
            url: postData.displayUrl || postData.imageUrl
        });
    }

    // Filter out missing properties and remove tracking spaces
    const finalCleaned = mediaResults.filter(item => item.url);

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
