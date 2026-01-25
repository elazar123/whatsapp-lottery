/**
 * Database Service
 * Firestore CRUD operations for campaigns and leads
 */

import { getDbInstance } from '../config/firebase.js';
import { 
    collection, 
    doc, 
    addDoc, 
    getDoc, 
    getDocs, 
    updateDoc, 
    deleteDoc,
    query, 
    where, 
    orderBy,
    serverTimestamp,
    increment
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Collection names
const CAMPAIGNS_COLLECTION = 'campaigns';
const LEADS_SUBCOLLECTION = 'leads';

/* ==========================================================================
   Campaign Operations
   ========================================================================== */

/**
 * Create a new campaign
 * @param {Object} campaignData - Campaign data
 * @param {string} managerId - User ID of the manager
 * @returns {Promise<string>} - Created campaign ID
 */
export async function createCampaign(campaignData, managerId) {
    const db = getDbInstance();
    
    const campaign = {
        managerId,
        isActive: true,
        title: campaignData.title,
        description: campaignData.description || '',
        endDate: campaignData.endDate,
        whatsappShareText: campaignData.whatsappShareText,
        contactVcardName: campaignData.contactVcardName,
        contactPhoneNumber: campaignData.contactPhoneNumber,
        theme: {
            primaryColor: campaignData.primaryColor || '#6366f1',
            backgroundColor: campaignData.backgroundColor || '#f8fafc'
        },
        viewsCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    };
    
    try {
        const docRef = await addDoc(collection(db, CAMPAIGNS_COLLECTION), campaign);
        return docRef.id;
    } catch (error) {
        console.error('Error creating campaign:', error);
        throw error;
    }
}

/**
 * Get a single campaign by ID
 * @param {string} campaignId - Campaign document ID
 * @returns {Promise<Object|null>} - Campaign data or null
 */
export async function getCampaign(campaignId) {
    const db = getDbInstance();
    
    try {
        const docRef = doc(db, CAMPAIGNS_COLLECTION, campaignId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() };
        }
        return null;
    } catch (error) {
        console.error('Error getting campaign:', error);
        throw error;
    }
}

/**
 * Get all campaigns for a manager
 * @param {string} managerId - User ID of the manager
 * @returns {Promise<Array>} - Array of campaigns
 */
export async function getCampaignsByManager(managerId) {
    const db = getDbInstance();
    
    try {
        const q = query(
            collection(db, CAMPAIGNS_COLLECTION),
            where('managerId', '==', managerId),
            orderBy('createdAt', 'desc')
        );
        
        const querySnapshot = await getDocs(q);
        const campaigns = [];
        
        querySnapshot.forEach((doc) => {
            campaigns.push({ id: doc.id, ...doc.data() });
        });
        
        return campaigns;
    } catch (error) {
        console.error('Error getting campaigns:', error);
        throw error;
    }
}

/**
 * Update a campaign
 * @param {string} campaignId - Campaign document ID
 * @param {Object} updateData - Fields to update
 * @returns {Promise<void>}
 */
export async function updateCampaign(campaignId, updateData) {
    const db = getDbInstance();
    
    try {
        const docRef = doc(db, CAMPAIGNS_COLLECTION, campaignId);
        await updateDoc(docRef, {
            ...updateData,
            updatedAt: serverTimestamp()
        });
    } catch (error) {
        console.error('Error updating campaign:', error);
        throw error;
    }
}

/**
 * Delete a campaign and its leads
 * @param {string} campaignId - Campaign document ID
 * @returns {Promise<void>}
 */
export async function deleteCampaign(campaignId) {
    const db = getDbInstance();
    
    try {
        // Note: In production, you'd want to use a Cloud Function
        // to recursively delete subcollections
        const docRef = doc(db, CAMPAIGNS_COLLECTION, campaignId);
        await deleteDoc(docRef);
    } catch (error) {
        console.error('Error deleting campaign:', error);
        throw error;
    }
}

/**
 * Increment campaign view count
 * @param {string} campaignId - Campaign document ID
 * @returns {Promise<void>}
 */
export async function incrementViewCount(campaignId) {
    const db = getDbInstance();
    
    try {
        const docRef = doc(db, CAMPAIGNS_COLLECTION, campaignId);
        await updateDoc(docRef, {
            viewsCount: increment(1)
        });
    } catch (error) {
        console.error('Error incrementing view count:', error);
        // Don't throw - view count is not critical
    }
}

/* ==========================================================================
   Lead Operations
   ========================================================================== */

/**
 * Save a new lead to a campaign
 * @param {string} campaignId - Campaign document ID
 * @param {Object} leadData - Lead data (fullName, phone, referredBy?)
 * @returns {Promise<string>} - Created lead ID
 */
export async function saveLead(campaignId, leadData) {
    const db = getDbInstance();
    
    const lead = {
        fullName: leadData.fullName,
        phone: leadData.phone,
        joinedAt: serverTimestamp(),
        tickets: 1, // כרטיס אחד בהרשמה
        referredBy: leadData.referredBy || null, // מי הפנה אותי
        tasksCompleted: {
            savedContact: false,
            sharedWhatsapp: false
        }
    };
    
    try {
        const leadsRef = collection(db, CAMPAIGNS_COLLECTION, campaignId, LEADS_SUBCOLLECTION);
        const docRef = await addDoc(leadsRef, lead);
        
        // אם יש מפנה - תן לו כרטיס נוסף!
        if (leadData.referredBy) {
            await addTicketToReferrer(campaignId, leadData.referredBy);
        }
        
        return docRef.id;
    } catch (error) {
        console.error('Error saving lead:', error);
        throw error;
    }
}

