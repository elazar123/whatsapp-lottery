/**
 * Admin Controller
 * Handles all admin dashboard logic, form handling, and live preview
 */

import { initFirebase } from '../config/firebase.js';
import { signInWithGoogle, signOut, onAuthStateChanged, getCurrentUser } from '../services/auth.js';
import { 
    createCampaign, 
    getCampaignsByManager, 
    getCampaign,
    updateCampaign,
    deleteCampaign,
    getLeadsByCampaign,
    getAllCampaigns,
    getAllUsers
} from '../services/db.js';
import { notifyNewCampaignCreated } from '../services/emailNotifications.js';
import { ADMIN_CONFIG, isSuperAdmin } from '../config/admin.js';
import { showSpinningWheel } from '../utils/spinningWheel.js';
import { downloadMultipleContacts } from '../utils/vcfGenerator.js';
import { uploadImage } from '../services/imageUpload.js';

// State
let currentUser = null;
let currentView = 'campaigns';
let editingCampaignId = null;
let campaigns = [];
let allUsers = [];
let isSuperAdminUser = false;

// DOM Elements
const elements = {
    loginScreen: null,
    dashboard: null,
    viewCampaigns: null,
    viewCreate: null,
    viewDetails: null,
    // Will be populated on init
};

/* ==========================================================================
   Initialization
   ========================================================================== */

/**
 * Initialize the admin controller
 */
function init() {
    // Initialize Firebase
    initFirebase();
    
    // Cache DOM elements
    cacheElements();
    
    // Setup auth state listener
    onAuthStateChanged(handleAuthStateChange);
    
    // Setup event listeners
    setupEventListeners();
}

/**
 * Cache frequently accessed DOM elements
 */
function cacheElements() {
    elements.loginScreen = document.getElementById('login-screen');
    elements.dashboard = document.getElementById('dashboard');
    elements.viewCampaigns = document.getElementById('view-campaigns');
    elements.viewCreate = document.getElementById('view-create');
    elements.viewDetails = document.getElementById('view-details');
    elements.campaignsList = document.getElementById('campaigns-list');
    elements.campaignsEmpty = document.getElementById('campaigns-empty');
    elements.campaignForm = document.getElementById('campaign-form');
    elements.previewIframe = document.getElementById('preview-iframe');
    elements.userName = document.getElementById('user-name');
    elements.userEmail = document.getElementById('user-email');
    elements.userAvatar = document.getElementById('user-avatar');
}

/**
 * Setup all event listeners
 */
function setupEventListeners() {
    // Auth buttons
    document.getElementById('btn-google-login')?.addEventListener('click', handleGoogleLogin);
    document.getElementById('btn-logout')?.addEventListener('click', handleLogout);
    
    // Terms of Use logic
    const termsCheckbox = document.getElementById('terms-checkbox');
    const loginBtn = document.getElementById('btn-google-login');
    const showTermsBtn = document.getElementById('btn-show-terms');
    const termsModal = document.getElementById('terms-modal');
    const closeTermsBtn = document.getElementById('close-terms-modal');
    const closeTermsBottomBtn = document.getElementById('btn-close-terms-bottom');

    termsCheckbox?.addEventListener('change', (e) => {
        if (loginBtn) {
            loginBtn.disabled = !e.target.checked;
            loginBtn.style.opacity = e.target.checked ? '1' : '0.6';
            loginBtn.style.cursor = e.target.checked ? 'pointer' : 'not-allowed';
        }
    });

    showTermsBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        termsModal?.classList.remove('hidden');
    });

    [closeTermsBtn, closeTermsBottomBtn].forEach(btn => {
        btn?.addEventListener('click', () => {
            termsModal?.classList.add('hidden');
        });
    });
    
    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => handleNavigation(e.currentTarget.dataset.view));
    });
    
    // Campaign actions
    document.getElementById('btn-new-campaign')?.addEventListener('click', () => showCreateView());
    document.getElementById('btn-create-first')?.addEventListener('click', () => showCreateView());
    document.getElementById('btn-back-to-list')?.addEventListener('click', () => showCampaignsView());
    document.getElementById('btn-back-from-details')?.addEventListener('click', () => showCampaignsView());
    document.getElementById('btn-save-campaign')?.addEventListener('click', handleSaveCampaign);
    
    // Form live preview
    elements.campaignForm?.addEventListener('input', updateLivePreview);
    
    // Color picker value display
    document.getElementById('primary-color')?.addEventListener('input', (e) => {
        e.target.closest('.color-picker-wrapper').querySelector('.color-value').textContent = e.target.value;
    });
    document.getElementById('bg-color')?.addEventListener('input', (e) => {
        e.target.closest('.color-picker-wrapper').querySelector('.color-value').textContent = e.target.value;
    });
    
    // Device toggle for preview
    document.querySelectorAll('.device-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.device-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            const previewFrame = document.querySelector('.preview-frame');
            previewFrame.classList.remove('mobile', 'desktop');
            previewFrame.classList.add(e.target.dataset.device);
        });
    });
    
    // Campaign details actions
    document.getElementById('btn-copy-link')?.addEventListener('click', handleCopyLink);
    document.getElementById('btn-export-leads')?.addEventListener('click', handleExportLeads);
    document.getElementById('btn-delete-campaign')?.addEventListener('click', handleDeleteCampaign);
    document.getElementById('btn-edit-campaign')?.addEventListener('click', handleEditCampaign);
    document.getElementById('btn-select-winner')?.addEventListener('click', handleSelectWinner);
    document.getElementById('btn-export-vcf')?.addEventListener('click', handleExportVCF);
    
    // VCF Guide Modal
    document.getElementById('btn-show-vcf-guide')?.addEventListener('click', showVCFGuide);
    document.getElementById('close-vcf-guide')?.addEventListener('click', closeVCFGuide);
    document.querySelectorAll('.guide-tab').forEach(tab => {
        tab.addEventListener('click', (e) => switchGuideTab(e.target.dataset.tab));
    });
    
    // Image upload
    setupImageUpload();
}

