const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { parse } = require('node-html-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Fallback API configuration (Optional but highly recommended)
// Get your token from https://apify.com/elis/instagram-downloader-api
const APIFY_TOKEN = process.env.APIFY_TOKEN || ""; 

// Primary method: Scraping the public embed data
async function tryEmbedScraping(reelUrl) {
    // Normalize url to include embed path
    let cleanUrl = reelUrl.split('?')[0];
    if (!cleanUrl.endsWith('/')) cleanUrl += '/';
    const embedUrl = `${cleanUrl}embed/captioned/`;

    const response = await axios.get(embedUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    });

    const root = parse(response.data);
    
    // Look for video_url inside the window.__additionalDataLoaded block
    const matches = response.data.match(/"video_url":"([^"]+)"/);
    if (matches && matches[1]) {
        // Clean unicode escape characters
        return matches[1].replace(/\\u0026/g, '&');
    }
    throw new Error("Video URL not found in embed HTML layout.");
}

// Fallback method: Using Apify's API
async function tryApifyApi(reelUrl) {
    if (!APIFY_TOKEN) throw new Error("Apify Token is not configured.");
    
    const response = await axios.get(`https://apify.actor{encodeURIComponent(reelUrl)}`, {
        headers: { 'Authorization': `Bearer ${APIFY_TOKEN}` }
    });

    if (response.data && response.data.status === "success" && response.data.result.length > 0) {
        // Return the highest quality video link
        return response.data.result[0].url;
    }
    throw new Error("Failed to fetch via Apify API.");
}

// Download API Endpoint
app.post('/api/download', async (req, res) => {
    const { url } = req.body;
    if (!url || !url.includes('instagram.com')) {
        return res.status(400).json({ error: 'Please provide a valid Instagram URL' });
    }

    try {
        console.log(`Attempting embed scraping for: ${url}`);
        const downloadUrl = await tryEmbedScraping(url);
        return res.json({ success: true, downloadUrl });
    } catch (primaryError) {
        console.warn(`Primary embed scraping failed: ${primaryError.message}. Trying fallback API...`);
        
        try {
            const downloadUrl = await tryApifyApi(url);
            return res.json({ success: true, downloadUrl, note: "Fetched via fallback gateway." });
        } catch (fallbackError) {
            console.error(`All extraction attempts failed.`);
            return res.status(500).json({ 
                error: 'Could not fetch video URL. Meta blocks generic cloud servers. Try setting up the Apify API token backup.' 
            });
        }
    }
});const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { parse } = require('node-html-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Fallback API configuration (Optional but highly recommended)
// Get your token from https://apify.com/elis/instagram-downloader-api
const APIFY_TOKEN = process.env.APIFY_TOKEN || ""; 

// Primary method: Scraping the public embed data
async function tryEmbedScraping(reelUrl) {
    // Normalize url to include embed path
    let cleanUrl = reelUrl.split('?')[0];
    if (!cleanUrl.endsWith('/')) cleanUrl += '/';
    const embedUrl = `${cleanUrl}embed/captioned/`;

    const response = await axios.get(embedUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    });

    const root = parse(response.data);
    
    // Look for video_url inside the window.__additionalDataLoaded block
    const matches = response.data.match(/"video_url":"([^"]+)"/);
    if (matches && matches[1]) {
        // Clean unicode escape characters
        return matches[1].replace(/\\u0026/g, '&');
    }
    throw new Error("Video URL not found in embed HTML layout.");
}

// Fallback method: Using Apify's API
async function tryApifyApi(reelUrl) {
    if (!APIFY_TOKEN) throw new Error("Apify Token is not configured.");
    
    const response = await axios.get(`https://apify.actor{encodeURIComponent(reelUrl)}`, {
        headers: { 'Authorization': `Bearer ${APIFY_TOKEN}` }
    });

    if (response.data && response.data.status === "success" && response.data.result.length > 0) {
        // Return the highest quality video link
        return response.data.result[0].url;
    }
    throw new Error("Failed to fetch via Apify API.");
}

// Download API Endpoint
app.post('/api/download', async (req, res) => {
    const { url } = req.body;
    if (!url || !url.includes('instagram.com')) {
        return res.status(400).json({ error: 'Please provide a valid Instagram URL' });
    }

    try {
        console.log(`Attempting embed scraping for: ${url}`);
        const downloadUrl = await tryEmbedScraping(url);
        return res.json({ success: true, downloadUrl });
    } catch (primaryError) {
        console.warn(`Primary embed scraping failed: ${primaryError.message}. Trying fallback API...`);
        
        try {
            const downloadUrl = await tryApifyApi(url);
            return res.json({ success: true, downloadUrl, note: "Fetched via fallback gateway." });
        } catch (fallbackError) {
            console.error(`All extraction attempts failed.`);
            return res.status(500).json({ 
                error: 'Could not fetch video URL. Meta blocks generic cloud servers. Try setting up the Apify API token backup.' 
            });
        }
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});


app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
