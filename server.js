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
    
    // Explicit clean URL structure
    const targetApiUrl = "https://apify.com";

    const response = await axios.post(
        targetApiUrl,
        {
            "directUrls": [url],
            "resultsType": "details"
        },
        { 
            params: { token: APIFY_TOKEN }, // Passes token safely as a parameter string
            headers: { 'Content-Type': 'application/json' } 
        }
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

// New Proxy route to fix the "File wasn't available on site" Chrome error
app.get('/api/proxy-download', async (req, res) => {
    const mediaUrl = req.query.url;
    const filename = req.query.filename || 'instagram_media.mp4';

    if (!mediaUrl) {
        return res.status(400).send('Missing media URL parameter.');
    }

    try {
        console.log(`Streaming proxy download for URL: ${mediaUrl}`);
        
        // Fetch the file as an arraybuffer stream from Meta's CDN
        const response = await axios({
            method: 'get',
            url: mediaUrl,
            responseType: 'stream',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        // Force Chrome to treat this as a solid filesystem download file
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', response.headers['content-type'] || 'application/octet-stream');

        // Pipe the internal server incoming bytes directly to the client's browser response
        response.data.pipe(res);

    } catch (error) {
        console.error('Error proxying media download:', error.message);
        res.status(500).send('Could not fetch the media file payload from source.');
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