/**
 * Show VCF import guide modal
 */
function showVCFGuide() {
    document.getElementById('vcf-guide-modal')?.classList.remove('hidden');
}

/**
 * Close VCF guide modal
 */
function closeVCFGuide() {
    document.getElementById('vcf-guide-modal')?.classList.add('hidden');
}

/**
 * Switch guide tab (iPhone/Android/Computer)
 */
function switchGuideTab(tabId) {
    // Update tab buttons
    document.querySelectorAll('.guide-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.guide-tab[data-tab="${tabId}"]`)?.classList.add('active');
    
    // Update panels
    document.querySelectorAll('.guide-panel').forEach(p => p.classList.remove('active'));
    document.getElementById(`guide-${tabId}`)?.classList.add('active');
}

/**
 * Setup image upload functionality
 */
function setupImageUpload() {
    const uploadArea = document.getElementById('banner-upload-area');
    const fileInput = document.getElementById('banner-upload');
    const preview = document.getElementById('banner-preview');
    const placeholder = document.getElementById('upload-placeholder');
    const removeBtn = document.getElementById('btn-remove-banner');
    const urlInput = document.getElementById('banner-url');
    
    if (!uploadArea || !fileInput) return;
    
    // Click to upload
    uploadArea.addEventListener('click', () => fileInput.click());
    
    // Prevent click propagation from remove button
    removeBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        removeBannerImage();
    });
    
    // Handle file selection
    fileInput.addEventListener('change', handleImageSelect);
    
    // Drag and drop
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });
    
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            processImage(file);
        }
    });
}

/**
 * Handle image file selection
 */
function handleImageSelect(e) {
    const file = e.target.files[0];
    if (file) {
        processImage(file);
    }
}

/**
 * Process and display selected image
 */
function processImage(file) {
    const preview = document.getElementById('banner-preview');
    const placeholder = document.getElementById('upload-placeholder');
    const removeBtn = document.getElementById('btn-remove-banner');
    const uploadArea = document.getElementById('banner-upload-area');
    const urlInput = document.getElementById('banner-url');
    
    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
        alert('הקובץ גדול מדי! מקסימום 5MB');
        return;
    }
    
    // Read and display preview
    const reader = new FileReader();
    reader.onload = (e) => {
        preview.src = e.target.result;
        preview.classList.remove('hidden');
        placeholder.classList.add('hidden');
        removeBtn.classList.remove('hidden');
        uploadArea.classList.add('has-image');
        
        // Store base64 for now (will be uploaded to Firebase Storage later)
        urlInput.value = e.target.result;
        
        // Trigger live preview update
        updateLivePreview();
    };
    reader.readAsDataURL(file);
}

/**
 * Remove banner image
 */
function removeBannerImage() {
    const preview = document.getElementById('banner-preview');
    const placeholder = document.getElementById('upload-placeholder');
    const removeBtn = document.getElementById('btn-remove-banner');
    const uploadArea = document.getElementById('banner-upload-area');
    const urlInput = document.getElementById('banner-url');
    const fileInput = document.getElementById('banner-upload');
    
    preview.src = '';
    preview.classList.add('hidden');
    placeholder.classList.remove('hidden');
    removeBtn.classList.add('hidden');
    uploadArea.classList.remove('has-image');
    urlInput.value = '';
    fileInput.value = '';
    
    updateLivePreview();
}

/**
 * Handle VCF export - download all leads as contacts
 */
async function handleExportVCF() {
    const campaignId = elements.viewDetails?.dataset.campaignId;
    if (!campaignId) return;
    
    try {
        const leads = await getLeadsByCampaign(campaignId);
        
        if (leads.length === 0) {
            alert('אין נרשמים לייצוא');
            return;
        }
        
        // Get campaign name for filename
        const campaign = campaigns.find(c => c.id === campaignId);
        const filename = campaign ? `leads_${campaign.title}` : 'leads';
        
        // Download all contacts as VCF
        downloadMultipleContacts(leads, filename);
        
        alert(`✅ ${leads.length} אנשי קשר הורדו בהצלחה!\n\nפתח את הקובץ בטלפון כדי לייבא את כל אנשי הקשר.`);
        
    } catch (error) {
        console.error('Error exporting VCF:', error);
        alert('שגיאה בייצוא אנשי הקשר');
    }
}

/**
 * Handle winner selection with spinning wheel
 */
