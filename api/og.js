/**
 * Vercel Serverless Function for Open Graph Meta Tags
 * This serves proper meta tags for WhatsApp, Facebook, Twitter previews
 */

export default async function handler(req, res) {
    const { c: campaignId, ref } = req.query;
    
    if (!campaignId) {
        return res.redirect('/');
    }
    
    // Build redirect URL with referral parameter
    const redirectUrl = ref ? `/?c=${campaignId}&r=${ref}` : `/?c=${campaignId}`;
    const pageUrl = `https://whatsapp-lottery-wsam.vercel.app${redirectUrl}`;
    
    try {
        const projectId = 'whatsapp-lottery1';
        let fullCampaignId = campaignId;

        // If campaignId is short, resolve it
        if (campaignId.length < 15) {
            const listUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/campaigns`;
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

        // Fetch campaign from Firestore REST API
        const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/campaigns/${fullCampaignId}`;
        
        const response = await fetch(firestoreUrl);
        
        if (!response.ok) {
            return res.redirect(redirectUrl);
        }
        
        const data = await response.json();
        const fields = data.fields || {};
        
        // Extract campaign data
        const title = fields.title?.stringValue || 'הגרלה מיוחדת';
        const description = fields.description?.stringValue || 'הירשמו להגרלה וזכו בפרסים מדהימים!';
        const bannerUrl = fields.bannerUrl?.stringValue || '';
        
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
    <meta property="og:image" content="${bannerUrl}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:url" content="${pageUrl}">
    <meta property="og:locale" content="he_IL">
    <meta property="og:site_name" content="WhatsApp Lottery">
    
    <!-- Twitter Card Meta Tags -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtml(title)}">
    <meta name="twitter:description" content="${escapeHtml(description)}">
    <meta name="twitter:image" content="${bannerUrl}">
    
    <!-- Redirect to actual page -->
    <meta http-equiv="refresh" content="0;url=${redirectUrl}">
    <script>window.location.href = "${redirectUrl}";</script>
</head>
<body>
    <p>מעביר אותך להגרלה...</p>
    <p><a href="${redirectUrl}">לחץ כאן אם אתה לא מועבר אוטומטית</a></p>
</body>
</html>`;
        
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
        return res.status(200).send(html);
        
    } catch (error) {
        console.error('Error fetching campaign:', error);
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
