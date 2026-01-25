/**
 * VCard Generator Utility
 * Creates and downloads .vcf contact files
 */

/**
 * Generate VCard string
 * @param {string} name - Contact name
 * @param {string} phone - Phone number (international format without +)
 * @param {string} [organization] - Optional organization name
 * @returns {string} VCard formatted string
 */
export function generateVCard(name, phone, organization = '') {
    // Format phone with + if it starts with country code
    const formattedPhone = phone.startsWith('+') ? phone : `+${phone}`;
    
    // Build VCard
    const vcard = [
        'BEGIN:VCARD',
        'VERSION:3.0',
        `FN:${escapeVCardValue(name)}`,
        `N:;${escapeVCardValue(name)};;;`,
        `TEL;TYPE=CELL:${formattedPhone}`,
    ];
    
    if (organization) {
        vcard.push(`ORG:${escapeVCardValue(organization)}`);
    }
    
    vcard.push('END:VCARD');
    
    return vcard.join('\r\n');
}

/**
 * Escape special characters in VCard values
 * @param {string} value 
 * @returns {string}
 */
function escapeVCardValue(value) {
    if (!value) return '';
    // Escape backslashes, semicolons, commas, and newlines
    return value
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\n/g, '\\n');
}

/**
 * Download VCard as .vcf file
 * @param {string} vcardString - VCard content
 * @param {string} filename - Name for the file (without extension)
 */
export function downloadVCard(vcardString, filename = 'contact') {
    // Create blob
    const blob = new Blob([vcardString], { type: 'text/vcard;charset=utf-8' });
    
    // Create download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${sanitizeFilename(filename)}.vcf`;
    
    // Trigger download
    document.body.appendChild(link);
    link.click();
    
    // Cleanup
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Sanitize filename for safe download
 * @param {string} filename 
 * @returns {string}
 */
function sanitizeFilename(filename) {
    if (!filename) return 'contact';
    // Remove/replace invalid filename characters
    return filename
        .replace(/[<>:"/\\|?*]/g, '')
        .replace(/\s+/g, '_')
        .substring(0, 50); // Limit length
}

/**
 * Create VCard and download in one step
 * @param {string} name - Contact name
 * @param {string} phone - Phone number
 * @param {string} [organization] - Optional organization
 */
export function createAndDownloadVCard(name, phone, organization = '') {
    const vcard = generateVCard(name, phone, organization);
    downloadVCard(vcard, name);
}

/**
 * Generate multiple VCards in one file
 * @param {Array} contacts - Array of contact objects with fullName/name and phone
 * @param {string} [organization] - Optional organization for all contacts
 * @returns {string} Combined VCard string
 */
export function generateMultiVCard(contacts, organization = '') {
    return contacts.map(contact => {
        const name = contact.fullName || contact.name || 'Contact';
        return generateVCard(name, contact.phone, organization);
    }).join('\r\n');
}

/**
 * Download multiple contacts as single VCF file
 * Easy import to any phone's contact app
 * @param {Array} contacts - Array of contacts with fullName/name and phone
 * @param {string} filename - Filename for download
 * @param {string} [organization] - Optional organization for all
 */
export function downloadMultipleContacts(contacts, filename = 'contacts', organization = '') {
    if (!contacts || contacts.length === 0) {
        console.warn('No contacts to download');
        return;
    }
    
    const vcardContent = generateMultiVCard(contacts, organization);
    downloadVCard(vcardContent, filename);
}
