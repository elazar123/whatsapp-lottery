/**
 * Public Controller
 * Handles public campaign page logic, URL parsing, registration, and viral tasks
 */

import { initFirebase } from '../config/firebase.js';
import { getCampaign, incrementViewCount, saveLead, updateLeadTasks, findLeadByPhone, getLead } from '../services/db.js';
import { generateVCard, downloadVCard } from '../utils/vcfGenerator.js';
import { generateWhatsAppUrl, generateCampaignShareUrl } from '../utils/whatsappUrl.js';
import { launchConfetti } from '../utils/confetti.js';

// State
let currentCampaign = null;
let currentLeadId = null;
let tasksState = {
    savedContact: false,
    sharedWhatsapp: false
};

// DOM Elements cache
const elements = {};

/* ==========================================================================
   Initialization
   ========================================================================== */

/**
 * Initialize the public controller
 */
async function init() {
    // Initialize Firebase
    initFirebase();
    
    // Cache DOM elements
    cacheElements();
    
    // Get campaign ID from URL
    const campaignId = getCampaignIdFromUrl();
    
    if (!campaignId) {
        showError('לא נמצא קמפיין. אנא בדקו את הקישור.');
        return;
    }
    
    // Load campaign
    await loadCampaign(campaignId);
}

/**
 * Cache frequently accessed DOM elements
 */
function cacheElements() {
    elements.loadingState = document.getElementById('loading-state');
    elements.errorState = document.getElementById('error-state');
    elements.errorMessage = document.getElementById('error-message');
    elements.campaignContent = document.getElementById('campaign-content');
    elements.campaignTitle = document.getElementById('campaign-title');
    elements.campaignDescription = document.getElementById('campaign-description');
    elements.registrationForm = document.getElementById('registration-form');
    elements.stepRegistration = document.getElementById('step-registration');
    elements.stepTasks = document.getElementById('step-tasks');
    elements.stepSuccess = document.getElementById('step-success');
    elements.btnSaveContact = document.getElementById('btn-save-contact');
    elements.btnShareWhatsapp = document.getElementById('btn-share-whatsapp');
    elements.btnFinish = document.getElementById('btn-finish');
    elements.taskContact = document.getElementById('task-contact');
    elements.taskWhatsapp = document.getElementById('task-whatsapp');
    
    // Countdown elements
    elements.days = document.getElementById('days');
    elements.hours = document.getElementById('hours');
    elements.minutes = document.getElementById('minutes');
    elements.seconds = document.getElementById('seconds');
}

/**
 * Get campaign ID from URL query parameter
 * @returns {string|null}
 */
function getCampaignIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('c') || urlParams.get('campaign');
}

/**
 * Get referrer lead ID from URL (for ticket system)
 * @returns {string|null}
 */
function getReferrerFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('ref');
}

/* ==========================================================================
   Campaign Loading
   ========================================================================== */

/**
 * Load campaign data and initialize page
 * @param {string} campaignId 
 */
async function loadCampaign(campaignId) {
    try {
        const campaign = await getCampaign(campaignId);
        
        if (!campaign) {
            showError('הקמפיין לא נמצא או שפג תוקפו.');
            return;
        }
        
        // Check if campaign is still active
        const endDate = campaign.endDate?.toDate ? campaign.endDate.toDate() : new Date(campaign.endDate);
        if (endDate < new Date()) {
            showError('ההגרלה הסתיימה. תודה על ההתעניינות!');
            return;
        }
        
        if (!campaign.isActive) {
            showError('ההגרלה אינה פעילה כרגע.');
            return;
        }
        
        // Store campaign
        currentCampaign = campaign;
        
        // Increment view count (fire and forget)
        incrementViewCount(campaignId);
        
        // Apply theme
        applyTheme(campaign.theme);
        
        // Populate content
        populateCampaignContent(campaign);
        
        // Setup event listeners
        setupEventListeners();
        
        // Start countdown
        startCountdown(endDate);
        
        // Show content
        showContent();
        
    } catch (error) {
        console.error('Error loading campaign:', error);
        showError('אירעה שגיאה בטעינת ההגרלה. נסו שוב מאוחר יותר.');
    }
}

