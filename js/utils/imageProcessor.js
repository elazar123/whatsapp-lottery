/**
 * Image Processor for WhatsApp Open Graph Compatibility
 * 
 * Processes images to meet WhatsApp OG requirements:
 * - Dimensions: Exactly 1200x630 pixels (object-fit: cover)
 * - File size: Under 300KB
 * - Format: JPEG
 * 
 * @param {File} file - Raw image file (any size, any format)
 * @returns {Promise<File>} - Optimized JPEG file ready for WhatsApp
 */
export async function processImageForWhatsApp(file) {
    return new Promise((resolve, reject) => {
        // Validate input
        if (!file || !(file instanceof File)) {
            reject(new Error('Invalid file input'));
            return;
        }

        // Create image element to load the file
        const img = new Image();
        const objectURL = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(objectURL); // Clean up

            // Target dimensions for WhatsApp OG
            const targetWidth = 1200;
            const targetHeight = 630;
            const targetAspectRatio = targetWidth / targetHeight;

            // Calculate source dimensions and crop
            const sourceWidth = img.width;
            const sourceHeight = img.height;
            const sourceAspectRatio = sourceWidth / sourceHeight;

            let drawWidth, drawHeight, sourceX, sourceY, drawX, drawY;

            // Calculate dimensions with "object-fit: cover" logic
            if (sourceAspectRatio > targetAspectRatio) {
                // Source is wider - crop left/right
                drawHeight = sourceHeight;
                drawWidth = sourceHeight * targetAspectRatio;
                sourceX = (sourceWidth - drawWidth) / 2;
                sourceY = 0;
                drawX = 0;
                drawY = 0;
            } else {
                // Source is taller - crop top/bottom
                drawWidth = sourceWidth;
                drawHeight = sourceWidth / targetAspectRatio;
                sourceX = 0;
                sourceY = (sourceHeight - drawHeight) / 2;
                drawX = 0;
                drawY = 0;
            }

            // Create canvas with target dimensions
            const canvas = document.createElement('canvas');
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            const ctx = canvas.getContext('2d');

            // Draw image with cropping and scaling
            ctx.drawImage(
                img,
                sourceX, sourceY, drawWidth, drawHeight, // Source rectangle
                drawX, drawY, targetWidth, targetHeight      // Destination rectangle
            );

            // Compress to JPEG with iterative quality reduction
            compressToTargetSize(canvas, 300 * 1024) // 300KB in bytes
                .then((blob) => {
                    // Convert blob to File
                    const processedFile = new File(
                        [blob],
                        file.name.replace(/\.[^/.]+$/, '') + '_whatsapp.jpg',
                        { type: 'image/jpeg' }
                    );
                    resolve(processedFile);
                })
                .catch((error) => {
                    reject(new Error(`Failed to compress image: ${error.message}`));
                });
        };

        img.onerror = () => {
            URL.revokeObjectURL(objectURL);
            reject(new Error('Failed to load image'));
        };

        img.src = objectURL;
    });
}

/**
 * Compress canvas to target file size using iterative quality reduction
 * @param {HTMLCanvasElement} canvas - Canvas element to compress
 * @param {number} targetSizeBytes - Target file size in bytes (300KB = 300 * 1024)
 * @returns {Promise<Blob>} - Compressed JPEG blob
 */
function compressToTargetSize(canvas, targetSizeBytes) {
    return new Promise((resolve, reject) => {
        let quality = 0.9; // Start with 90% quality
        const minQuality = 0.1; // Minimum quality threshold
        const qualityStep = 0.1;

        function attemptCompression() {
            canvas.toBlob(
                (blob) => {
                    if (!blob) {
                        reject(new Error('Failed to create blob'));
                        return;
                    }

                    // Check if we've reached target size
                    if (blob.size <= targetSizeBytes) {
                        resolve(blob);
                        return;
                    }

                    // If quality is too low, try one more time with minimum quality
                    if (quality <= minQuality) {
                        canvas.toBlob(
                            (finalBlob) => {
                                if (finalBlob && finalBlob.size <= targetSizeBytes * 1.2) {
                                    // Allow 20% tolerance if we're at minimum quality
                                    console.log(`⚠️ Image compressed to ${(finalBlob.size / 1024).toFixed(2)}KB (target: ${(targetSizeBytes / 1024).toFixed(2)}KB) with minimum quality`);
                                    resolve(finalBlob);
                                } else {
                                    const finalSize = finalBlob ? (finalBlob.size / 1024).toFixed(2) : 'unknown';
                                    reject(new Error(`Could not compress image below ${(targetSizeBytes / 1024).toFixed(0)}KB. Final size: ${finalSize}KB`));
                                }
                            },
                            'image/jpeg',
                            minQuality
                        );
                        return;
                    }

                    // Reduce quality and try again
                    quality -= qualityStep;
                    attemptCompression();
                },
                'image/jpeg',
                quality
            );
        }

        attemptCompression();
    });
}
