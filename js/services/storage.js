/**
 * Firebase Storage Service
 * Handles image uploads and URL generation
 */

import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';
import { getApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';

let storage = null;

/**
 * Initialize Storage
 */
export function initStorage() {
    if (!storage) {
        storage = getStorage(getApp());
    }
    return storage;
}

/**
 * Upload campaign banner image
 * @param {File} file - Image file to upload
 * @param {string} campaignId - Campaign ID for folder organization
 * @returns {Promise<string>} - Public URL of uploaded image
 */
export async function uploadBannerImage(file, campaignId) {
    initStorage();
    
    // Generate unique filename
    const timestamp = Date.now();
    const extension = file.name.split('.').pop();
    const filename = `campaigns/${campaignId}/banner_${timestamp}.${extension}`;
    
    // Create reference
    const storageRef = ref(storage, filename);
    
    // Upload file
    const snapshot = await uploadBytes(storageRef, file, {
        contentType: file.type,
        customMetadata: {
            uploadedAt: new Date().toISOString()
        }
    });
    
    // Get public URL
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    return downloadURL;
}

/**
 * Upload image from base64 string
 * @param {string} base64String - Base64 encoded image (with data URL prefix)
 * @param {string} campaignId - Campaign ID
 * @returns {Promise<string>} - Public URL
 */
export async function uploadBase64Image(base64String, campaignId) {
    initStorage();
    
    // Extract content type and data
    const matches = base64String.match(/^data:(.+);base64,(.+)$/);
    if (!matches) {
        throw new Error('Invalid base64 string');
    }
    
    const contentType = matches[1];
    const base64Data = matches[2];
    
    // Convert base64 to blob
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: contentType });
    
    // Generate filename
    const timestamp = Date.now();
    const extension = contentType.split('/')[1] || 'jpg';
    const filename = `campaigns/${campaignId}/banner_${timestamp}.${extension}`;
    
    // Create reference and upload
    const storageRef = ref(storage, filename);
    const snapshot = await uploadBytes(storageRef, blob, {
        contentType: contentType,
        customMetadata: {
            uploadedAt: new Date().toISOString()
        }
    });
    
    // Get public URL
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    return downloadURL;
}

/**
 * Upload share media (image or video) for campaign sharing
 * @param {File} file - Media file to upload
 * @param {string} campaignId - Campaign ID
 * @param {string} type - 'image' or 'video'
 * @returns {Promise<string>} - Public URL of uploaded file
 */
export async function uploadShareMedia(file, campaignId, type = 'image') {
    initStorage();
    
    // Generate unique filename
    const timestamp = Date.now();
    const extension = file.name.split('.').pop();
    const filename = `campaigns/${campaignId}/share_${type}_${timestamp}.${extension}`;
    
    // Create reference
    const storageRef = ref(storage, filename);
    
    // Upload file
    const snapshot = await uploadBytes(storageRef, file, {
        contentType: file.type,
        customMetadata: {
            uploadedAt: new Date().toISOString(),
            type: type
        }
    });
    
    // Get public URL
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    return downloadURL;
}

/**
 * Delete image from storage
 * @param {string} imageUrl - Full URL of image to delete
 */
export async function deleteImage(imageUrl) {
    initStorage();
    
    try {
        // Extract path from URL
        const storageRef = ref(storage, imageUrl);
        await deleteObject(storageRef);
    } catch (error) {
        console.warn('Could not delete image:', error);
    }
}
