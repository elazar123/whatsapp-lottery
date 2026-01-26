/**
 * Public Controller
 * Handles public campaign page logic, URL parsing, registration, and viral tasks
 */

import { initFirebase } from '../config/firebase.js';
import { getCampaign, incrementViewCount, saveLead, updateLeadTasks, findLeadByPhone, getLead, getLeaderboard } from '../services/db.js';
import { generateVCard, downloadVCard } from '../utils/vcfGenerator.js';
import { generateWhatsAppUrl, generateCampaignShareUrl, openWhatsAppShare, shortenUrl } from '../utils/whatsappUrl.js';
import { shareCampaign } from '../services/sharingService.js';
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
        showHomePage();
        return;
    }
    
    // Load campaign
    await loadCampaign(campaignId);
}

/**
 * Show the project homepage
 */
function showHomePage() {
    if (elements.loadingState) elements.loadingState.classList.add('hidden');
    const homePage = document.getElementById('home-page');
    if (homePage) homePage.classList.remove('hidden');
    // Set page title for homepage
    document.title = 'WhatsApp Lottery - הגרלות ויראליות בוואטסאפ';
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
    elements.groupEmail = document.getElementById('group-email');
    elements.inputEmail = document.getElementById('email');
    elements.stepRegistration = document.getElementById('step-registration');
    elements.stepSuccess = document.getElementById('step-success');
    elements.btnSaveContact = document.getElementById('btn-save-contact');
    elements.btnShareWhatsapp = document.getElementById('btn-share-whatsapp');
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
    return urlParams.get('r') || urlParams.get('ref');
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
        
        // Show social proof occasionally
        setInterval(() => {
            if (document.visibilityState === 'visible') {
                showSocialProof();
            }
        }, 8000);
        
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
        // Preserve line breaks and spacing from the textarea
        const description = campaign.description || '';
        // textContent with white-space: pre-wrap will preserve line breaks
        elements.campaignDescription.textContent = description;
    }
    
    // Show/hide email field
    if (campaign.collectEmail && elements.groupEmail) {
        elements.groupEmail.classList.remove('hidden');
        if (elements.inputEmail) elements.inputEmail.required = true;
    } else if (elements.groupEmail) {
        elements.groupEmail.classList.add('hidden');
        if (elements.inputEmail) elements.inputEmail.required = false;
    }
    
    // Show video if exists (priority over banner)
    if (campaign.shareVideoUrl) {
        console.log('🎥 Found video URL:', campaign.shareVideoUrl);
        const videoContainer = document.getElementById('campaign-video');
        const videoPlayer = document.getElementById('campaign-video-player');
        const videoSource = document.getElementById('campaign-video-source');
        
        if (videoContainer && videoPlayer && videoSource) {
            console.log('✅ Video elements found, setting source...');
            videoSource.src = campaign.shareVideoUrl;
            videoPlayer.load(); // Reload video with new source
            videoContainer.classList.remove('hidden');
            console.log('✅ Video container shown');
        } else {
            console.error('❌ Video elements not found:', {
                videoContainer: !!videoContainer,
                videoPlayer: !!videoPlayer,
                videoSource: !!videoSource
            });
        }
    } 
    // Show banner if exists and no video
    else if (campaign.bannerUrl) {
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
    
    // Update meta tags for social sharing (must be called after content is populated)
    updateMetaTags(campaign);
    
    console.log('📋 Meta tags updated for campaign:', {
        title: campaign.title,
        hasShareImage: !!campaign.shareImageUrl,
        hasShareVideo: !!campaign.shareVideoUrl,
        hasBanner: !!campaign.bannerUrl
    });
}

/**
 * Update meta tags for social sharing (WhatsApp, Facebook, Twitter, etc.)
 * @param {Object} campaign 
 */