/**
 * Add a ticket to referrer when someone registers through their link
 * @param {string} campaignId - Campaign document ID
 * @param {string} referrerLeadId - Lead ID of the referrer
 */
export async function addTicketToReferrer(campaignId, referrerLeadId) {
    const db = getDbInstance();
    
    try {
        const leadRef = doc(db, CAMPAIGNS_COLLECTION, campaignId, LEADS_SUBCOLLECTION, referrerLeadId);
        await updateDoc(leadRef, {
            tickets: increment(1)
        });
        console.log('Added ticket to referrer:', referrerLeadId);
    } catch (error) {
        console.error('Error adding ticket to referrer:', error);
        // Don't throw - this is not critical
    }
}

/**
 * Update lead task completion status
 * @param {string} campaignId - Campaign document ID
 * @param {string} leadId - Lead document ID
 * @param {Object} tasks - Tasks to update { savedContact?, sharedWhatsapp? }
 * @returns {Promise<void>}
 */
export async function updateLeadTasks(campaignId, leadId, tasks) {
    const db = getDbInstance();
    
    try {
        const leadRef = doc(db, CAMPAIGNS_COLLECTION, campaignId, LEADS_SUBCOLLECTION, leadId);
        
        const updates = {};
        if (tasks.savedContact !== undefined) {
            updates['tasksCompleted.savedContact'] = tasks.savedContact;
        }
        if (tasks.sharedWhatsapp !== undefined) {
            updates['tasksCompleted.sharedWhatsapp'] = tasks.sharedWhatsapp;
        }
        
        await updateDoc(leadRef, updates);
    } catch (error) {
        console.error('Error updating lead tasks:', error);
        throw error;
    }
}

/**
 * Get all leads for a campaign
 * @param {string} campaignId - Campaign document ID
 * @returns {Promise<Array>} - Array of leads
 */
export async function getLeadsByCampaign(campaignId) {
    const db = getDbInstance();
    
    try {
        const leadsRef = collection(db, CAMPAIGNS_COLLECTION, campaignId, LEADS_SUBCOLLECTION);
        const q = query(leadsRef, orderBy('joinedAt', 'desc'));
        
        const querySnapshot = await getDocs(q);
        const leads = [];
        
        querySnapshot.forEach((doc) => {
            leads.push({ id: doc.id, ...doc.data() });
        });
        
        return leads;
    } catch (error) {
        console.error('Error getting leads:', error);
        throw error;
    }
}

/**
 * Get lead count for a campaign
 * @param {string} campaignId - Campaign document ID
 * @returns {Promise<number>} - Number of leads
 */
export async function getLeadCount(campaignId) {
    const db = getDbInstance();
    
    try {
        const leadsRef = collection(db, CAMPAIGNS_COLLECTION, campaignId, LEADS_SUBCOLLECTION);
        const querySnapshot = await getDocs(leadsRef);
        return querySnapshot.size;
    } catch (error) {
        console.error('Error getting lead count:', error);
        return 0;
    }
}

/* ==========================================================================
   Super Admin Operations (for main admin to see everything)
   ========================================================================== */

/**
 * Get ALL campaigns (for super admin)
 * @returns {Promise<Array>} - Array of all campaigns
 */
export async function getAllCampaigns() {
    const db = getDbInstance();
    
    try {
        const q = query(
            collection(db, CAMPAIGNS_COLLECTION),
            orderBy('createdAt', 'desc')
        );
        
        const querySnapshot = await getDocs(q);
        const campaigns = [];
        
        querySnapshot.forEach((doc) => {
            campaigns.push({ id: doc.id, ...doc.data() });
        });
        
        return campaigns;
    } catch (error) {
        console.error('Error getting all campaigns:', error);
        throw error;
    }
}

/**
 * Get ALL registered users (for super admin)
 * @returns {Promise<Array>} - Array of all users
 */
export async function getAllUsers() {
    const db = getDbInstance();
    
    try {
        const q = query(
            collection(db, 'users'),
            orderBy('createdAt', 'desc')
        );
        
        const querySnapshot = await getDocs(q);
        const users = [];
        
        querySnapshot.forEach((doc) => {
            users.push({ id: doc.id, ...doc.data() });
        });
        
        return users;
    } catch (error) {
        console.error('Error getting all users:', error);
        throw error;
    }
}

/**
 * Check if phone number already registered for campaign
 * @param {string} campaignId - Campaign document ID
 * @param {string} phone - Phone number to check
 * @returns {Promise<Object|null>} - Existing lead or null
 */
export async function findLeadByPhone(campaignId, phone) {
    const db = getDbInstance();
    
    try {
        const leadsRef = collection(db, CAMPAIGNS_COLLECTION, campaignId, LEADS_SUBCOLLECTION);
        const q = query(leadsRef, where('phone', '==', phone));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
            const doc = querySnapshot.docs[0];
            return { id: doc.id, ...doc.data() };
        }
        return null;
    } catch (error) {
        console.error('Error finding lead:', error);
        throw error;
    }
}
