/**
 * WhatsApp URL Generator Utility
 * Creates proper WhatsApp deep links for sharing
 */

/**
 * Shorten a URL using a free service (is.gd)
 * @param {string} url - Long URL
 * @returns {Promise<string>} Shortened URL (or original if failed)
 */
export async function shortenUrl(url) {
    try {
        // Use is.gd - it's free, no key needed, and very simple
        const response = await fetch(`https://is.gd/create.php?format=simple&url=${encodeURIComponent(url)}`);
        if (response.ok) {
            const shortUrl = await response.text();
            return shortUrl;
        }
        return url;
    } catch (error) {
        console.error('URL shortening failed:', error);
        return url;
    }
}

/**
 * Generate WhatsApp share URL
 * Opens WhatsApp with pre-filled message text
 * @param {string} text - Message text to share
 * @returns {string} WhatsApp URL
 */
export function generateWhatsAppUrl(text) {
    // Encode the text for URL
    const encodedText = encodeURIComponent(text);
    
    // Use wa.me for universal deep linking
    return `https://wa.me/?text=${encodedText}`;
}

/**
 * Generate WhatsApp URL to message specific number
 * @param {string} phone - Phone number in international format (without + or leading 0)
 * @param {string} [text] - Optional pre-filled message
 * @returns {string} WhatsApp URL
 */
export function generateWhatsAppUrlWithPhone(phone, text = '') {
    // Clean phone number - remove spaces, dashes, and leading zeros
    let cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
    
    // Remove leading + if present
    if (cleanPhone.startsWith('+')) {
        cleanPhone = cleanPhone.substring(1);
    }
    
    // Remove leading 0 for Israeli numbers
    if (cleanPhone.startsWith('0')) {
        cleanPhone = '972' + cleanPhone.substring(1);
    }
    
    // Build URL
    let url = `https://wa.me/${cleanPhone}`;
    
    if (text) {
        url += `?text=${encodeURIComponent(text)}`;
    }
    
    return url;
}

/**
 * Generate WhatsApp share link for a campaign
 * @param {string} shareText - Share message template (may contain {{link}} placeholder)
 * @param {string} campaignUrl - Full URL to the campaign
 * @returns {string} WhatsApp URL
 */
export function generateCampaignShareUrl(shareText, campaignUrl) {
    // Replace {{link}} placeholder with actual URL
    let finalText = shareText;
    
    // Ensure the link is absolute
    const absoluteUrl = campaignUrl.startsWith('http') ? campaignUrl : `https://${campaignUrl}`;
    
    if (shareText.includes('{{link}}')) {
        finalText = shareText.replace(/\{\{link\}\}/g, absoluteUrl);
    } else {
        // If no placeholder, append the link at the end
        finalText = `${shareText}\n\n${absoluteUrl}`;
    }
    
    return generateWhatsAppUrl(finalText);
}

/**
 * Check if device is mobile (for WhatsApp app vs web)
 * @returns {boolean}
 */
export function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Open WhatsApp with message
 * Handles both mobile app and web WhatsApp
 * @param {string} whatsappUrl - Full WhatsApp URL (wa.me/...)
 */
export function openWhatsAppShare(whatsappUrl) {
    if (isMobileDevice()) {
        // On mobile, opening via window.location.href is more reliable for deep links
        window.location.href = whatsappUrl;
    } else {
        // On desktop, open in new tab (will redirect to web WhatsApp)
        window.open(whatsappUrl, '_blank');
    }
}
