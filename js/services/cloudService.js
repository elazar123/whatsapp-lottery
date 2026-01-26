/**
 * Cloud Service - Unified upload service for images and videos
 * Handles uploads to ImgBB (images) and Cloudinary (videos)
 */

// ImgBB Configuration
const IMGBB_API_KEY = '2900a17df9232acc4653f815631dff73';

// Cloudinary Configuration
// Get these from: https://cloudinary.com/console
const CLOUDINARY_CLOUD_NAME = 'YOUR_CLOUD_NAME'; // Replace with your cloud name
const CLOUDINARY_UPLOAD_PRESET = 'YOUR_UPLOAD_PRESET'; // Replace with your upload preset

/**
 * Upload Video to Cloudinary
 * @param {File} file - Video file to upload
 * @returns {Promise<string>} - Returns the https URL
 */
export async function uploadVideo(file) {
    if (!CLOUDINARY_CLOUD_NAME || CLOUDINARY_CLOUD_NAME === 'YOUR_CLOUD_NAME') {
        throw new Error('Cloudinary לא מוגדר. נא להגדיר Cloud Name ו-Upload Preset בקובץ cloudService.js');
    }
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    formData.append('resource_type', 'video');
    
    const res = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`,
        { 
            method: 'POST', 
            body: formData 
        }
    );
    
    if (!res.ok) {
        throw new Error(`Cloudinary upload failed: ${res.status} ${res.statusText}`);
    }
    
    const data = await res.json();
    return data.secure_url; // Returns the https URL
}

/**
 * Upload Image to ImgBB
 * @param {File} file - Image file to upload
 * @returns {Promise<string>} - Returns direct URL
 */
export async function uploadImage(file) {
    const formData = new FormData();
    formData.append('image', file);
    
    const res = await fetch(
        `https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`,
        {
            method: 'POST',
            body: formData
        }
    );
    
    if (!res.ok) {
        throw new Error(`ImgBB upload failed: ${res.status} ${res.statusText}`);
    }
    
    const data = await res.json();
    
    if (data.success) {
        return data.data.url; // Returns direct URL
    } else {
        throw new Error(data.error?.message || 'ImgBB upload failed');
    }
}