async function handleSelectWinner() {
    const campaignId = elements.viewDetails?.dataset.campaignId;
    const winnerCount = parseInt(document.getElementById('winner-count')?.value) || 1;
    if (!campaignId) return;
    
    try {
        const leads = await getLeadsByCampaign(campaignId);
        
        if (leads.length === 0) {
            alert('אין משתתפים להגרלה! צריך לפחות נרשם אחד.');
            return;
        }

        // Create weighted pool based on tickets
        const weightedPool = [];
        leads.forEach(lead => {
            const ticketCount = lead.tickets || 1;
            for (let i = 0; i < ticketCount; i++) {
                weightedPool.push(lead);
            }
        });
        
        // Show spinning wheel
        showSpinningWheel(weightedPool, (winner) => {
            const winnerDisplay = document.getElementById('winner-display');
            const winnerList = document.getElementById('winner-list');
            
            if (winnerDisplay && winnerList) {
                // If we need more winners, select them randomly from the remaining
                const allWinners = [winner];
                
                if (winnerCount > 1) {
                    const remainingLeads = leads.filter(l => l.id !== winner.id);
                    // Shuffle and pick
                    const shuffled = [...remainingLeads].sort(() => 0.5 - Math.random());
                    allWinners.push(...shuffled.slice(0, winnerCount - 1));
                }

                winnerList.innerHTML = allWinners.map(w => `
                    <div class="winner-item">
                        <span>${escapeHtml(w.fullName)}</span>
                        <span>${escapeHtml(w.phone)}</span>
                    </div>
                `).join('');
                
                winnerDisplay.classList.remove('hidden');
            }
        });
        
    } catch (error) {
        console.error('Error selecting winner:', error);
        alert('שגיאה בבחירת זוכה');
    }
}

/* ==========================================================================
   Auth Handlers
   ========================================================================== */

/**
 * Handle auth state changes
 * @param {User|null} user 
 */
function handleAuthStateChange(user) {
    currentUser = user;
    
    if (user) {
        // בדיקה אם המשתמש הוא סופר אדמין
        isSuperAdminUser = isSuperAdmin(user.email);
        
        // User is signed in
        showDashboard();
        updateUserInfo(user);
        loadCampaigns();
        
        // אם סופר אדמין - טען גם את רשימת המשתמשים והוסף תפריט
        if (isSuperAdminUser) {
            loadAllUsers();
            showSuperAdminUI();
        }
    } else {
        // User is signed out
        showLoginScreen();
    }
}

/**
 * Handle Google login button click
 */
async function handleGoogleLogin() {
    try {
        await signInWithGoogle();
    } catch (error) {
        console.error('Login failed:', error);
        alert('ההתחברות נכשלה. נסו שוב.');
    }
}

/**
 * Handle logout button click
 */
async function handleLogout() {
    try {
        await signOut();
    } catch (error) {
        console.error('Logout failed:', error);
    }
}

/**
 * Update user info display in sidebar
 * @param {User} user 
 */
function updateUserInfo(user) {
    if (elements.userName) elements.userName.textContent = user.displayName || 'משתמש';
    if (elements.userEmail) elements.userEmail.textContent = user.email;
    if (elements.userAvatar) {
        elements.userAvatar.src = user.photoURL || 'https://via.placeholder.com/40';
    }
}

/* ==========================================================================
   View Management
   ========================================================================== */

/**
 * Show login screen, hide dashboard
 */
function showLoginScreen() {
    elements.loginScreen?.classList.remove('hidden');
    elements.dashboard?.classList.add('hidden');
}

/**
 * Show dashboard, hide login screen
 */
function showDashboard() {
    elements.loginScreen?.classList.add('hidden');
    elements.dashboard?.classList.remove('hidden');
}

/**
 * Handle navigation between views
 * @param {string} view 
 */
function handleNavigation(view) {
    // Update nav active state
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.view === view);
    });
    
    currentView = view;
    
    if (view === 'campaigns') {
        loadCampaigns(); // טוען רק את ההגרלות שלי
        showCampaignsView();
    } else if (view === 'create') {
        showCreateView();
    } else if (view === 'all-campaigns' && isSuperAdminUser) {
        loadAllCampaigns(); // טען את כל ההגרלות
        showCampaignsView();
    } else if (view === 'users' && isSuperAdminUser) {
        showUsersView();
    }
}

/**
 * Show campaigns list view
 */
function showCampaignsView() {
    elements.viewCampaigns?.classList.remove('hidden');
    elements.viewCreate?.classList.add('hidden');
    elements.viewDetails?.classList.add('hidden');
    document.getElementById('view-users')?.classList.add('hidden');
    
    // Reset editing state
    editingCampaignId = null;
    
    // Update nav
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.view === 'campaigns');
    });
}

/**
 * Show users list view (super admin only)
 */
function showUsersView() {
    if (!isSuperAdminUser) return;
    
    elements.viewCampaigns?.classList.add('hidden');
    elements.viewCreate?.classList.add('hidden');
    elements.viewDetails?.classList.add('hidden');
    document.getElementById('view-users')?.classList.remove('hidden');
    
    // Update nav
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.view === 'users');
    });
}

/**
 * Show create/edit campaign view
 * @param {Object} campaign - Campaign to edit (optional)
 */
function showCreateView(campaign = null) {
    elements.viewCampaigns?.classList.add('hidden');
    elements.viewCreate?.classList.remove('hidden');
    elements.viewDetails?.classList.add('hidden');
    
    // Update title
    const titleEl = document.getElementById('create-view-title');
    if (titleEl) {
        titleEl.textContent = campaign ? 'עריכת הגרלה' : 'יצירת הגרלה חדשה';
    }
    
    // Reset or populate form
    if (campaign) {
        editingCampaignId = campaign.id;
        populateForm(campaign);
    } else {
        editingCampaignId = null;
        resetForm();
    }
    
    // Update nav
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.view === 'create');
    });
    
    // Initialize preview
    updateLivePreview();
}

/**
 * Show campaign details view
 * @param {string} campaignId 
 */
