/**
 * WhatsApp URL Generator Utility
 * Creates proper WhatsApp deep links for sharing
 */

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
    
    if (shareText.includes('{{link}}')) {
        finalText = shareText.replace(/\{\{link\}\}/g, campaignUrl);
    } else {
        // If no placeholder, append the link at the end
        finalText = `${shareText}\n${campaignUrl}`;
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
 * @param {string} text - Message to share
 */
export function openWhatsAppShare(text) {
    const url = generateWhatsAppUrl(text);
    
    if (isMobileDevice()) {
        // On mobile, try to open the app directly
        window.location.href = url;
    } else {
        // On desktop, open in new tab (will redirect to web WhatsApp)
        window.open(url, '_blank');
    }
}
