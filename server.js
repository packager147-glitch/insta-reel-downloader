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

// Deep Search scanner fallback function
function extractCdnUrls(obj, foundUrls = new Set()) {
    if (!obj) return foundUrls;

    if (typeof obj === 'string') {
        if (obj.includes('.cdninstagram.com') && (obj.startsWith('http://') || obj.startsWith('https://'))) {
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

// Target extraction function using Apify's high-bypass Solo Video endpoint
async function fetchInstagramMedia(url) {
    if (!APIFY_TOKEN) {
        throw new Error("API Token missing. Please add your APIFY_TOKEN key inside Render environment variables.");
    }
    
    // Using the specialized high-bypass solo video details scraper endpoint
    const targetApiUrl = "https://apify.com";

    console.log(`Routing high-bypass proxy request to Apify for URL: ${url}`);
    
    const response = await axios.post(
        targetApiUrl,
        {
            "url": url  // Target input configuration format required by the Solo scraper
        },
        { 
            params: { token: APIFY_TOKEN },
            headers: { 'Content-Type': 'application/json' },
            timeout: 60000 
        }
    );

    const items = response.data;
    
    // Check if the specialized scraper returned direct metadata variables
    let mediaResults = [];
    if (Array.isArray(items) && items.length > 0) {
        const item = items[0];
        
        // Target explicit data property pathways returned by this specific actor
        if (item.videoUrl || item.downloadUrl || item.directUrl) {
            mediaResults.push({
                type: 'video',
                url: item.videoUrl || item.downloadUrl || item.directUrl
            });
        }
    }

    // Fallback: If properties vary, use our deep search string scanner on the raw object block
    if (mediaResults.length === 0) {
        const uniqueUrls = Array.from(extractCdnUrls(items));
        if (uniqueUrls.length > 0) {
            mediaResults = uniqueUrls.map(cdnUrl => {
                const isVideo = cdnUrl.includes('.mp4') || cdnUrl.includes('mp4=') || cdnUrl.includes('/v/');
                return { type: isVideo ? 'video' : 'image', url: cdnUrl };
            });
        }
    }

    // De-duplicate URLs
    const seenUrls = new Set();
    const cleanedResults = mediaResults.filter(item => {
        if (!item.url) return false;
        const baseSignature = item.url.split('?')[0]; 
        if (seenUrls.has(baseSignature)) return false;
        seenUrls.add(baseSignature);
        return true;
    });

    if (cleanedResults.length === 0) {
        throw new Error("Meta blocked the scraper proxy pool. Please try extraction again in a few moments.");
    }

    return cleanedResults;
}

// Unified Endpoint Gateway
app.post('/api/download', async (req, res) => {
    const { url } = req.body;
    if (!url || (!url.includes('instagram.com') && !url.includes('instagr.am'))) {
        return res.status(400).json({ error: 'Please provide a valid Instagram link.' });
    }

    try {
        const media = await fetchInstagramMedia(url);
        return res.json({ success: true, media });
    } catch (error) {
        console.error(`Extraction failed:`, error.message);
        return res.status(500).json({ error: error.message || 'Failed to extract media content structure.' });
    }
});

app.listen(PORT, () => {
    console.log(`Server successfully initialized and running on port ${PORT}`);
});
