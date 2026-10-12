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

// Deep scanning utility to pull hidden CDN URLs if structural object maps vary
function deepExtractCdnUrls(obj, collection = new Set()) {
    if (!obj) return collection;
    if (typeof obj === 'string') {
        if (obj.includes('.cdninstagram.com') && (obj.startsWith('http://') || obj.startsWith('https://'))) {
            collection.add(obj.replace(/\\u0026/g, '&'));
        }
    } else if (Array.isArray(obj)) {
        for (const element of obj) deepExtractCdnUrls(element, collection);
    } else if (typeof obj === 'object') {
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) deepExtractCdnUrls(obj[key], collection);
        }
    }
    return collection;
}

// Engine 1: Dedicated SnapCDN Downloader Actor
async function trySnapCdnEngine(url) {
    const targetApiUrl = `https://apify.com`;
    const response = await axios.post(targetApiUrl, { "url": url }, {
        params: { token: APIFY_TOKEN },
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
    });

    const dataItems = response.data;
    if (!dataItems || !Array.isArray(dataItems) || dataItems.length === 0) return null;
    
    const resultItem = dataItems[0];
    if (!resultItem.result || !Array.isArray(resultItem.result) || resultItem.result.length === 0) return null;

    return resultItem.result.map(item => {
        const isVideo = item.type === 'video' || item.url.includes('.mp4') || item.url.includes('mp4=');
        return { type: isVideo ? 'video' : 'image', url: item.url };
    });
}

// Engine 2: High-Success Core Scraper Node Fallback
async function tryCoreScraperEngine(url) {
    const targetApiUrl = `https://apify.com`;
    const response = await axios.post(targetApiUrl, {
        "directUrls": [url],
        "resultsType": "details"
    }, {
        params: { token: APIFY_TOKEN },
        headers: { 'Content-Type': 'application/json' },
        timeout: 40000
    });

    const items = response.data;
    if (!items || !Array.isArray(items) || items.length === 0) return null;

    const postData = items[0];
    let foundUrls = [];

    // Check common payload data properties directly
    if (postData.childPosts && postData.childPosts.length > 0) {
        foundUrls = postData.childPosts.map(c => c.videoUrl || c.displayUrl);
    } else {
        const singleUrl = postData.videoUrl || postData.displayUrl || postData.imageUrl;
        if (singleUrl) foundUrls.push(singleUrl);
    }

    // Use deep search string fallback scanner if keys are empty
    if (foundUrls.length === 0) {
        foundUrls = Array.from(deepExtractCdnUrls(items));
    }

    if (foundUrls.length === 0) return null;

    return foundUrls.map(cdnUrl => {
        const isVideo = cdnUrl.includes('.mp4') || cdnUrl.includes('mp4=') || cdnUrl.includes('/v/');
        return { type: isVideo ? 'video' : 'image', url: cdnUrl };
    });
}

// Central Media Coordinator
async function fetchInstagramMedia(url) {
    if (!APIFY_TOKEN) {
        throw new Error("API Token missing. Please check your APIFY_TOKEN key configuration inside Render.");
    }

    // Clean URL string structures to drop extra tracking strings
    let targetUrl = url.split('?')[0];
    if (!targetUrl.endsWith('/')) targetUrl += '/';

    console.log(`Running primary SnapCDN Engine for: ${targetUrl}`);
    try {
        const primaryResults = await trySnapCdnEngine(targetUrl);
        if (primaryResults && primaryResults.length > 0) return primaryResults;
    } catch (e) {
        console.warn(`Primary Engine failed: ${e.message}. Dropping to Fallback Engine...`);
    }

    console.log(`Running core scraper fallback engine routing...`);
    try {
        const fallbackResults = await tryCoreScraperEngine(targetUrl);
        if (fallbackResults && fallbackResults.length > 0) return fallbackResults;
    } catch (e) {
        console.error(`Fallback Engine error payload context: ${e.message}`);
    }

    throw new Error("Both extraction engines returned empty metrics. Ensure the post link is public and accessible.");
}

// Unified API Endpoint Gateway
app.post('/api/download', async (req, res) => {
    const { url } = req.body;
    if (!url || (!url.includes('instagram.com') && !url.includes('instagr.am'))) {
        return res.status(400).json({ error: 'Please provide a valid Instagram link.' });
    }

    try {
        const media = await fetchInstagramMedia(url);
        return res.json({ success: true, media });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server successfully initialized and running on port ${PORT}`);
});