async function showDetailsView(campaignId) {
    elements.viewCampaigns?.classList.add('hidden');
    elements.viewCreate?.classList.add('hidden');
    elements.viewDetails?.classList.remove('hidden');
    
    try {
        const campaign = await getCampaign(campaignId);
        if (!campaign) {
            alert('הקמפיין לא נמצא');
            showCampaignsView();
            return;
        }
        
        // Update details
        document.getElementById('details-title').textContent = campaign.title;
        document.getElementById('stat-views').textContent = campaign.viewsCount || 0;
        
        // Load leads
        const leads = await getLeadsByCampaign(campaignId);
        document.getElementById('stat-leads').textContent = leads.length;
        
        // Calculate shares
        const shares = leads.filter(l => l.tasksCompleted?.sharedWhatsapp).length;
        document.getElementById('stat-shares').textContent = shares;
        
        // Calculate total tickets
        const totalTickets = leads.reduce((sum, lead) => sum + (lead.tickets || 1), 0);
        const ticketsEl = document.getElementById('stat-tickets');
        if (ticketsEl) ticketsEl.textContent = totalTickets;
        
        // Calculate conversion
        const conversion = campaign.viewsCount > 0 
            ? Math.round((leads.length / campaign.viewsCount) * 100) 
            : 0;
        document.getElementById('stat-conversion').textContent = `${conversion}%`;
        
        // Campaign link - Dynamic detection
        const currentOrigin = window.location.origin;
        const currentPath = window.location.pathname.replace('admin.html', '');
        const isVercel = window.location.hostname.includes('vercel.app');
        
        let campaignLink;
        if (isVercel) {
            campaignLink = `${currentOrigin}/l/${campaignId.substring(0, 6)}${campaign.managerLeadId ? `/${campaign.managerLeadId.substring(0, 6)}` : ''}`;
        } else {
            campaignLink = `${currentOrigin}${currentPath}index.html?c=${campaignId}${campaign.managerLeadId ? `&ref=${campaign.managerLeadId}` : ''}`;
        }
        
        document.getElementById('campaign-link').value = campaignLink;
        
        // Store campaign ID for actions
        elements.viewDetails.dataset.campaignId = campaignId;
        
        // Render leads table
        renderLeadsTable(leads);
        
    } catch (error) {
        console.error('Error loading campaign details:', error);
        alert('שגיאה בטעינת פרטי הקמפיין');
    }
}

/* ==========================================================================
   Campaign Operations
   ========================================================================== */

/**
 * Load campaigns for current user (always shows only user's own campaigns)
 */
async function loadCampaigns() {
    if (!currentUser) return;
    
    try {
        // תמיד טען רק את ההגרלות של המשתמש הנוכחי
        campaigns = await getCampaignsByManager(currentUser.uid);
        renderCampaignsList();
    } catch (error) {
        console.error('Error loading campaigns:', error);
    }
}

/**
 * Load ALL campaigns (for super admin "all campaigns" view)
 */
async function loadAllCampaigns() {
    if (!currentUser || !isSuperAdminUser) return;
    
    try {
        campaigns = await getAllCampaigns();
        renderCampaignsList(true); // true = showing all campaigns
    } catch (error) {
        console.error('Error loading all campaigns:', error);
    }
}

/**
 * Load all users (for super admin only)
 */
