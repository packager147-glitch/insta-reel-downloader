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

// Deep Search helper to find all Instagram CDN URLs inside a complex object
function extractCdnUrls(obj, foundUrls = new Set()) {
    if (!obj) return foundUrls;

    if (typeof obj === 'string') {
        // Look for typical Instagram CDN patterns
        if (obj.includes('.cdninstagram.com') && (obj.startsWith('http://') || obj.startsWith('https://'))) {
            // Clean unicode variants if present
            const cleanUrl = obj.replace(/\\u0026/g, '&');
            foundUrls.add(cleanUrl);
        }
    } else if (Array.isArray(obj)) {
        for (const item of obj) {
            extractCdnUrls(item, foundUrls);
        }
    } else if (typeof obj === 'object') {
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                extractCdnUrls(obj[key], foundUrls);
            }
        }
    }
    return foundUrls;
}

// Extraction function using Apify's infrastructure
async function fetchInstagramMedia(url) {
    if (!APIFY_TOKEN) {
        throw new Error("API Token missing. Please add your APIFY_TOKEN key inside Render environment variables.");
    }
    
    const targetApiUrl = "https://apify.com";

    console.log(`Sending API request to Apify for URL: ${url}`);
    
    const response = await axios.post(
        targetApiUrl,
        {
            "directUrls": [url],
            "resultsType": "details"
        },
        { 
            params: { token: APIFY_TOKEN },
            headers: { 'Content-Type': 'application/json' },
            timeout: 60000 // 60 seconds timeout for large story/carousel payloads
        }
    );

    const dataPayload = response.data;
    if (!dataPayload || (Array.isArray(dataPayload) && dataPayload.length === 0)) {
        throw new Error("Empty response from Apify scraper. Check if the link is correct.");
    }

    // 1. Run our deep search scanner to extract all media assets
    const uniqueUrls = Array.from(extractCdnUrls(dataPayload));
    
    if (uniqueUrls.length === 0) {
        throw new Error("No downloadable content detected. The post might be private, expired, or deleted.");
    }

    // 2. Classify links into videos and images based on their file extensions/parameters
    const mediaResults = uniqueUrls.map(cdnUrl => {
        // Instagram videos usually contain .mp4, mp4=true, or specific path names
        const isVideo = cdnUrl.includes('.mp4') || cdnUrl.includes('mp4=') || cdnUrl.includes('/v/');
        return {
            type: isVideo ? 'video' : 'image',
            url: cdnUrl
        };
    });

    // 3. Deduplicate elements to avoid rendering the exact same video thumbnail multiple times
    const seenUrls = new Set();
    const cleanedResults = mediaResults.filter(item => {
        // Strip out dynamic tracking tokens to check for structural duplicates
        const baseSignature = item.url.split('?')[0]; 
        if (seenUrls.has(baseSignature)) return false;
        seenUrls.add(baseSignature);
        return true;
    });

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
