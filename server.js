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

// Central parsing function utilizing Apify's Premium Core Post Scraper
async function fetchInstagramMedia(url) {
    if (!APIFY_TOKEN) {
        throw new Error("API Token missing. Please check your APIFY_TOKEN key configuration inside Render.");
    }
    
    // Clean the URL structure to ensure consistency
    let cleanUrl = url.split('?')[0];
    if (!cleanUrl.endsWith('/')) cleanUrl += '/';

    // Target the premium core post scraper runner endpoint
    const targetApiUrl = "https://apify.com";

    console.log(`Routing premium core high-bypass scraper request for URL: ${cleanUrl}`);
    
    // The core actor takes an array of direct URLs and isolates data points
    const response = await axios.post(
        targetApiUrl,
        {
            "directUrls": [cleanUrl],
            "resultsType": "details"
        },
        { 
            params: { token: APIFY_TOKEN },
            headers: { 'Content-Type': 'application/json' },
            timeout: 60000 // Extended timeout to allow proxy handshakes to complete
        }
    );

    const datasetItems = response.data;
    if (!datasetItems || !Array.isArray(datasetItems) || datasetItems.length === 0) {
        throw new Error("Instagram blocked the scraper connection pool. Please try extraction again in a moment.");
    }

    // Extract the primary data node block
    const postData = datasetItems[0];
    let mediaResults = [];

    // Case 1: Carousel / Multi-slide posts
    if (postData.childPosts && Array.isArray(postData.childPosts) && postData.childPosts.length > 0) {
        mediaResults = postData.childPosts.map(child => {
            const isVid = child.isVideo || !!child.videoUrl;
            return {
                type: isVid ? 'video' : 'image',
                url: child.videoUrl || child.displayUrl
            };
        });
    } 
    // Case 2: Single Reel or Video Post
    else if (postData.isVideo || postData.videoUrl) {
        mediaResults.push({
            type: 'video',
            url: postData.videoUrl || postData.displayUrl
        });
    } 
    // Case 3: Single Image / Photo Post
    else if (postData.displayUrl || postData.imageUrl) {
        mediaResults.push({
            type: 'image',
            url: postData.displayUrl || postData.imageUrl
        });
    }

    // Clean up empty parameters and deduplicate the extracted link strings
    const finalCleaned = mediaResults.filter(item => item.url);

    if (finalCleaned.length === 0) {
        throw new Error("Could not extract any direct media links from the post metadata.");
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
        console.error(`Premium Scraper Failed:`, error.message);
        return res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server successfully initialized and running on port ${PORT}`);
});
