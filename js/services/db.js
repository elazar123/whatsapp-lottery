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
    increment,
    limit
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
        shareImageUrl: campaignData.shareImageUrl || '',
        shareVideoUrl: campaignData.shareVideoUrl || '',
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
        const campaignId = docRef.id;

        // יצירת ליד ראשון עבור המנהל כדי שיוכל לצבור כרטיסים
        const managerLead = {
            fullName: campaignData.contactVcardName + " (מנהל)",
            phone: campaignData.contactPhoneNumber,
            joinedAt: serverTimestamp(),
            tickets: 1,
            referredBy: null,
            isManager: true,
            tasksCompleted: {
                savedContact: true,
                sharedWhatsapp: true
            }
        };
        
        const leadRef = await addDoc(collection(db, CAMPAIGNS_COLLECTION, campaignId, LEADS_SUBCOLLECTION), managerLead);
        
        // עדכון הקמפיין עם ה-ID של הליד של המנהל ומונה התחלתי
        await updateDoc(doc(db, CAMPAIGNS_COLLECTION, campaignId), {
            managerLeadId: leadRef.id,
            leadsCount: 1
        });

        return campaignId;
    } catch (error) {
        console.error('Error creating campaign:', error);
        throw error;
    }
}

/**
 * Get a single campaign by ID or prefix
 * @param {string} campaignId - Campaign document ID or prefix
 * @returns {Promise<Object|null>} - Campaign data or null
 */
export async function getCampaign(campaignId) {
    const db = getDbInstance();
    
    try {
        // If it's a prefix (short ID), find the full ID
        let targetId = campaignId;
        if (campaignId.length < 15) {
            const q = query(collection(db, CAMPAIGNS_COLLECTION));
            const querySnapshot = await getDocs(q);
            const match = querySnapshot.docs.find(doc => doc.id.startsWith(campaignId));
            if (match) {
                targetId = match.id;
            } else {
                return null;
            }
        }

        const docRef = doc(db, CAMPAIGNS_COLLECTION, targetId);
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
        
        // עדכון מונה הנרשמים בקמפיין באופן אטומי
        const campaignRef = doc(db, CAMPAIGNS_COLLECTION, campaignId);
        await updateDoc(campaignRef, {
            leadsCount: increment(1)
        });
        
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
 * @param {string} referrerId - Lead ID or prefix of the referrer
 */
export async function addTicketToReferrer(campaignId, referrerId) {
    const db = getDbInstance();
    
    try {
        let targetLeadId = referrerId;

        // If it's a prefix (short ID), find the full ID
        if (referrerId.length < 20) {
            const leadsRef = collection(db, CAMPAIGNS_COLLECTION, campaignId, LEADS_SUBCOLLECTION);
            const querySnapshot = await getDocs(leadsRef);
            const matchingLead = querySnapshot.docs.find(doc => doc.id.startsWith(referrerId));
            if (matchingLead) {
                targetLeadId = matchingLead.id;
            } else {
                console.warn('No lead found matching prefix:', referrerId);
                return;
            }
        }

        const leadRef = doc(db, CAMPAIGNS_COLLECTION, campaignId, LEADS_SUBCOLLECTION, targetLeadId);
        await updateDoc(leadRef, {
            tickets: increment(1)
        });
        console.log('Added ticket to referrer:', targetLeadId);
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

/**
 * Get a single lead by its ID
 * @param {string} campaignId 
 * @param {string} leadId 
 * @returns {Promise<Object|null>}
 */
export async function getLead(campaignId, leadId) {
    const db = getDbInstance();
    try {
        const leadRef = doc(db, CAMPAIGNS_COLLECTION, campaignId, LEADS_SUBCOLLECTION, leadId);
        const leadDoc = await getDoc(leadRef);
        return leadDoc.exists() ? { id: leadDoc.id, ...leadDoc.data() } : null;
    } catch (error) {
        console.error('Error getting lead:', error);
        throw error;
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
 * Get all ACTIVE campaigns for the public "Open Lotteries" page
 * @returns {Promise<Array>} - Array of active campaigns
 */
export async function getActiveCampaigns() {
    const db = getDbInstance();
    try {
        const now = new Date();
        const q = query(
            collection(db, CAMPAIGNS_COLLECTION),
            where('isActive', '==', true),
            where('endDate', '>', now),
            orderBy('endDate', 'asc')
        );
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error('Error getting active campaigns:', error);
        // Fallback if index isn't ready: filter client-side
        const now = new Date();
        const q = query(collection(db, CAMPAIGNS_COLLECTION), where('isActive', '==', true));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(c => {
                const campaignEnd = c.endDate?.toDate ? c.endDate.toDate() : new Date(c.endDate);
                return campaignEnd > now;
            });
    }
}

/**
 * Get top leads for a campaign leaderboard
 * @param {string} campaignId 
 * @param {number} limitCount
 * @returns {Promise<Array>}
 */
export async function getLeaderboard(campaignId, limitCount = 5) {
    const db = getDbInstance();
    try {
        const leadsRef = collection(db, CAMPAIGNS_COLLECTION, campaignId, LEADS_SUBCOLLECTION);
        const q = query(leadsRef, orderBy('tickets', 'desc'), limit(limitCount));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error('Error getting leaderboard:', error);
        return [];
    }
}

/**
 * Find lead by phone number in a specific campaign
 * @param {string} campaignId 
 * @param {string} phone 
 * @returns {Promise<Object|null>}
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