function updateMetaTags(campaign) {
    const title = campaign.title;
    const description = campaign.description || 'הירשמו להגרלה וזכו בפרסים מדהימים!';
    
    // Use share image if available, otherwise banner, otherwise default
    const defaultImage = 'https://images.unsplash.com/photo-1596742572445-d93531c099d5?q=80&w=1200&h=630&auto=format&fit=crop';
    const imageUrl = campaign.shareImageUrl || campaign.bannerUrl || defaultImage;
    const pageUrl = window.location.href;
    
    // Update standard meta
    updateMetaTag('meta-description', 'content', description);
    
    // Update Open Graph (Facebook, WhatsApp, LinkedIn)
    updateMetaTag('og-title', 'content', title);
    updateMetaTag('og-description', 'content', description);
    updateMetaTag('og-image', 'content', imageUrl);
    updateMetaTag('og-url', 'content', pageUrl);
    
    // Update video if available
    const videoUrl = campaign.shareVideoUrl;
    if (videoUrl) {
        updateMetaTag('og-video', 'content', videoUrl);
        updateMetaTag('og-video-type', 'content', 'video/mp4');
        updateMetaTag('og-video:width', 'content', '1200');
        updateMetaTag('og-video:height', 'content', '630');
    } else {
        // Remove video tags if no video
        const ogVideo = document.querySelector('meta[property="og:video"]');
        const ogVideoType = document.querySelector('meta[property="og:video:type"]');
        if (ogVideo) ogVideo.remove();
        if (ogVideoType) ogVideoType.remove();
    }
    
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
    if (el) {
        if (value) {
            el.setAttribute(attr, value);
        } else {
            // If no value, remove the attribute or set empty
            el.removeAttribute(attr);
        }
    } else {
        console.warn(`⚠️ Meta tag element not found: #${id}`);
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
            if (elements.days) elements.days.textContent = '00';
            if (elements.hours) elements.hours.textContent = '00';
            if (elements.minutes) elements.minutes.textContent = '00';
            if (elements.seconds) elements.seconds.textContent = '00';
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
    const email = formData.get('email')?.trim();
    
    if (!fullName || !phone || (currentCampaign.collectEmail && !email)) {
        alert('אנא מלאו את כל השדות');
        return;
    }
    
    if (!isValidPhone(phone)) {
        alert('אנא הזינו מספר טלפון תקין');
        return;
    }

    try {
        // Show loading state on button
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = 'נרשם...';

        // Check if already registered
        const existingLead = await findLeadByPhone(currentCampaign.id, phone);
        
        if (existingLead) {
            currentLeadId = existingLead.id;
            tasksState = existingLead.tasksCompleted || { savedContact: false, sharedWhatsapp: false };
            updateTasksUI();
            
            // Update success message with personalized message
            updateSuccessMessage(fullName);
            
            // Hide ALL campaign content BEFORE showing success page
            hideCampaignContent();
            
            showStep('success');
            loadAndShowLeaderboard();
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
            return;
        }
        
        const referredBy = getReferrerFromUrl();
        
        // Save new lead
        currentLeadId = await saveLead(currentCampaign.id, { 
            fullName, 
            phone,
            email: email || '',
            referredBy,
            joinedAt: new Date().toISOString()
        });
        
        // Update success message with personalized message if available
        updateSuccessMessage(fullName);
        
        // Hide ALL campaign content BEFORE showing success page
        hideCampaignContent();
        
        showStep('success');
        launchConfetti();
        loadAndShowLeaderboard();
        showSocialProof(fullName.split(' ')[0]);
        
    } catch (error) {
        console.error('Error registering:', error);
        alert('אירעה שגיאה בהרשמה. נסו שוב.');
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
 * Download file from URL and convert to File object
 * @param {string} url - File URL
 * @param {string} filename - Desired filename
 * @returns {Promise<File>} - File object
 */
async function urlToFile(url, filename) {
    try {
        console.log('⬇️ Downloading file from:', url);
        const response = await fetch(url, {
            mode: 'cors',
            credentials: 'omit',
            cache: 'no-cache'
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
        }
        
        const contentType = response.headers.get('content-type') || 'image/jpeg';
        console.log('📦 Content-Type:', contentType);
        
        const blob = await response.blob();
        console.log('📦 Blob size:', blob.size, 'bytes, type:', blob.type);
        
        const file = new File([blob], filename, { type: contentType });
        console.log('✅ File created:', file.name, file.size, 'bytes, type:', file.type);
        
        return file;
    } catch (error) {
        console.error('❌ Error downloading file for sharing:', error);
        console.error('Error details:', {
            message: error.message,
            name: error.name,
            stack: error.stack
        });
        // If CORS fails, we can't use Web Share API with files
        // Fall back to URL sharing only
        throw error;
    }
}

/**
 * Handle share on WhatsApp task
 */
async function handleShareWhatsapp() {
    if (!currentCampaign) return;
    
    // Use the current domain dynamically
    const currentOrigin = window.location.origin;
    const currentPath = window.location.pathname.replace('index.html', '');
    
    // Always use GitHub Pages format (query parameters)
    const url = new URL(currentOrigin + currentPath + 'index.html');
    url.searchParams.set('c', currentCampaign.id);
    if (currentLeadId) url.searchParams.set('ref', currentLeadId);
    const rawCampaignLink = url.toString();
    
    // Shorten the URL
    const campaignLink = await shortenUrl(rawCampaignLink);
    
    // Prepare share text (without link, as shareCampaign will add it)
    const shareTextTemplate = currentCampaign.whatsappShareText || 'בואו להשתתף בהגרלה!';
    let shareText = shareTextTemplate;
    // Remove {{link}} placeholder if exists, as we'll add the link separately
    shareText = shareText.replace(/\{\{link\}\}/g, '').trim();
    
    // Use the new sharing service
    const result = await shareCampaign(
        currentCampaign.title || 'הגרלה מיוחדת',
        shareText,
        campaignLink,
        currentCampaign.shareImageUrl || null
    );
    
    console.log('📤 Share result:', result);
    
    // Mark task as completed
    tasksState.sharedWhatsapp = true;
    updateTasksUI();
    
    // Update in database
    if (currentLeadId) {
        updateLeadTasks(currentCampaign.id, currentLeadId, { sharedWhatsapp: true });
    }
}

/**
 * Fetch and render leaderboard
 */
async function loadAndShowLeaderboard() {
    const container = document.getElementById('leaderboard-container');
    const listEl = document.getElementById('leaderboard-list');
    
    if (!container || !listEl || !currentCampaign) return;
    
    try {
        const topLeads = await getLeaderboard(currentCampaign.id, 5);
        
        if (topLeads.length > 0) {
            listEl.innerHTML = topLeads.map((lead, index) => {
                // Mask name for privacy (optional, but professional)
                const nameParts = lead.fullName.split(' ');
                const maskedName = nameParts[0] + (nameParts[1] ? ' ' + nameParts[1][0] + '.' : '');
                
                return `
                    <div class="leaderboard-item">
                        <span class="leaderboard-rank">${index + 1}</span>
                        <span class="leaderboard-name">${escapeHtml(maskedName)}</span>
                        <span class="leaderboard-tickets">🎫 ${lead.tickets || 1}</span>
                    </div>
                `;
            }).join('');
            
            container.classList.remove('hidden');
        }
    } catch (error) {
        console.error('Error loading leaderboard:', error);
    }
}

/**
 * Show a social proof notification
 */
function showSocialProof(name) {
    let toast = document.getElementById('social-proof-toast');
    
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'social-proof-toast';
        toast.className = 'social-proof-toast';
        document.body.appendChild(toast);
    }
    
    const firstNames = ['מיכל', 'דניאל', 'נועה', 'איתי', 'יובל', 'מאיה', 'רוני', 'עידו'];
    const randomName = name || firstNames[Math.floor(Math.random() * firstNames.length)];
    
    toast.innerHTML = `
        <div class="toast-avatar">👤</div>
        <div class="toast-content">
            <strong>${randomName}</strong> נרשם/ה עכשיו להגרלה!
        </div>
    `;
    
    setTimeout(() => toast.classList.add('show'), 100);
    setTimeout(() => toast.classList.remove('show'), 4000);
}

/**
 * Escape HTML
 */
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
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
    if (elements.loadingState) elements.loadingState.classList.add('hidden');
    if (elements.errorState) elements.errorState.classList.remove('hidden');
    if (elements.campaignContent) elements.campaignContent.classList.add('hidden');
    
    if (elements.errorMessage) {
        elements.errorMessage.textContent = message;
    }
}

/**
 * Show campaign content
 */
function showContent() {
    if (elements.loadingState) elements.loadingState.classList.add('hidden');
    if (elements.errorState) elements.errorState.classList.add('hidden');
    if (elements.campaignContent) elements.campaignContent.classList.remove('hidden');
}

/**
 * Hide all campaign content (header, countdown, banner, video)
 */
function hideCampaignContent() {
    // Hide campaign header
    const header = document.querySelector('.campaign-header');
    if (header) {
        header.classList.add('hidden');
        header.style.display = 'none';
    }
    
    // Hide countdown section
    const countdown = document.querySelector('.countdown-section');
    if (countdown) {
        countdown.classList.add('hidden');
        countdown.style.display = 'none';
    }
    
    // Hide banner
    const banner = document.getElementById('campaign-banner');
    if (banner) {
        banner.classList.add('hidden');
        banner.style.display = 'none';
    }
    
    // Hide video
    const video = document.getElementById('campaign-video');
    if (video) {
        video.classList.add('hidden');
        video.style.display = 'none';
    }
    
    // Hide brand logo
    const brandLogo = document.getElementById('brand-logo');
    if (brandLogo) {
        brandLogo.classList.add('hidden');
        brandLogo.style.display = 'none';
    }
    
    // Hide campaign title and description
    const campaignTitle = document.getElementById('campaign-title');
    const campaignDesc = document.getElementById('campaign-description');
    if (campaignTitle) {
        campaignTitle.classList.add('hidden');
        campaignTitle.style.display = 'none';
    }
    if (campaignDesc) {
        campaignDesc.classList.add('hidden');
        campaignDesc.style.display = 'none';
    }
    
    // Also hide by class names to be extra sure
    document.querySelectorAll('.campaign-header').forEach(el => {
        el.classList.add('hidden');
        el.style.display = 'none';
    });
    
    document.querySelectorAll('.countdown-section').forEach(el => {
        el.classList.add('hidden');
        el.style.display = 'none';
    });
    
    document.querySelectorAll('.campaign-banner').forEach(el => {
        el.classList.add('hidden');
        el.style.display = 'none';
    });
    
    document.querySelectorAll('.campaign-video').forEach(el => {
        el.classList.add('hidden');
        el.style.display = 'none';
    });
}

/**
 * Update success message with personalized message
 * @param {string} fullName - User's full name
 */
function updateSuccessMessage(fullName) {
    const successTitle = document.querySelector('.success-title');
    const successMessage = document.querySelector('.success-message');
    
    // Use custom thank you message if available, otherwise use default
    if (currentCampaign && currentCampaign.thankYouMessage) {
        // Replace {{name}} placeholder with user's first name
        const firstName = fullName.split(' ')[0];
        let customMessage = currentCampaign.thankYouMessage;
        customMessage = customMessage.replace(/\{\{name\}\}/g, firstName);
        customMessage = customMessage.replace(/\{\{fullName\}\}/g, fullName);
        
        if (successMessage) {
            successMessage.textContent = customMessage;
        }
    } else {
        // Default message
        if (successMessage) {
            successMessage.textContent = 'פרטיכם נקלטו במערכת ואתם משתתפים בהגרלה.';
        }
    }
}

/**
 * Show specific step
 * @param {'registration'|'success'} step 
 */
function showStep(step) {
    elements.stepRegistration?.classList.add('hidden');
    elements.stepSuccess?.classList.add('hidden');
    
    switch (step) {
        case 'registration':
            elements.stepRegistration?.classList.remove('hidden');
            // Show campaign content (header, countdown, etc.)
            if (elements.campaignContent) {
                elements.campaignContent.classList.remove('hidden');
            }
            // Show campaign header and countdown
            const campaignHeader = document.querySelector('.campaign-header');
            const countdownSection = document.querySelector('.countdown-section');
            if (campaignHeader) campaignHeader.classList.remove('hidden');
            if (countdownSection) countdownSection.classList.remove('hidden');
            break;
        case 'success':
            // Hide ALL campaign content first
            hideCampaignContent();
            // Then show success page
            elements.stepSuccess?.classList.remove('hidden');
            break;
    }
}

/**
 * Format date for display
 */
function formatDate(timestamp) {
    if (!timestamp) return '--';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('he-IL', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/* ==========================================================================
   Initialize on DOM Ready
   ========================================================================== */
document.addEventListener('DOMContentLoaded', init);