/**
 * Apply campaign theme colors
 * @param {Object} theme 
 */
function applyTheme(theme) {
    if (!theme) return;
    
    const root = document.documentElement;
    
    if (theme.primaryColor) {
        root.style.setProperty('--campaign-primary', theme.primaryColor);
        // Generate hover color (slightly darker)
        root.style.setProperty('--campaign-primary-hover', darkenColor(theme.primaryColor, 10));
    }
    
    if (theme.backgroundColor) {
        root.style.setProperty('--campaign-bg', theme.backgroundColor);
    }
}

/**
 * Darken a hex color by percentage
 * @param {string} hex 
 * @param {number} percent 
 * @returns {string}
 */
function darkenColor(hex, percent) {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max((num >> 16) - amt, 0);
    const G = Math.max((num >> 8 & 0x00FF) - amt, 0);
    const B = Math.max((num & 0x0000FF) - amt, 0);
    return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}

/**
 * Populate campaign content in DOM
 * @param {Object} campaign 
 */
function populateCampaignContent(campaign) {
    if (elements.campaignTitle) {
        elements.campaignTitle.textContent = campaign.title;
    }
    
    if (elements.campaignDescription) {
        elements.campaignDescription.textContent = campaign.description || '';
    }
    
    // Show banner if exists
    if (campaign.bannerUrl) {
        const bannerContainer = document.getElementById('campaign-banner');
        const bannerImage = document.getElementById('banner-image');
        if (bannerContainer && bannerImage) {
            bannerImage.src = campaign.bannerUrl;
            bannerImage.alt = campaign.title;
            bannerContainer.classList.remove('hidden');
        }
    }
    
    // Update page title
    document.title = campaign.title + ' | הגרלה';
    
    // Update meta tags for social sharing
    updateMetaTags(campaign);
}

/**
 * Update meta tags for social sharing (WhatsApp, Facebook, Twitter, etc.)
 * @param {Object} campaign 
 */
function updateMetaTags(campaign) {
    const title = campaign.title;
    const description = campaign.description || 'הירשמו להגרלה וזכו בפרסים מדהימים!';
    const imageUrl = campaign.bannerUrl || '';
    const pageUrl = window.location.href;
    
    // Update standard meta
    updateMetaTag('meta-description', 'content', description);
    
    // Update Open Graph (Facebook, WhatsApp, LinkedIn)
    updateMetaTag('og-title', 'content', title);
    updateMetaTag('og-description', 'content', description);
    updateMetaTag('og-image', 'content', imageUrl);
    updateMetaTag('og-url', 'content', pageUrl);
    
    // Update Twitter
    updateMetaTag('twitter-title', 'content', title);
    updateMetaTag('twitter-description', 'content', description);
    updateMetaTag('twitter-image', 'content', imageUrl);
    
    // Update page title
    const pageTitle = document.getElementById('page-title');
    if (pageTitle) pageTitle.textContent = title + ' | הגרלה';
}

/**
 * Helper to update meta tag by ID
 */
function updateMetaTag(id, attr, value) {
    const el = document.getElementById(id);
    if (el && value) {
        el.setAttribute(attr, value);
    }
}

/* ==========================================================================
   Countdown Timer
   ========================================================================== */

let countdownInterval = null;

/**
 * Start countdown timer
 * @param {Date} endDate 
 */
