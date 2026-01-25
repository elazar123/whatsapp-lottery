/**
 * Image Upload Service using imgBB
 * Free image hosting with permanent URLs
 */

// imgBB API Key - Get yours free at https://api.imgbb.com/
const IMGBB_API_KEY = 'c3bcc92408e402b3e9beb29d25a5a77c';

/**
 * Upload image to imgBB
 * @param {string} base64Image - Base64 encoded image (with or without data URL prefix)
 * @returns {Promise<Object>} - Upload result with URL
 */
export async function uploadImage(base64Image) {
    // Remove data URL prefix if present
    let imageData = base64Image;
    if (base64Image.includes('base64,')) {
        imageData = base64Image.split('base64,')[1];
    }
    
    // Create form data
    const formData = new FormData();
    formData.append('key', IMGBB_API_KEY);
    formData.append('image', imageData);
    
    try {
        const response = await fetch('https://api.imgbb.com/1/upload', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            return {
                success: true,
                url: result.data.display_url,        // Full size image
                thumbnail: result.data.thumb?.url,    // Thumbnail
                medium: result.data.medium?.url,      // Medium size
                deleteUrl: result.data.delete_url     // URL to delete image
            };
        } else {
            throw new Error(result.error?.message || 'Upload failed');
        }
    } catch (error) {
        console.error('Image upload error:', error);
        throw error;
    }
}

/**
 * Upload image from File object
 * @param {File} file - Image file
 * @returns {Promise<Object>} - Upload result with URL
 */
export async function uploadImageFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const result = await uploadImage(e.target.result);
                resolve(result);
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}
