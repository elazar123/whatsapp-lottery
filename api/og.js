/**
 * Vercel Serverless Function for Open Graph Meta Tags
 * This serves proper meta tags for WhatsApp, Facebook, Twitter previews
 */

const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || 'AIzaSyA3ofysjEvOZ5Aj3OQD7kivsxlmm8R-kIc';

export default async function handler(req, res) {
    const { c: campaignId, ref, debug } = req.query;
    const isDebug = debug === '1' || debug === 'true';
    
    if (!campaignId) {
        return res.redirect('/');
    }
    
    const redirectUrl = ref ? `/?c=${campaignId}&r=${ref}` : `/?c=${campaignId}`;
    const host = req.headers.host || 'elazar123.github.io';
    const basePath = host.includes('github.io') ? '/whatsapp-lottery' : '';
    // og:url = this page (/l/...). Crawlers stay here; no re-fetch of SPA.
    const canonicalPath = ref ? `/l/${campaignId}/${ref}` : `/l/${campaignId}`;
    const pageUrl = `https://${host}${basePath}${canonicalPath}`;
    
    try {
        const projectId = 'whatsapp-lottery1';
        let fullCampaignId = campaignId;

        // If campaignId is short, resolve it
        if (campaignId.length < 15) {
            const listUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/campaigns?key=${FIREBASE_API_KEY}`;
            const listRes = await fetch(listUrl);
            if (listRes.ok) {
                const listData = await listRes.json();
                const match = listData.documents?.find(d => {
                    const id = d.name.split('/').pop();
                    return id.startsWith(campaignId);
                });
                if (match) {
                    fullCampaignId = match.name.split('/').pop();
                }
            }
        }

        const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/campaigns/${fullCampaignId}?key=${FIREBASE_API_KEY}`;
        const response = await fetch(firestoreUrl);
        
        if (!response.ok) {
            if (isDebug) {
                res.setHeader('Content-Type', 'text/plain; charset=utf-8');
                return res.status(200).send(`Firestore fetch failed: ${response.status} ${response.statusText}`);
            }
            return res.redirect(redirectUrl);
        }
        
        const data = await response.json();
        const fields = data.fields || {};
        
        // Extract campaign data
        const title = fields.title?.stringValue || 'הגרלה מיוחדת';
        const description = fields.description?.stringValue || 'הירשמו להגרלה וזכו בפרסים מדהימים!';
        const defaultImage = 'https://images.unsplash.com/photo-1596742572445-d93531c099d5?q=80&w=1200&h=630&auto=format&fit=crop';
        const bannerUrl = fields.bannerUrl?.stringValue || defaultImage;
        const shareImageUrl = fields.shareImageUrl?.stringValue || '';
        const shareVideoUrl = fields.shareVideoUrl?.stringValue || '';
        
        let ogImage = shareImageUrl || bannerUrl || defaultImage;
        if (!ogImage || !ogImage.startsWith('http')) ogImage = defaultImage;
        const ogImageEscaped = ogImage.replace(/"/g, '&quot;');
        
        // Return HTML with proper meta tags
        const html = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)} | הגרלה</title>
    <meta name="description" content="${escapeHtml(description)}">
    
    <!-- Open Graph Meta Tags -->
    <meta property="og:type" content="website">
    <meta property="og:title" content="${escapeHtml(title)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:image" content="${ogImageEscaped}">
    <meta property="og:image:secure_url" content="${ogImageEscaped}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    ${shareVideoUrl ? `<meta property="og:video" content="${shareVideoUrl}">
    <meta property="og:video:type" content="video/mp4">
    <meta property="og:video:width" content="1200">
    <meta property="og:video:height" content="630">` : ''}
    <meta property="og:url" content="${pageUrl}">
    <meta property="og:locale" content="he_IL">
    <meta property="og:site_name" content="WhatsApp Lottery">
    
    <!-- Twitter Card Meta Tags -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtml(title)}">
    <meta name="twitter:description" content="${escapeHtml(description)}">
    <meta name="twitter:image" content="${ogImageEscaped}">
    ${shareVideoUrl ? `<meta name="twitter:player" content="${shareVideoUrl}">
    <meta name="twitter:player:width" content="1200">
    <meta name="twitter:player:height" content="630">` : ''}
    
    ${isDebug ? '<!-- debug: no redirect -->' : `<!-- No meta refresh – crawlers stay here. JS redirect only. -->
    <script>window.location.replace(${JSON.stringify(redirectUrl)});</script>`}
</head>
<body>
    <p>מעביר אותך להגרלה...</p>
    <p><a href="${redirectUrl}">לחץ כאן אם אתה לא מועבר אוטומטית</a></p>
    ${isDebug ? `<!-- og:image: ${ogImageEscaped} -->` : ''}
</body>
</html>`;
        
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
        return res.status(200).send(html);
        
    } catch (error) {
        console.error('Error fetching campaign:', error);
        if (isDebug) {
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            return res.status(200).send(`Error: ${error.message}`);
        }
        return res.redirect(redirectUrl);
    }
}

function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
