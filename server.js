const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Fetch the secure token loaded in your Render Environment dashboard panel
const APIFY_TOKEN = process.env.APIFY_TOKEN || ""; 

// Enhanced parsing function to map Apify's dynamic payload structural states
async function fetchInstagramMedia(url) {
    if (!APIFY_TOKEN) {
        throw new Error("API Token missing. Please add your APIFY_TOKEN key inside Render environment variables.");
    }
    
    const targetApiUrl = "https://apify.com";

    // Request full metadata data payload compilation via Apify runner infrastructure
    const response = await axios.post(
        targetApiUrl,
        {
            "directUrls": [url],
            "resultsType": "details"
        },
        { 
            params: { token: APIFY_TOKEN },
            headers: { 'Content-Type': 'application/json' } 
        }
    );

    // Ensure we are working with a valid array object layout structure
    let items = response.data;
    if (!items) throw new Error("Empty response payload received from extraction engine.");
    if (!Array.isArray(items)) items = [items];
    if (items.length === 0) throw new Error("No payload blocks generated. Verify the link is public.");

    // Target the first root data post node returned in the collection
    const postData = items[0];
    let mediaResults = [];

    // Helper function to extract direct content link from variable naming scenarios
    const extractUrl = (obj) => {
        if (!obj) return null;
        return obj.videoUrl || obj.video_url || obj.displayUrl || obj.display_url || obj.imageUrl;
    };

    // Scenario A: Nested Carousel/Child Post Collections (Multi-slide layout)
    if (postData.childPosts && Array.isArray(postData.childPosts) && postData.childPosts.length > 0) {
        mediaResults = postData.childPosts.map(child => {
            const hasVideo = child.isVideo || !!child.videoUrl || !!child.video_url;
            return {
                type: hasVideo ? 'video' : 'image',
                url: extractUrl(child)
            };
        });
    } 
    // Scenario B: Flat Array Image Collections
    else if (postData.images && Array.isArray(postData.images) && postData.images.length > 0) {
        mediaResults = postData.images.map(imgUrl => ({
            type: 'image',
            url: imgUrl
        }));
    }
    // Scenario C: Single Video / Reel / Video Story
    else if (postData.isVideo || postData.videoUrl || postData.video_url) {
        mediaResults.push({
            type: 'video',
            url: extractUrl(postData)
        });
    } 
    // Scenario D: Single Default Standard Graphic Photo/Story
    else if (extractUrl(postData)) {
        mediaResults.push({
            type: 'image',
            url: extractUrl(postData)
        });
    }

    // Filter out items that resolved without a valid CDN source URL string
    let cleanedResults = mediaResults.filter(item => item.url && item.url !== 'undefined');
    
    // Ultimate Fallback: Scrape via RegExp matching if structures shift entirely
    if (cleanedResults.length === 0) {
        const rawString = JSON.stringify(postData);
        const videoMatch = rawString.match(/"videoUrl":"([^"]+)"/) || rawString.match(/"video_url":"([^"]+)"/);
        const imageMatch = rawString.match(/"displayUrl":"([^"]+)"/) || rawString.match(/"display_url":"([^"]+)"/);
        
        if (videoMatch && videoMatch[1]) {
            cleanedResults.push({ type: 'video', url: videoMatch[1].replace(/\\u0026/g, '&') });
        } else if (imageMatch && imageMatch[1]) {
            cleanedResults.push({ type: 'image', url: imageMatch[1].replace(/\\u0026/g, '&') });
        }
    }

    if (cleanedResults.length === 0) {
        throw new Error("No downloadable content detected. The post might be private, expired, or deleted.");
    }

    return cleanedResults;
}

// Unified Download Extraction Request API Gateway Entry Point
app.post('/api/download', async (req, res) => {
    const { url } = req.body;
    if (!url || (!url.includes('instagram.com') && !url.includes('instagr.am'))) {
        return res.status(400).json({ error: 'Please provide a valid Instagram link.' });
    }

    try {
        console.log(`Processing media extraction query request for: ${url}`);
        const media = await fetchInstagramMedia(url);
        return res.json({ success: true, media });
    } catch (error) {
        console.error(`Extraction engine execution failed:`, error.message);
        return res.status(500).json({ error: error.message || 'Failed to extract media content payload structure.' });
    }
});

app.listen(PORT, () => {
    console.log(`Server successfully initialized and running on port ${PORT}`);
});
