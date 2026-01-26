/**
 * Viral Sharing Service
 * Handles sharing campaigns with images on mobile (Web Share API) and desktop (WhatsApp URL + OG tags)
 */

/**
 * Handles the viral sharing logic.
 * @param {string} title - The campaign title
 * @param {string} text - The marketing text
 * @param {string} landingPageUrl - The link to the campaign page
 * @param {string} imageUrl - Direct link to the image (ImgBB)
 * @returns {Promise<{success: boolean, method: string}>}
 */
export async function shareCampaign(title, text, landingPageUrl, imageUrl) {
    const fullText = `${text}\n\n${landingPageUrl}`;
    
    // 1. Check for Mobile / Web Share API support
    if (navigator.share && navigator.canShare && imageUrl) {
        try {
            console.log("📱 Attempting Mobile Native Share with image...");
            
            // Fetch the image to create a File object
            const response = await fetch(imageUrl, { 
                mode: 'cors',
                credentials: 'omit',
                cache: 'no-cache'
            });
            
            if (!response.ok) {
                throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
            }
            
            const blob = await response.blob();
            const file = new File([blob], "campaign-image.jpg", { type: blob.type || 'image/jpeg' });

            // Check if we can share this specific file
            const shareData = {
                title: title,
                text: fullText,
                files: [file]
            };
            
            if (navigator.canShare(shareData)) {
                console.log("✅ Can share with files, opening native share dialog...");
                await navigator.share(shareData);
                console.log("✅ Native share completed");
                return { success: true, method: 'native-mobile' };
            } else {
                console.warn("⚠️ navigator.canShare() returned false for files");
            }
        } catch (error) {
            console.warn("❌ Native share failed, falling back to URL scheme:", error);
            // Fallback proceeds below
        }
    }
    
    // 2. Desktop / Fallback Logic (WhatsApp URL)
    console.log("💻 Using Desktop/Fallback Share (WhatsApp URL API)...");
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(fullText)}`;
    window.open(whatsappUrl, '_blank');
    return { success: true, method: 'desktop-url' };
}
