/**
 * Video Upload Service using Cloudinary
 * Free video hosting with permanent URLs
 * 
 * SETUP REQUIRED:
 * 1. Go to https://cloudinary.com/users/register/free
 * 2. Create a free account
 * 3. Go to Dashboard -> Settings -> Upload
 * 4. Enable "Unsigned uploading" and create an upload preset
 * 5. Copy your Cloud Name and Upload Preset name
 * 6. Update the constants below
 */

// Cloudinary Configuration
// Get these from: https://cloudinary.com/console
const CLOUDINARY_CLOUD_NAME = 'YOUR_CLOUD_NAME'; // Replace with your cloud name
const CLOUDINARY_UPLOAD_PRESET = 'YOUR_UPLOAD_PRESET'; // Replace with your upload preset

/**
 * Upload video to Cloudinary using unsigned upload
 * @param {File} videoFile - Video file to upload
 * @returns {Promise<Object>} - Upload result with URL
 */
export async function uploadVideo(videoFile) {
    if (!CLOUDINARY_CLOUD_NAME || CLOUDINARY_CLOUD_NAME === 'YOUR_CLOUD_NAME') {
        throw new Error('Cloudinary לא מוגדר. נא להגדיר Cloud Name ו-Upload Preset בקובץ videoUpload.js');
    }
    
    // Create form data
    const formData = new FormData();
    formData.append('file', videoFile);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    formData.append('resource_type', 'video');
    
    try {
        const response = await fetch(
            `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`,
            {
                method: 'POST',
                body: formData
            }
        );
        
        const result = await response.json();
        
        if (result.secure_url) {
            return {
                success: true,
                url: result.secure_url,           // HTTPS URL
                publicId: result.public_id,       // Public ID for management
                format: result.format,           // Video format
                duration: result.duration,        // Duration in seconds
                bytes: result.bytes,              // File size
                width: result.width,
                height: result.height
            };
        } else {
            throw new Error(result.error?.message || 'Upload failed');
        }
    } catch (error) {
        console.error('Video upload error:', error);
        throw error;
    }
}

/**
 * Upload video from base64 string
 * @param {string} base64Video - Base64 encoded video (with data URL prefix)
 * @returns {Promise<Object>} - Upload result with URL
 */
export async function uploadVideoFromBase64(base64Video) {
    // Convert base64 to blob
    const response = await fetch(base64Video);
    const blob = await response.blob();
    
    // Create File object from blob
    const file = new File([blob], 'video.mp4', { type: blob.type });
    
    return uploadVideo(file);
}