async function loadAllUsers() {
    if (!isSuperAdminUser) return;
    
    try {
        // Fetch users and ALL campaigns to get accurate counts
        const [users, allCampaignsData] = await Promise.all([
            getAllUsers(),
            getAllCampaigns()
        ]);
        
        allUsers = users;
        // Map campaign counts to users
        allUsers = allUsers.map(user => ({
            ...user,
            campaignCount: allCampaignsData.filter(c => c.managerId === user.id).length
        }));
        
        renderUsersList();
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

/**
 * Show super admin UI elements
 */
function showSuperAdminUI() {
    // הוסף סימון סופר אדמין
    const userNameEl = document.getElementById('user-name');
    if (userNameEl) {
        userNameEl.innerHTML = `${currentUser.displayName || 'משתמש'} <span class="super-admin-badge">👑 מנהל ראשי</span>`;
    }
    
    const navMenu = document.querySelector('.nav-menu');
    
    // הוסף תפריט "כל ההגרלות"
    if (navMenu && !document.querySelector('[data-view="all-campaigns"]')) {
        const allCampaignsNavItem = document.createElement('li');
        allCampaignsNavItem.className = 'nav-item';
        allCampaignsNavItem.dataset.view = 'all-campaigns';
        allCampaignsNavItem.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="14" y="14" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
            <span>כל ההגרלות</span>
        `;
        allCampaignsNavItem.addEventListener('click', () => handleNavigation('all-campaigns'));
        navMenu.appendChild(allCampaignsNavItem);
    }
    
    // הוסף תפריט משתמשים
    if (navMenu && !document.querySelector('[data-view="users"]')) {
        const usersNavItem = document.createElement('li');
        usersNavItem.className = 'nav-item';
        usersNavItem.dataset.view = 'users';
        usersNavItem.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            <span>כל המשתמשים</span>
        `;
        usersNavItem.addEventListener('click', () => handleNavigation('users'));
        navMenu.appendChild(usersNavItem);
    }
    
    // הוסף מיכל לתצוגת משתמשים
    const mainContent = document.querySelector('.main-content');
    if (mainContent && !document.getElementById('view-users')) {
        const usersView = document.createElement('section');
        usersView.id = 'view-users';
        usersView.className = 'view hidden';
        usersView.innerHTML = `
            <header class="view-header">
                <h2>👥 כל המשתמשים במערכת</h2>
            </header>
            <div class="users-search-bar">
                <input type="text" id="user-search-input" placeholder="🔍 חפש לפי שם או אימייל...">
            </div>
            <div class="users-grid" id="users-list">
                <!-- Users will be inserted here -->
            </div>
            <div id="user-campaigns-modal" class="modal hidden">
                <div class="modal-content user-modal">
                    <button class="modal-close" id="close-user-modal">&times;</button>
                    <div id="user-modal-content"></div>
                </div>
            </div>
        `;
        mainContent.appendChild(usersView);
        
        // Add search functionality
        document.getElementById('user-search-input')?.addEventListener('input', handleUserSearch);
        document.getElementById('close-user-modal')?.addEventListener('click', closeUserModal);
    }
}

/**
 * Handle user search
 */
function handleUserSearch(e) {
    const query = e.target.value.toLowerCase().trim();
    const userCards = document.querySelectorAll('.user-card');
    
    userCards.forEach(card => {
        const name = card.querySelector('h3')?.textContent.toLowerCase() || '';
        const email = card.querySelector('p')?.textContent.toLowerCase() || '';
        
        if (name.includes(query) || email.includes(query)) {
            card.style.display = '';
        } else {
            card.style.display = 'none';
        }
    });
}

/**
 * Show user details modal with their campaigns
 */
async function showUserDetails(userId) {
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;
    
    const modal = document.getElementById('user-campaigns-modal');
    const content = document.getElementById('user-modal-content');
    
    if (!modal || !content) return;
    
    // Show loading state in modal
    content.innerHTML = '<div class="text-center padding-xl"><div class="loader margin-auto"></div><p>טוען הגרלות...</p></div>';
    modal.classList.remove('hidden');
    
    try {
        // Fetch campaigns specifically for this user
        const userCampaigns = await getCampaignsByManager(userId);
        
        content.innerHTML = `
            <div class="user-detail-header">
                <img src="${user.photoURL || 'https://via.placeholder.com/80'}" alt="${user.displayName}" class="user-detail-avatar">
                <div class="user-detail-info">
                    <h2>${escapeHtml(user.displayName || 'משתמש')}</h2>
                    <p>${escapeHtml(user.email)}</p>
                    <span>נרשם: ${formatDate(user.createdAt)}</span>
                </div>
            </div>
            <h3>ההגרלות של המנהל (${userCampaigns.length})</h3>
            ${userCampaigns.length === 0 ? '<p class="text-muted">אין הגרלות למשתמש זה</p>' : `
                <div class="user-campaigns-list">
                    ${userCampaigns.map(c => `
                        <div class="user-campaign-item" data-id="${c.id}">
                            <div class="campaign-item-title">${escapeHtml(c.title)}</div>
                            <div class="campaign-item-meta">
                                <span>נוצר: ${formatDate(c.createdAt)}</span>
                                <span class="campaign-status ${c.isActive ? 'active' : 'ended'}">${c.isActive ? 'פעיל' : 'הסתיים'}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `}
        `;
        
        // Add click events for campaign items
        content.querySelectorAll('.user-campaign-item').forEach(item => {
            item.addEventListener('click', () => {
                closeUserModal();
                showDetailsView(item.dataset.id);
            });
        });
        
    } catch (error) {
        console.error('Error loading user details:', error);
        content.innerHTML = '<p class="text-error text-center">שגיאה בטעינת הנתונים</p>';
    }
}

/**
 * Close user modal
 */
function closeUserModal() {
    document.getElementById('user-campaigns-modal')?.classList.add('hidden');
}

/**
 * Render users list (for super admin)
 */
function renderUsersList() {
    const usersList = document.getElementById('users-list');
    if (!usersList) return;
    
    if (allUsers.length === 0) {
        usersList.innerHTML = '<div class="empty-state small"><p>אין משתמשים רשומים</p></div>';
        return;
    }
    
    usersList.innerHTML = allUsers.map(user => {
        return `
            <div class="user-card" data-user-id="${user.id}">
                <div class="user-card-avatar">
                    <img src="${user.photoURL || 'https://via.placeholder.com/50'}" alt="${user.displayName}">
                </div>
                <div class="user-card-info">
                    <h3>${escapeHtml(user.displayName || 'משתמש')}</h3>
                    <p>${escapeHtml(user.email)}</p>
                    <div class="user-card-stats">
                        <span class="stat-badge">📊 ${user.campaignCount || 0} הגרלות</span>
                    </div>
                </div>
                <div class="user-card-date">
                    נרשם: ${formatDate(user.createdAt)}
                </div>
            </div>
        `;
    }).join('');

    // Add click events to user cards
    document.querySelectorAll('.user-card').forEach(card => {
        card.addEventListener('click', () => showUserDetails(card.dataset.userId));
    });
}

/**
 * Render campaigns list
 * @param {boolean} showingAll - if true, showing all campaigns (super admin view)
 */
function renderCampaignsList(showingAll = false) {
    if (!elements.campaignsList || !elements.campaignsEmpty) return;
    
    // Update header based on view
    const viewHeader = document.querySelector('#view-campaigns .view-header h2');
    if (viewHeader) {
        viewHeader.textContent = showingAll ? '📊 כל ההגרלות במערכת' : '🎰 ההגרלות שלי';
    }
    
    if (campaigns.length === 0) {
        elements.campaignsList.classList.add('hidden');
        elements.campaignsEmpty.classList.remove('hidden');
        return;
    }
    
    elements.campaignsEmpty.classList.add('hidden');
    elements.campaignsList.classList.remove('hidden');
    
    elements.campaignsList.innerHTML = campaigns.map(campaign => {
        const isActive = campaign.isActive && new Date(campaign.endDate?.toDate?.() || campaign.endDate) > new Date();
        const statusClass = isActive ? 'active' : 'ended';
        const statusText = isActive ? 'פעיל' : 'הסתיים';
        
        // הצג את שם היוצר רק בתצוגת "כל ההגרלות"
        const ownerInfo = showingAll ? `<span class="campaign-owner">👤 ${campaign.managerId?.substring(0, 8)}...</span>` : '';
        
        return `
            <div class="campaign-card" data-id="${campaign.id}">
                <div class="campaign-card-header">
                    <div>
                        <h3 class="campaign-card-title">${escapeHtml(campaign.title)}</h3>
                        <span class="campaign-card-date">
                            נוצר: ${formatDate(campaign.createdAt)}
                        </span>
                        ${ownerInfo}
                    </div>
                    <span class="campaign-status ${statusClass}">${statusText}</span>
                </div>
                <div class="campaign-card-stats">
                    <div class="campaign-stat">
                        <span class="campaign-stat-value">${campaign.viewsCount || 0}</span>
                        <span class="campaign-stat-label">צפיות</span>
                    </div>
                    <div class="campaign-stat">
                        <span class="campaign-stat-value">${campaign.leadsCount || 0}</span>
                        <span class="campaign-stat-label">נרשמים</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    // Add click handlers to cards
    document.querySelectorAll('.campaign-card').forEach(card => {
        card.addEventListener('click', () => showDetailsView(card.dataset.id));
    });
}

/**
 * Handle save campaign button click
 */
async function handleSaveCampaign() {
    if (!elements.campaignForm) return;
    
    // Validate form
    if (!elements.campaignForm.checkValidity()) {
        elements.campaignForm.reportValidity();
        return;
    }
    
    const formData = new FormData(elements.campaignForm);
    let bannerUrl = document.getElementById('banner-url')?.value || '';
    
    const campaignData = {
        title: formData.get('title'),
        description: formData.get('description'),
        endDate: new Date(formData.get('endDate')),
        contactVcardName: formData.get('contactVcardName'),
        contactPhoneNumber: formData.get('contactPhoneNumber'),
        whatsappShareText: formData.get('whatsappShareText'),
        primaryColor: formData.get('primaryColor'),
        backgroundColor: formData.get('backgroundColor'),
        bannerUrl: bannerUrl, // Set initial value from input
        managerName: currentUser.displayName,
        // Registration Settings
        collectEmail: document.getElementById('collect-email-toggle')?.checked || false,
        // הגדרות הגרלה
        lotteryMode: formData.get('lotteryMode') || 'manual',
        maxEntriesPerUser: parseInt(formData.get('maxEntriesPerUser')) || 1,
        thankYouMessage: formData.get('thankYouMessage') || ''
    };
    
    try {
        const saveBtn = document.getElementById('btn-save-campaign');
        saveBtn.disabled = true;
        
        // Upload banner image to imgBB if it's a new base64 image
        if (bannerUrl && bannerUrl.startsWith('data:')) {
            saveBtn.textContent = 'מעלה תמונה...';
            try {
                const uploadResult = await uploadImage(bannerUrl);
                campaignData.bannerUrl = uploadResult.url;
                console.log('Image uploaded to imgBB:', uploadResult.url);
            } catch (uploadError) {
                console.error('Error uploading image:', uploadError);
                alert('שגיאה בהעלאת התמונה. נסה שוב.');
                saveBtn.disabled = false;
                saveBtn.textContent = 'שמירה ופרסום';
                return;
            }
        }
        
        saveBtn.textContent = 'שומר...';
        
        if (editingCampaignId) {
            // Update existing
            await updateCampaign(editingCampaignId, {
                ...campaignData,
                theme: {
                    primaryColor: campaignData.primaryColor,
                    backgroundColor: campaignData.backgroundColor
                }
            });
        } else {
            // Create new
            await createCampaign(campaignData, currentUser.uid);
            
            // שליחת התראה למנהל על הגרלה חדשה
            notifyNewCampaignCreated(campaignData, currentUser);
        }
        
        // Refresh list and go back
        await loadCampaigns();
        showCampaignsView();
        
    } catch (error) {
        console.error('Error saving campaign:', error);
        alert('שגיאה בשמירת ההגרלה');
    } finally {
        const saveBtn = document.getElementById('btn-save-campaign');
        saveBtn.disabled = false;
        saveBtn.textContent = 'שמירה ופרסום';
    }
}

/**
 * Handle delete campaign
 */
async function handleDeleteCampaign() {
    const campaignId = elements.viewDetails?.dataset.campaignId;
    if (!campaignId) return;
    
    if (!confirm('האם אתם בטוחים שברצונכם למחוק את ההגרלה? פעולה זו לא ניתנת לביטול.')) {
        return;
    }
    
    try {
        await deleteCampaign(campaignId);
        await loadCampaigns();
        showCampaignsView();
    } catch (error) {
        console.error('Error deleting campaign:', error);
        alert('שגיאה במחיקת ההגרלה');
    }
}

/**
 * Handle edit campaign button
 */
async function handleEditCampaign() {
    const campaignId = elements.viewDetails?.dataset.campaignId;
    if (!campaignId) return;
    
    const campaign = campaigns.find(c => c.id === campaignId);
    if (campaign) {
        showCreateView(campaign);
    }
}

/* ==========================================================================
   Form Handling
   ========================================================================== */

/**
 * Populate form with campaign data
 * @param {Object} campaign 
 */
function populateForm(campaign) {
    if (!elements.campaignForm) return;
    
    document.getElementById('campaign-title').value = campaign.title || '';
    document.getElementById('campaign-description').value = campaign.description || '';
    document.getElementById('contact-name').value = campaign.contactVcardName || '';
    document.getElementById('contact-phone').value = campaign.contactPhoneNumber || '';
    document.getElementById('share-text').value = campaign.whatsappShareText || '';
    
    // Registration settings
    const collectEmailToggle = document.getElementById('collect-email-toggle');
    if (collectEmailToggle) collectEmailToggle.checked = !!campaign.collectEmail;

    // Handle date
    if (campaign.endDate) {
        const date = campaign.endDate.toDate ? campaign.endDate.toDate() : new Date(campaign.endDate);
        document.getElementById('campaign-end-date').value = date.toISOString().slice(0, 16);
    }
    
    // Handle colors
    const primaryColor = campaign.theme?.primaryColor || '#6366f1';
    const bgColor = campaign.theme?.backgroundColor || '#f8fafc';
    
    document.getElementById('primary-color').value = primaryColor;
    document.getElementById('bg-color').value = bgColor;
    
    document.querySelector('#primary-color').closest('.color-picker-wrapper').querySelector('.color-value').textContent = primaryColor;
    document.querySelector('#bg-color').closest('.color-picker-wrapper').querySelector('.color-value').textContent = bgColor;

    // Handle banner image
    const preview = document.getElementById('banner-preview');
    const placeholder = document.getElementById('upload-placeholder');
    const removeBtn = document.getElementById('btn-remove-banner');
    const uploadArea = document.getElementById('banner-upload-area');
    const urlInput = document.getElementById('banner-url');

    if (campaign.bannerUrl) {
        if (preview) {
            preview.src = campaign.bannerUrl;
            preview.classList.remove('hidden');
        }
        if (placeholder) placeholder.classList.add('hidden');
        if (removeBtn) removeBtn.classList.remove('hidden');
        if (uploadArea) uploadArea.classList.add('has-image');
        if (urlInput) urlInput.value = campaign.bannerUrl;
    } else {
        if (preview) {
            preview.src = '';
            preview.classList.add('hidden');
        }
        if (placeholder) placeholder.classList.remove('hidden');
        if (removeBtn) removeBtn.classList.add('hidden');
        if (uploadArea) uploadArea.classList.remove('has-image');
        if (urlInput) urlInput.value = '';
    }
}

/**
 * Reset form to defaults
 */
function resetForm() {
    if (!elements.campaignForm) return;
    
    elements.campaignForm.reset();
    
    // Reset color displays
    document.querySelector('#primary-color').closest('.color-picker-wrapper').querySelector('.color-value').textContent = '#6366f1';
    document.querySelector('#bg-color').closest('.color-picker-wrapper').querySelector('.color-value').textContent = '#f8fafc';
    
    // Set default end date (1 week from now)
    const defaultEnd = new Date();
    defaultEnd.setDate(defaultEnd.getDate() + 7);
    document.getElementById('campaign-end-date').value = defaultEnd.toISOString().slice(0, 16);
    
    // Set default WhatsApp share text
    const shareText = document.getElementById('share-text');
    if (shareText) {
        shareText.value = 'הירשמתי להגרלה מטורפת! 🎉 בואו גם אתם:';
    }
}

/**
 * Update live preview iframe
 */
function updateLivePreview() {
    if (!elements.previewIframe) return;
    
    const title = document.getElementById('campaign-title')?.value || 'כותרת ההגרלה';
    const description = document.getElementById('campaign-description')?.value || '';
    const primaryColor = document.getElementById('primary-color')?.value || '#6366f1';
    const bgColor = document.getElementById('bg-color')?.value || '#f8fafc';
    
    // Get banner image (from preview or hidden input)
    const bannerPreview = document.getElementById('banner-preview');
    const bannerUrl = bannerPreview?.src && !bannerPreview.classList.contains('hidden') ? bannerPreview.src : '';
    
    // Generate preview HTML
    const previewHtml = generatePreviewHtml(title, description, primaryColor, bgColor, bannerUrl);
    
    // Update iframe
    const iframe = elements.previewIframe;
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(previewHtml);
    doc.close();
}

/**
 * Generate preview HTML for iframe
 */
function generatePreviewHtml(title, description, primaryColor, bgColor, bannerUrl = '') {
    return `
        <!DOCTYPE html>
        <html lang="he" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700&display=swap" rel="stylesheet">
            <style>
                :root {
                    --campaign-primary: ${primaryColor};
                    --campaign-bg: ${bgColor};
                }
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body {
                    font-family: 'Heebo', sans-serif;
                    background: var(--campaign-bg);
                    min-height: 100vh;
                    padding: 20px;
                }
                .banner {
                    width: 100%;
                    border-radius: 12px;
                    margin-bottom: 16px;
                    overflow: hidden;
                }
                .banner img {
                    width: 100%;
                    height: auto;
                    display: block;
                }
                .header {
                    text-align: center;
                    padding: 20px;
                    background: white;
                    border-radius: 12px;
                    margin-bottom: 16px;
                }
                .title {
                    font-size: 24px;
                    font-weight: 700;
                    color: var(--campaign-primary);
                    margin-bottom: 8px;
                }
                .desc {
                    color: #64748b;
                    font-size: 14px;
                }
                .card {
                    background: white;
                    border-radius: 16px;
                    padding: 24px;
                    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
                }
                .card-title {
                    font-size: 18px;
                    font-weight: 600;
                    text-align: center;
                    margin-bottom: 20px;
                }
                .input-group {
                    margin-bottom: 16px;
                }
                .input-group label {
                    display: block;
                    font-size: 14px;
                    font-weight: 500;
                    margin-bottom: 6px;
                }
                .input-group input {
                    width: 100%;
                    padding: 12px;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    font-size: 16px;
                    font-family: inherit;
                }
                .btn {
                    width: 100%;
                    padding: 14px;
                    background: var(--campaign-primary);
                    color: white;
                    border: none;
                    border-radius: 12px;
                    font-size: 16px;
                    font-weight: 600;
                    font-family: inherit;
                    cursor: pointer;
                }
            </style>
        </head>
        <body>
            ${bannerUrl ? `<div class="banner"><img src="${bannerUrl}" alt="באנר"></div>` : ''}
            <div class="header">
                <h1 class="title">${escapeHtml(title)}</h1>
                ${description ? `<p class="desc">${escapeHtml(description)}</p>` : ''}
            </div>
            <div class="card">
                <h2 class="card-title">הירשמו להגרלה</h2>
                <div class="input-group">
                    <label>שם מלא</label>
                    <input type="text" placeholder="הכניסו את שמכם המלא">
                </div>
                <div class="input-group">
                    <label>מספר טלפון</label>
                    <input type="tel" placeholder="050-1234567">
                </div>
                <button class="btn">להרשמה להגרלה ←</button>
            </div>
        </body>
        </html>
    `;
}

/* ==========================================================================
   Leads Table
   ========================================================================== */

/**
 * Render leads table
 * @param {Array} leads 
 */
function renderLeadsTable(leads) {
    const tbody = document.getElementById('leads-table-body');
    const emptyState = document.getElementById('leads-empty');
    const campaignId = elements.viewDetails?.dataset.campaignId;
    
    if (!tbody || !emptyState) return;
    
    if (leads.length === 0) {
        tbody.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
    }
    
    emptyState.classList.add('hidden');
    
    // Referral link - Dynamic detection
    const currentOrigin = window.location.origin;
    const currentPath = window.location.pathname.replace('admin.html', '');
    const isVercel = window.location.hostname.includes('vercel.app');
    
    tbody.innerHTML = leads.map((lead, index) => {
        // Generate unique referral link for this lead
        let referralLink;
        if (isVercel) {
            referralLink = `${currentOrigin}/l/${campaignId.substring(0, 6)}/${lead.id.substring(0, 6)}`;
        } else {
            referralLink = `${currentOrigin}${currentPath}index.html?c=${campaignId}&ref=${lead.id}`;
        }
        
        return `
            <tr>
                <td>${index + 1}</td>
                <td>
                    <div class="lead-name-cell">
                        <strong>${escapeHtml(lead.fullName)}</strong>
                        ${lead.email ? `<small class="lead-email">${escapeHtml(lead.email)}</small>` : ''}
                    </div>
                </td>
                <td dir="ltr">${escapeHtml(lead.phone)}</td>
                <td>${formatDate(lead.joinedAt)}</td>
                <td><span class="ticket-badge">🎫 ${lead.tickets || 1}</span></td>
                <td class="${lead.tasksCompleted?.savedContact ? 'status-yes' : 'status-no'}">
                    ${lead.tasksCompleted?.savedContact ? '✓' : '✗'}
                </td>
                <td class="${lead.tasksCompleted?.sharedWhatsapp ? 'status-yes' : 'status-no'}">
                    ${lead.tasksCompleted?.sharedWhatsapp ? '✓' : '✗'}
                </td>
                <td>
                    <button class="btn btn-sm btn-outline btn-copy-lead-ref" data-link="${referralLink}" title="העתק קישור אישי">
                        העתק קישור
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    // Add copy handlers
    tbody.querySelectorAll('.btn-copy-lead-ref').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const link = btn.dataset.link;
            navigator.clipboard.writeText(link).then(() => {
                const originalText = btn.textContent;
                btn.textContent = '✓ הועתק';
                btn.style.color = '#10b981';
                setTimeout(() => {
                    btn.textContent = originalText;
                    btn.style.color = '';
                }, 2000);
            });
        });
    });
}

/**
 * Handle copy campaign link
 */
function handleCopyLink() {
    const linkInput = document.getElementById('campaign-link');
    if (!linkInput) return;
    
    linkInput.select();
    document.execCommand('copy');
    
    const btn = document.getElementById('btn-copy-link');
    const originalText = btn.innerHTML;
    btn.innerHTML = '✓ הועתק!';
    setTimeout(() => btn.innerHTML = originalText, 2000);
}

/**
 * Handle export leads to CSV
 */
async function handleExportLeads() {
    const campaignId = elements.viewDetails?.dataset.campaignId;
    if (!campaignId) return;
    
    try {
        const leads = await getLeadsByCampaign(campaignId);
        
        if (leads.length === 0) {
            alert('אין נרשמים לייצוא');
            return;
        }
        
        // Generate CSV
        const headers = ['שם מלא', 'אימייל', 'טלפון', 'תאריך הצטרפות', 'שמר איש קשר', 'שיתף'];
        const rows = leads.map(lead => [
            lead.fullName,
            lead.email || '',
            lead.phone,
            formatDate(lead.joinedAt),
            lead.tasksCompleted?.savedContact ? 'כן' : 'לא',
            lead.tasksCompleted?.sharedWhatsapp ? 'כן' : 'לא'
        ]);
        
        const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
        
        // Download
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `leads-${campaignId}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        
    } catch (error) {
        console.error('Error exporting leads:', error);
        alert('שגיאה בייצוא הנתונים');
    }
}

/* ==========================================================================
   Utilities
   ========================================================================== */

/**
 * Escape HTML to prevent XSS
 * @param {string} str 
 * @returns {string}
 */
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Format date for display
 * @param {*} timestamp 
 * @returns {string}
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
