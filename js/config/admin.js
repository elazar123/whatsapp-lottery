/**
 * Admin Configuration
 * הגדרות מנהל המערכת
 */

export const ADMIN_CONFIG = {
    // המייל של מנהל המערכת הראשי - סופר אדמין שרואה הכל
    superAdminEmail: 'elazar12321@gmail.com',
    
    // שם המערכת
    systemName: 'WhatsApp Lottery',
    
    // פרטי החברה לפוטר
    company: {
        name: 'ריגר הפקות',
        phone: '0525624350',
        website: ''
    },
    
    // הגדרות EmailJS לשליחת התראות
    // ⚠️ יש למלא את הפרטים האלה אחרי הרשמה ל-EmailJS
    emailJS: {
        publicKey: 'YOUR_PUBLIC_KEY',      // Public Key מ-EmailJS
        serviceId: 'YOUR_SERVICE_ID',       // Service ID מ-EmailJS
        templateId: 'YOUR_TEMPLATE_ID'      // Template ID מ-EmailJS
    }
};

/**
 * בדיקה אם המשתמש הוא סופר אדמין
 * @param {string} email 
 * @returns {boolean}
 */
export function isSuperAdmin(email) {
    return email === ADMIN_CONFIG.superAdminEmail;
}