function startCountdown(endDate) {
    if (countdownInterval) {
        clearInterval(countdownInterval);
    }
    
    function updateCountdown() {
        const now = new Date().getTime();
        const distance = endDate.getTime() - now;
        
        if (distance < 0) {
            clearInterval(countdownInterval);
            elements.days.textContent = '00';
            elements.hours.textContent = '00';
            elements.minutes.textContent = '00';
            elements.seconds.textContent = '00';
            return;
        }
        
        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);
        
        if (elements.days) elements.days.textContent = String(days).padStart(2, '0');
        if (elements.hours) elements.hours.textContent = String(hours).padStart(2, '0');
        if (elements.minutes) elements.minutes.textContent = String(minutes).padStart(2, '0');
        if (elements.seconds) elements.seconds.textContent = String(seconds).padStart(2, '0');
    }
    
    // Update immediately and then every second
    updateCountdown();
    countdownInterval = setInterval(updateCountdown, 1000);
}

/* ==========================================================================
   Event Listeners
   ========================================================================== */

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Registration form
    elements.registrationForm?.addEventListener('submit', handleRegistration);
    
    // Task buttons
    elements.btnSaveContact?.addEventListener('click', handleSaveContact);
    elements.btnShareWhatsapp?.addEventListener('click', handleShareWhatsapp);
    
    // Finish button
    elements.btnFinish?.addEventListener('click', handleFinish);
}

/* ==========================================================================
   Registration Flow
   ========================================================================== */

/**
 * Handle registration form submission
 * @param {Event} e 
 */
async function handleRegistration(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const fullName = formData.get('fullName')?.trim();
    const phone = normalizePhone(formData.get('phone')?.trim());
    
    if (!fullName || !phone) {
        alert('אנא מלאו את כל השדות');
        return;
    }
    
    // Validate phone
    if (!isValidPhone(phone)) {
        alert('אנא הזינו מספר טלפון תקין');
        return;
    }
    
    try {
        // Check if already registered
        const existingLead = await findLeadByPhone(currentCampaign.id, phone);
        
        if (existingLead) {
            currentLeadId = existingLead.id;
            tasksState = existingLead.tasksCompleted || { savedContact: false, sharedWhatsapp: false };
            
            // Update UI based on existing tasks
            updateTasksUI();
            
            // If all tasks completed, show success
            if (tasksState.savedContact && tasksState.sharedWhatsapp) {
                showStep('success');
            } else {
                showStep('tasks');
            }
            return;
        }
        
        // Get referrer from URL (if someone shared this link)
        const referredBy = getReferrerFromUrl();
        
        // Save new lead (with referral info for ticket system)
        currentLeadId = await saveLead(currentCampaign.id, { 
            fullName, 
            phone,
            referredBy 
        });
        
        // Show tasks step
        showStep('tasks');
        
    } catch (error) {
        console.error('Error registering:', error);
        alert('אירעה שגיאה בהרשמה: ' + (error.message || 'נסו שוב.'));
    }
}

/**
 * Normalize phone number
 * @param {string} phone 
 * @returns {string}
 */
function normalizePhone(phone) {
    if (!phone) return '';
    // Remove all non-digits
    return phone.replace(/\D/g, '');
}

/**
 * Validate phone number
 * @param {string} phone 
 * @returns {boolean}
 */
function isValidPhone(phone) {
    // More flexible validation - at least 9 digits
    const normalized = normalizePhone(phone);
    return normalized.length >= 9 && normalized.length <= 15;
}

/* ==========================================================================
   Task Handlers
   ========================================================================== */

/**
 * Handle save contact task
 */
function handleSaveContact() {
    if (!currentCampaign) return;
    
    // Generate and download VCard
    const vcard = generateVCard(
        currentCampaign.contactVcardName,
        currentCampaign.contactPhoneNumber
    );
    
    downloadVCard(vcard, currentCampaign.contactVcardName);
    
    // Mark task as completed
    tasksState.savedContact = true;
    updateTasksUI();
    
    // Update in database
    if (currentLeadId) {
        updateLeadTasks(currentCampaign.id, currentLeadId, { savedContact: true });
    }
}

/**
 * Handle share on WhatsApp task
 */
