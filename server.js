const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const APIFY_TOKEN = process.env.APIFY_TOKEN || ""; 

// Central parsing function using Apify's infrastructure
async function fetchInstagramMedia(url) {
    if (!APIFY_TOKEN) {
        throw new Error("API Token missing. Please add APIFY_TOKEN to Render environment variables.");
    }
    
    // Using a robust, comprehensive Instagram Scraper Actor on Apify
    const response = await axios.post(
        `https://apify.com{APIFY_TOKEN}`,
        {
            "directUrls": [url],
            "resultsType": "details"
        },
        { headers: { 'Content-Type': 'application/json' } }
    );

    const items = response.data;
    if (!items || items.length === 0) {
        throw new Error("No media found. Make sure the post/story is public.");
    }

    const postData = items[0];
    let mediaResults = [];

    // Scenario A: Carousel Post (Multiple images/videos)
    if (postData.childPosts && postData.childPosts.length > 0) {
        mediaResults = postData.childPosts.map(child => ({
            type: child.type || (child.isVideo ? 'video' : 'image'),
            url: child.videoUrl || child.displayUrl
        }));
    } 
    // Scenario B: Single Video (Reel/Video Post/Video Story)
    else if (postData.isVideo || postData.videoUrl) {
        mediaResults.push({
            type: 'video',
            url: postData.videoUrl || postData.displayUrl
        });
    } 
    // Scenario C: Single Image (Standard post or Image Story)
    else {
        mediaResults.push({
            type: 'image',
            url: postData.displayUrl
        });
    }

    return mediaResults;
}

// Unified API Endpoint
app.post('/api/download', async (req, res) => {
    const { url } = req.body;
    if (!url || (!url.includes('instagram.com') && !url.includes('instagr.am'))) {
        return res.status(400).json({ error: 'Please provide a valid Instagram link.' });
    }

    try {
        console.log(`Processing media request for: ${url}`);
        const media = await fetchInstagramMedia(url);
        return res.json({ success: true, media });
    } catch (error) {
        console.error(`Extraction failed:`, error.message);
        return res.status(500).json({ error: error.message || 'Failed to extract media content.' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
