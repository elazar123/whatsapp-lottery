/**
 * Email Notifications Service
 * שירות שליחת התראות במייל למנהל המערכת
 */

import { ADMIN_CONFIG } from '../config/admin.js';

// EmailJS SDK URL
const EMAILJS_SDK = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js';

let emailJSLoaded = false;

/**
 * טעינת EmailJS SDK
 */
async function loadEmailJS() {
    if (emailJSLoaded) return;
    
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = EMAILJS_SDK;
        script.onload = () => {
            emailJSLoaded = true;
            // אתחול EmailJS עם ה-Public Key
            if (window.emailjs && ADMIN_CONFIG.emailJS.publicKey !== 'YOUR_PUBLIC_KEY') {
                window.emailjs.init(ADMIN_CONFIG.emailJS.publicKey);
            }
            resolve();
        };
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

/**
 * שליחת התראה על משתמש חדש שנרשם למערכת
 * @param {Object} user - פרטי המשתמש
 */
export async function notifyNewUserRegistration(user) {
    try {
        await loadEmailJS();
        
        // בדיקה שההגדרות תקינות
        if (ADMIN_CONFIG.emailJS.publicKey === 'YOUR_PUBLIC_KEY') {
            console.log('EmailJS לא מוגדר - דילוג על שליחת התראה');
            return;
        }
        
        const templateParams = {
            to_email: ADMIN_CONFIG.superAdminEmail,
            subject: '🆕 משתמש חדש נרשם למערכת',
            user_name: user.displayName || 'לא צוין',
            user_email: user.email,
            registration_date: new Date().toLocaleString('he-IL'),
            message: `משתמש חדש נרשם למערכת ${ADMIN_CONFIG.systemName}`,
            system_name: ADMIN_CONFIG.systemName
        };
        
        await window.emailjs.send(
            ADMIN_CONFIG.emailJS.serviceId,
            ADMIN_CONFIG.emailJS.templateId,
            templateParams
        );
        
        console.log('התראה על משתמש חדש נשלחה בהצלחה');
    } catch (error) {
        console.error('שגיאה בשליחת התראה:', error);
    }
}

/**
 * שליחת התראה על הגרלה חדשה שנוצרה
 * @param {Object} campaign - פרטי ההגרלה
 * @param {Object} user - פרטי המשתמש שיצר
 */
export async function notifyNewCampaignCreated(campaign, user) {
    try {
        await loadEmailJS();
        
        // בדיקה שההגדרות תקינות
        if (ADMIN_CONFIG.emailJS.publicKey === 'YOUR_PUBLIC_KEY') {
            console.log('EmailJS לא מוגדר - דילוג על שליחת התראה');
            return;
        }
        
        const templateParams = {
            to_email: ADMIN_CONFIG.superAdminEmail,
            subject: '🎲 הגרלה חדשה נוצרה במערכת',
            user_name: user.displayName || 'לא צוין',
            user_email: user.email,
            campaign_title: campaign.title,
            campaign_description: campaign.description || 'אין תיאור',
            creation_date: new Date().toLocaleString('he-IL'),
            message: `הגרלה חדשה נוצרה במערכת ${ADMIN_CONFIG.systemName}`,
            system_name: ADMIN_CONFIG.systemName
        };
        
        await window.emailjs.send(
            ADMIN_CONFIG.emailJS.serviceId,
            ADMIN_CONFIG.emailJS.templateId,
            templateParams
        );
        
        console.log('התראה על הגרלה חדשה נשלחה בהצלחה');
    } catch (error) {
        console.error('שגיאה בשליחת התראה:', error);
    }
}

/**
 * שליחת התראה על ליד חדש שנרשם להגרלה
 * @param {Object} lead - פרטי הליד
 * @param {Object} campaign - פרטי ההגרלה
 */
export async function notifyNewLead(lead, campaign) {
    try {
        await loadEmailJS();
        
        // בדיקה שההגדרות תקינות
        if (ADMIN_CONFIG.emailJS.publicKey === 'YOUR_PUBLIC_KEY') {
            console.log('EmailJS לא מוגדר - דילוג על שליחת התראה');
            return;
        }
        
        const templateParams = {
            to_email: ADMIN_CONFIG.superAdminEmail,
            subject: `👤 נרשם חדש להגרלה: ${campaign.title}`,
            lead_name: lead.fullName,
            lead_phone: lead.phone,
            campaign_title: campaign.title,
            registration_date: new Date().toLocaleString('he-IL'),
            message: `נרשם חדש להגרלה במערכת ${ADMIN_CONFIG.systemName}`,
            system_name: ADMIN_CONFIG.systemName
        };
        
        await window.emailjs.send(
            ADMIN_CONFIG.emailJS.serviceId,
            ADMIN_CONFIG.emailJS.templateId,
            templateParams
        );
        
        console.log('התראה על ליד חדש נשלחה בהצלחה');
    } catch (error) {
        console.error('שגיאה בשליחת התראה:', error);
    }
}
