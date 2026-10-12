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

// High-success extraction utilizing the correct ApiDojo object node structure mapping
async function fetchInstagramMedia(url) {
    if (!APIFY_TOKEN) {
        throw new Error("API Token missing. Please check your APIFY_TOKEN key configuration inside Render.");
    }
    
    // Explicit runtime endpoint for the ApiDojo Instagram Scraper API
    const targetApiUrl = "https://apify.com";

    console.log(`Routing optimized ApiDojo framework request for URL: ${url}`);
    
    // The ApiDojo scraper expects 'startUrls' to target specific direct posts/reels
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
        throw new Error("No data returned from high-bypass engine. Verify that the link is formatted correctly.");
    }

    // ApiDojo returns an array of objects. Isolate the first matching post object node.
    const postData = items[0]; 
    if (!postData) {
        throw new Error("Target post element could not be found inside the API dataset.");
    }

    let mediaResults = [];

    // Helper to prioritize cleaner media extraction variables
    const getCleanUrl = (obj) => {
        return obj.videoUrl || obj.video_url || obj.displayUrl || obj.display_url || obj.imageUrl || obj.url;
    };

    // Scenario A: Carousel Post layouts (Multiple slides)
    if (postData.childPosts && Array.isArray(postData.childPosts) && postData.childPosts.length > 0) {
        mediaResults = postData.childPosts.map(child => {
            const isVid = child.isVideo || !!child.videoUrl || !!child.video_url;
            return {
                type: isVid ? 'video' : 'image',
                url: getCleanUrl(child)
            };
        });
    } 
    // Scenario B: Single Video / Reel post format
    else if (postData.isVideo || postData.videoUrl || postData.video_url) {
        mediaResults.push({
            type: 'video',
            url: getCleanUrl(postData)
        });
    } 
    // Scenario C: Single Default Static Image / Story format
    else if (postData.displayUrl || postData.imageUrl || postData.display_url) {
        mediaResults.push({
            type: 'image',
            url: getCleanUrl(postData)
        });
    }

    // Strip out blank or broken URL fields from collection tracking arrays
    const finalCleaned = mediaResults.filter(item => item.url && item.url !== 'undefined');

    if (finalCleaned.length === 0) {
        // Fallback: Check if there's an images array block in the root item
        if (postData.images && Array.isArray(postData.images) && postData.images.length > 0) {
            return postData.images.map(img => ({ type: 'image', url: img }));
        }
        throw new Error("Extraction complete, but failed to locate direct media links inside the payload object.");
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