function handleShareWhatsapp() {
    if (!currentCampaign) return;
    
    // Generate campaign link with referral ID for ticket system
    // Use OG endpoint for proper social preview + ref parameter
    let campaignLink = `${window.location.host}/api/og?c=${currentCampaign.id}`;
    
    // Add referral ID if user is registered (for ticket system)
    if (currentLeadId) {
        campaignLink += `&ref=${currentLeadId}`;
    }
    
    // Generate WhatsApp URL and open
    const whatsappUrl = generateCampaignShareUrl(
        currentCampaign.whatsappShareText || 'בואו להשתתף בהגרלה! {{link}}',
        campaignLink
    );
    window.open(whatsappUrl, '_blank');
    
    // Mark task as completed
    tasksState.sharedWhatsapp = true;
    updateTasksUI();
    
    // Update in database
    if (currentLeadId) {
        updateLeadTasks(currentCampaign.id, currentLeadId, { sharedWhatsapp: true });
    }
}

/**
 * Handle finish button click
 */
function handleFinish() {
    if (tasksState.savedContact && tasksState.sharedWhatsapp) {
        showStep('success');
        // Launch confetti celebration!
        launchConfetti();
    }
}

/**
 * Update tasks UI based on current state
 */
async function updateTasksUI() {
    // Update contact task
    if (tasksState.savedContact) {
        elements.taskContact?.classList.add('completed');
        elements.taskContact?.querySelector('.task-check')?.classList.remove('hidden');
    }
    
    // Update WhatsApp task
    if (tasksState.sharedWhatsapp) {
        elements.taskWhatsapp?.classList.add('completed');
        elements.taskWhatsapp?.querySelector('.task-check')?.classList.remove('hidden');
    }
    
    // Update finish button
    if (elements.btnFinish) {
        const allCompleted = tasksState.savedContact && tasksState.sharedWhatsapp;
        elements.btnFinish.disabled = !allCompleted;
    }

    // Update tickets count in success step
    if (currentLeadId && currentCampaign) {
        try {
            const lead = await getLead(currentCampaign.id, currentLeadId);
            const ticketsCountEl = document.getElementById('user-tickets-count');
            if (ticketsCountEl && lead) {
                ticketsCountEl.textContent = lead.tickets || 1;
            }
        } catch (error) {
            console.error('Error updating tickets count:', error);
        }
    }
}

/* ==========================================================================
   View Management
   ========================================================================== */

/**
 * Show loading state
 */
function showLoading() {
    elements.loadingState?.classList.remove('hidden');
    elements.errorState?.classList.add('hidden');
    elements.campaignContent?.classList.add('hidden');
}

/**
 * Show error state
 * @param {string} message 
 */
function showError(message) {
    elements.loadingState?.classList.add('hidden');
    elements.errorState?.classList.remove('hidden');
    elements.campaignContent?.classList.add('hidden');
    
    if (elements.errorMessage) {
        elements.errorMessage.textContent = message;
    }
}

/**
 * Show campaign content
 */
function showContent() {
    elements.loadingState?.classList.add('hidden');
    elements.errorState?.classList.add('hidden');
    elements.campaignContent?.classList.remove('hidden');
}

/**
 * Show specific step
 * @param {'registration'|'tasks'|'success'} step 
 */
function showStep(step) {
    elements.stepRegistration?.classList.add('hidden');
    elements.stepTasks?.classList.add('hidden');
    elements.stepSuccess?.classList.add('hidden');
    
    switch (step) {
        case 'registration':
            elements.stepRegistration?.classList.remove('hidden');
            break;
        case 'tasks':
            elements.stepTasks?.classList.remove('hidden');
            break;
        case 'success':
            elements.stepSuccess?.classList.remove('hidden');
            break;
    }
}

/* ==========================================================================
   Initialize on DOM Ready
   ========================================================================== */
document.addEventListener('DOMContentLoaded', init);
