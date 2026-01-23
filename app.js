const firebaseConfig = {
    apiKey: "AIzaSyDO4a2qX3AR-IQ2GOiEkG83uKk8-ytVOqU",
    authDomain: "dropped-9905d.firebaseapp.com",
    projectId: "dropped-9905d",
    storageBucket: "dropped-9905d.firebasestorage.app",
    messagingSenderId: "331343021932",
    appId: "1:331343021932:web:bc1e658925b52f5e495549"
};

let db, auth;
let items = [];
let user = null;
let unsubscribeFirestore = null;
let isFirebaseReady = false;
let editingItemId = null;
let pendingDeleteId = null;

// -- DOM --
const clockEl = document.getElementById('clock');
const dateEl = document.getElementById('date');
const bookmarksContainer = document.getElementById('bookmarks-view');
const readingContainer = document.getElementById('reading-view');
const tabButtons = document.querySelectorAll('.tab-button');
const fab = document.getElementById('add-btn');

// Modals
const modalOverlay = document.getElementById('add-modal');
const closeModalBtn = document.getElementById('close-modal');
const cancelBtn = document.getElementById('cancel-btn');
const addForm = document.getElementById('add-form');
const modalTitle = document.querySelector('.modal-header h2');

const confirmOverlay = document.getElementById('confirm-modal');
const confirmCancelBtn = document.getElementById('confirm-cancel-btn');
const confirmActionBtn = document.getElementById('confirm-action-btn'); // Renamed
const confirmTitle = document.getElementById('confirm-title');
const confirmMsg = document.getElementById('confirm-msg');
let confirmCallback = null;

const alertOverlay = document.getElementById('alert-modal');
const alertTitleEl = document.getElementById('alert-title');
const alertMsgEl = document.getElementById('alert-msg');
const alertOkBtn = document.getElementById('alert-ok-btn');

// Webview
const webviewOverlay = document.getElementById('webview-modal');
const webviewFrame = document.getElementById('webview-frame');
const webviewTitle = document.getElementById('webview-title');
const webviewCloseBtn = document.getElementById('webview-close-btn');
const webviewExternalBtn = document.getElementById('webview-external-btn');
let currentWebviewUrl = null;

// Context Menu
const contextMenu = document.getElementById('context-menu');
const ctxPin = document.getElementById('ctx-pin');
const ctxEdit = document.getElementById('ctx-edit');
const ctxDelete = document.getElementById('ctx-delete');
let ctxTargetId = null;
let ctxTargetType = null;
let ctxTargetPinned = false;

// -- New Settings UI --
const loadingOverlay = document.getElementById('loading-overlay');
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal'); // Changed from view to modal
const closeSettingsBtn = document.getElementById('close-settings-modal'); // New close btn

const settingsThemeToggle = document.getElementById('settings-theme-toggle');
const settingsBrowserToggle = document.getElementById('settings-browser-toggle');
const authBtn = document.getElementById('auth-btn');
const settingsAvatar = document.getElementById('settings-avatar');
const settingsName = document.getElementById('settings-name');
const settingsEmail = document.getElementById('settings-email');

// Legacy references (removed from HTML but kept null-safe if needed, or we just remove usage)
// const userProfileBtn = ... (Deleted)
// const themeToggleBtn = ... (Deleted)

// -- Init --
function init() {
    try {
        setupEventListeners();
        setupSettings(); // New
        setupTheme();    // Updates toggle state
        startClock();
        checkShareHandler();
        initDataLayer();
    } catch (e) {
        console.error("Critical Init Error:", e);
    }
}

// -- Share Target --
function checkShareHandler() {
    try {
        const params = new URLSearchParams(window.location.search);
        const titleParam = params.get('title');
        const textParam = params.get('text');
        const urlParam = params.get('url');

        if (titleParam || textParam || urlParam) {
            let finalUrl = urlParam;
            let finalTitle = titleParam;

            if (!finalUrl && textParam) {
                const urlRegex = /(https?:\/\/[^\s]+)/g;
                const match = textParam.match(urlRegex);
                if (match) {
                    finalUrl = match[0];
                    if (!finalTitle) finalTitle = textParam.replace(finalUrl, '').trim();
                }
            }
            if (!finalUrl && textParam && textParam.includes('.')) finalUrl = textParam;
            if (!finalTitle && !textParam) finalTitle = "";

            if (finalUrl) {
                openAddModal({ url: finalUrl, title: finalTitle });
                window.history.replaceState({}, document.title, window.location.pathname);
            }
        }
    } catch (e) {
        console.warn("Share handler error", e);
    }
}

function initDataLayer() {
    try {
        if (typeof firebase !== 'undefined') {
            firebase.initializeApp(firebaseConfig);
            db = firebase.firestore();
            auth = firebase.auth();
            isFirebaseReady = true;
            setupAuthListener();
        } else {
            loadLocalData();
            renderAll();
        }
    } catch (e) {
        console.error("Firebase Init Error:", e);
        loadLocalData();
        renderAll();
        hideLoader(); // Fallback
    }
}

function hideLoader() {
    if (loadingOverlay) loadingOverlay.classList.add('hidden');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// -- Theme --
// -- Theme --
function setupTheme() {
    try {
        const savedTheme = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const isDark = savedTheme === 'dark' || (!savedTheme && prefersDark);

        if (isDark) {
            document.body.classList.add('dark-theme');
        } else {
            document.body.classList.remove('dark-theme');
        }

        // Sync Switch
        if (settingsThemeToggle) settingsThemeToggle.checked = isDark;

    } catch (e) { }
}

function toggleTheme() {
    document.body.classList.toggle('dark-theme');
    const isDark = document.body.classList.contains('dark-theme');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

// -- Browser Pref --
function setupSettings() {
    const useInApp = localStorage.getItem('useInAppBrowser') !== 'false'; // Default True
    if (settingsBrowserToggle) settingsBrowserToggle.checked = useInApp;
}

function toggleBrowserPref() {
    const shouldUse = settingsBrowserToggle.checked;
    localStorage.setItem('useInAppBrowser', shouldUse);
}

// -- Auth --
function setupAuthListener() {
    auth.onAuthStateChanged((currentUser) => {
        user = currentUser;
        updateUserProfileUI();
        if (user) subscribeToFirestore();
        else {
            if (unsubscribeFirestore) unsubscribeFirestore();
            items = [];
            loadLocalData();
            loadLocalData();
            renderAll();
            hideLoader();
        }
    });
}

function subscribeToFirestore() {
    const itemsRef = db.collection('users').doc(user.uid).collection('items').orderBy('timestamp', 'desc');
    unsubscribeFirestore = itemsRef.onSnapshot((snapshot) => {
        items = [];
        snapshot.forEach((doc) => {
            items.push({ id: doc.id, ...doc.data() });
        });
        renderAll();
        hideLoader();
    }, (error) => console.warn("Firestore sync:", error));
}

async function saveItem(item) {
    if (user && isFirebaseReady) {
        try {
            await db.collection('users').doc(user.uid).collection('items').doc(item.id).set(item, { merge: true });
        } catch (e) { showAlert("Ops", "Erro ao salvar: " + e.message); }
    } else {
        const existingIndex = items.findIndex(i => i.id === item.id);
        if (existingIndex >= 0) items[existingIndex] = item;
        else items.push(item);
        saveLocalData();
        renderAll();
    }
}

async function deleteItem(id) {
    if (user && isFirebaseReady) {
        try {
            await db.collection('users').doc(user.uid).collection('items').doc(id).delete();
        } catch (e) { showAlert("Ops", "Erro ao deletar: " + e.message); }
    } else {
        items = items.filter(i => i.id !== id);
        saveLocalData();
        renderAll();
    }
}

function loadLocalData() {
    try {
        const stored = localStorage.getItem('dropped_items');
        if (stored) items = JSON.parse(stored);
    } catch (e) { items = []; }
}

function saveLocalData() {
    localStorage.setItem('dropped_items', JSON.stringify(items));
}

// -- Metadata --
function getYouTubeID(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

async function fetchMetadata(url) {
    const ytId = getYouTubeID(url);
    if (ytId) {
        try {
            const oEmbedUrl = `https://noembed.com/embed?url=${encodeURIComponent(url)}`;
            const res = await fetch(oEmbedUrl);
            const data = await res.json();
            return {
                title: data.title || "YouTube Video",
                image: `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`,
                author: data.author_name || "YouTube"
            };
        } catch (e) {
            return {
                title: "YouTube Video",
                image: `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`
            };
        }
    }

    try {
        const apiUrl = `https://api.microlink.io?url=${encodeURIComponent(url)}`;
        const response = await fetch(apiUrl);
        const data = await response.json();

        if (data.status === 'success') {
            return {
                title: data.data.title || null,
                image: data.data.image?.url || null,
                description: data.data.description || null,
                author: data.data.author || null,
                logo: data.data.logo?.url || null
            };
        }
    } catch (e) {
        console.warn("Metadata fetch failed:", e);
    }
    return null;
}

// -- Open In App --
// -- Open In App --
function performOpenUrl(url) {
    // 0. Check Preference
    const useInApp = localStorage.getItem('useInAppBrowser') !== 'false';

    // 1. YouTube always tries embed if possible (or follows pref? Let's say YT always In-App best exp)
    // Actually, user might want to open YT app. Let's respect pref for everything except maybe YT Embeds if they are cool.
    // But simplified:

    // If not using in-app, just open blank
    if (!useInApp) {
        window.open(url, '_blank');
        return;
    }

    // 1. Check YouTube for Embed
    const ytId = getYouTubeID(url);
    if (ytId) {
        const embedUrl = `https://www.youtube.com/embed/${ytId}?autoplay=1`;
        openWebview(embedUrl, url, "YouTube");
        return;
    }

    // 2. Normal URL
    openWebview(url, url, new URL(url).hostname);
}

function openWebview(embedUrl, originalUrl, title) {
    currentWebviewUrl = originalUrl;
    webviewTitle.textContent = title;
    webviewFrame.src = embedUrl;
    webviewOverlay.classList.add('open');
}

function closeWebview() {
    webviewOverlay.classList.remove('open');
    webviewFrame.src = ""; // Stop video/loading
    currentWebviewUrl = null;
}

// -- Render --
function renderAll() {
    try {
        renderBookmarks();
        renderReadingList();
    } catch (e) { console.error("Render error", e); }
}

const KNOWN_ICONS = {
    'keep.google.com': 'https://www.gstatic.com/images/branding/product/1x/keep_2020q4_48dp.png',
    'mail.google.com': 'https://www.gstatic.com/images/branding/product/1x/gmail_2020q4_48dp.png',
    'hrqsousa.github.io/minha-carteira': 'https://hrqsousa.github.io/Minha-Carteira/pwa-192x192.png',
    'hrqsousa.github.io/meus-investimentos': 'https://hrqsousa.github.io/Meus-Investimentos/pwa-192x192.png'
};

function getFaviconUrl(url) {
    try {
        const urlObj = new URL(url);
        const domain = urlObj.hostname;

        // Checklist for Known Icons (Exact match or path match)
        // Normalize: remove trailing slash for comparison, lowercase for domain
        const cleanUrl = url.replace(/\/$/, '').toLowerCase();

        // 1. Check for specific domains (like keep.google.com)
        if (KNOWN_ICONS[domain]) return KNOWN_ICONS[domain];

        // 2. Check for "domain/path" keys (manual check)
        // e.g. hrqsousa.github.io/minha-carteira
        for (const [key, icon] of Object.entries(KNOWN_ICONS)) {
            if (cleanUrl.includes(key.toLowerCase())) {
                return icon;
            }
        }

        return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
    } catch (e) {
        return 'https://cdn-icons-png.flaticon.com/512/1006/1006771.png';
    }
}

function getPlaceholderImage(url) {
    try {
        const domain = new URL(url).hostname;
        return `https://placehold.co/600x400/004aad/ffffff?text=${encodeURIComponent(domain)}`;
    } catch (e) { return `https://placehold.co/600x400/004aad/ffffff?text=Link`; }
}

function renderBookmarks() {
    if (!bookmarksContainer) return;
    bookmarksContainer.innerHTML = '';

    // Unified Sort Logic:
    // Pinned First (isPinned desc)
    // Then Order (asc)
    // Then Timestamp (desc) as fallback

    // We filter then sort items directly.
    const bookmarks = items.filter(i => i.type === 'bookmark');

    bookmarks.sort((a, b) => {
        // 1. Pinned Priority
        if (!!a.isPinned !== !!b.isPinned) return a.isPinned ? -1 : 1;
        // 2. Order Priority (if both have order, use it)
        if (typeof a.order === 'number' && typeof b.order === 'number') {
            return a.order - b.order;
        }
        // If one has order and other doesn't? Treat "No Order" as end of list? or beginning?
        // Let's assume order is consistent if set. If not set, use Timestamp.
        if (typeof a.order === 'number') return -1;
        if (typeof b.order === 'number') return 1;

        // 3. Fallback Timestamp
        return b.timestamp - a.timestamp;
    });

    if (bookmarks.length === 0) {
        bookmarksContainer.innerHTML = '<div style="grid-column: 1/-1; text-align: center; opacity: 0.6; padding-top: 40px;">No bookmarks yet</div>';
        return;
    }

    // Unified Grid
    const grid = document.createElement('div');
    grid.className = 'grid-container';

    bookmarks.forEach(item => {
        grid.appendChild(createBookmarkCard(item));
    });

    bookmarksContainer.appendChild(grid);
}

function createBookmarkCard(item) {
    const card = document.createElement('div');
    card.className = 'bookmark-card';
    card.setAttribute('data-id', item.id);
    card.setAttribute('draggable', 'true'); // Enable drag
    const iconUrl = item.icon || getFaviconUrl(item.url);

    let pinHtml = '';
    if (item.isPinned) {
        pinHtml = `<div class="pin-badge"><span class="material-symbols-outlined">push_pin</span></div>`;
    }

    card.innerHTML = `
        ${pinHtml}
        <img src="${iconUrl}" class="bookmark-icon" loading="lazy">
        <div class="bookmark-title">${item.title || new URL(item.url).hostname}</div>
    `;

    // Interactions
    // Open Link
    card.addEventListener('click', (e) => {
        performOpenUrl(item.url);
    });

    // Context Menu (Right Click)
    card.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        openContextMenu(e, item);
    });

    let pressTimer;
    card.addEventListener('touchstart', (e) => {
        pressTimer = setTimeout(() => {
            openContextMenu(e, item, true);
        }, 600);
    }, { passive: true });

    card.addEventListener('touchend', () => clearTimeout(pressTimer));
    card.addEventListener('touchmove', () => clearTimeout(pressTimer));

    setupDragEvents(card);

    return card;
}

function renderReadingList() {
    if (!readingContainer) return;
    readingContainer.innerHTML = '';

    const readingItems = items.filter(i => i.type === 'reading');

    readingItems.sort((a, b) => {
        if (!!a.isPinned !== !!b.isPinned) return a.isPinned ? -1 : 1;
        if (typeof a.order === 'number' && typeof b.order === 'number') return a.order - b.order;
        if (typeof a.order === 'number') return -1;
        if (typeof b.order === 'number') return 1;
        return b.timestamp - a.timestamp;
    });

    if (readingItems.length === 0) {
        readingContainer.innerHTML = '<div style="text-align: center; opacity: 0.6; padding-top: 40px; grid-column: 1/-1;">Reading list empty</div>';
        return;
    }

    // Clear container
    readingContainer.innerHTML = '';

    if (readingItems.length === 0) {
        readingContainer.innerHTML = '<div style="grid-column: 1/-1; text-align: center; opacity: 0.6; padding-top: 40px;">No items in reading list</div>';
        return;
    }

    // Append items directly (CSS handles grid on #reading-view)
    readingItems.forEach(item => {
        readingContainer.appendChild(createReadingCard(item));
    });
}

function createReadingCard(item) {
    const card = document.createElement('div');
    card.className = 'reading-item';
    card.setAttribute('data-id', item.id);
    card.setAttribute('draggable', 'true');

    const imageUrl = item.image || getPlaceholderImage(item.url);
    const domain = new URL(item.url).hostname;
    const favicon = getFaviconUrl(item.url);

    let pinHtml = '';
    if (item.isPinned) {
        pinHtml = `<div class="pin-badge"><span class="material-symbols-outlined">push_pin</span></div>`;
    }

    card.innerHTML = `
        ${pinHtml}
        <div class="reading-image-container">
            <img src="${imageUrl}" class="reading-image" loading="lazy" onerror="this.src='${getPlaceholderImage(item.url)}'">
        </div>
        <div class="reading-content">
            <div class="reading-meta">
                <img src="${favicon}" class="site-icon">
                <span class="reading-domain">${domain}</span>
            </div>
            <h3 class="reading-title">${item.title || domain}</h3>
        </div>
    `;

    // Interactions
    card.addEventListener('click', (e) => {
        performOpenUrl(item.url);
    });

    card.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        openContextMenu(e, item);
    });

    let pressTimer;
    card.addEventListener('touchstart', (e) => {
        pressTimer = setTimeout(() => {
            openContextMenu(e, item, true);
        }, 600);
    }, { passive: true });

    card.addEventListener('touchend', () => clearTimeout(pressTimer));
    card.addEventListener('touchmove', () => clearTimeout(pressTimer));

    setupDragEvents(card);

    return card;
}

// -- Actions --
function openAddModal(prefilData = null) {
    editingItemId = null;
    if (modalTitle) modalTitle.textContent = "Add New Item";
    addForm.reset();
    const rb = document.querySelector('input[name="item-type"][value="bookmark"]');
    if (rb) rb.checked = true;

    modalOverlay.classList.add('open');
    const inputUrl = document.getElementById('input-url');
    const inputTitle = document.getElementById('input-title');

    if (inputUrl) inputUrl.focus();

    if (prefilData) {
        if (prefilData.url && inputUrl) inputUrl.value = prefilData.url;
        if (prefilData.title && inputTitle) inputTitle.value = prefilData.title;
    }
}

function openEditModal(item) {
    editingItemId = item.id;
    if (modalTitle) modalTitle.textContent = "Edit Item";
    document.getElementById('input-url').value = item.url;
    document.getElementById('input-title').value = item.title;

    const radios = document.querySelectorAll('input[name="item-type"]');
    radios.forEach(r => {
        if (r.value === item.type) r.checked = true;
    });

    modalOverlay.classList.add('open');
}

function requestDelete(id) {
    pendingDeleteId = id;
    showConfirmDialog(
        "Delete Item?",
        "Are you sure you want to delete this item?",
        "Delete",
        () => {
            if (pendingDeleteId) {
                deleteItem(pendingDeleteId);
                pendingDeleteId = null;
            }
        },
        true // isDanger
    );
}

function showConfirmDialog(title, msg, btnText, callback, isDanger = false) {
    if (confirmTitle) confirmTitle.textContent = title;
    if (confirmMsg) confirmMsg.textContent = msg;
    if (confirmActionBtn) {
        confirmActionBtn.textContent = btnText;
        if (isDanger) confirmActionBtn.classList.add('danger');
        else confirmActionBtn.classList.remove('danger');
    }
    confirmCallback = callback;
    confirmOverlay.classList.add('open');
}

function onConfirmAction() {
    if (confirmCallback) confirmCallback();
    confirmOverlay.classList.remove('open');
}

function showAlert(title, message) {
    if (alertTitleEl) alertTitleEl.textContent = title;
    if (alertMsgEl) alertMsgEl.textContent = message;
    if (alertOverlay) alertOverlay.classList.add('open');
}


// -- UI Utils --
// -- UI Utils --
function updateUserProfileUI() {
    // Update Settings Card
    if (!authBtn) return;

    if (user) {
        authBtn.textContent = "Sign Out";
        authBtn.classList.add('danger'); // Make it look like a logout button (optional styling)

        if (settingsName) settingsName.textContent = user.displayName || "User";
        if (settingsEmail) settingsEmail.textContent = user.email;

        if (settingsAvatar) {
            if (user.photoURL) {
                settingsAvatar.innerHTML = `<img src="${user.photoURL}">`;
            } else {
                settingsAvatar.innerHTML = `<span class="material-symbols-outlined">person</span>`;
            }
        }
    } else {
        authBtn.textContent = "Sign In with Google";
        authBtn.classList.remove('danger');

        if (settingsName) settingsName.textContent = "Guest User";
        if (settingsEmail) settingsEmail.textContent = "Not logged in";
        if (settingsAvatar) settingsAvatar.innerHTML = `<span class="material-symbols-outlined">person</span>`;
    }
}

function startClock() {
    if (!clockEl || !dateEl) return;
    const update = () => {
        const now = new Date();
        clockEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        // Force en-GB or en-US to ensure comma? 
        // User screenshot shows "Thursday 22 January 2026".
        // Use manual construction or 'en-GB' which usually puts day before month.
        // Let's try explicit formatting.
        const dateStr = now.toLocaleDateString('en-GB', options);
        // en-GB: "Thursday 22 January 2026" (no comma usually).
        // en-US: "Thursday, January 22, 2026"
        // User wants "Thursday, 22 January 2026".

        // Custom construction:
        const weekday = now.toLocaleDateString('en-GB', { weekday: 'long' });
        const day = now.getDate();
        const month = now.toLocaleDateString('en-GB', { month: 'long' });
        const year = now.getFullYear();
        dateEl.textContent = `${weekday}, ${day} ${month} ${year}`;
    };
    update();
    setInterval(update, 1000);
}

// -- Event Listeners --
// -- Event Listeners --
function setupEventListeners() {
    // Settings Button (Opens Overlay)
    const settingsOverlay = document.getElementById('settings-overlay');
    const settingsBackBtn = document.getElementById('settings-back-btn');

    if (settingsBtn && settingsOverlay) {
        settingsBtn.addEventListener('click', () => {
            settingsOverlay.classList.add('open');
        });
    }

    // Settings Back Button
    if (settingsBackBtn && settingsOverlay) {
        settingsBackBtn.addEventListener('click', () => {
            settingsOverlay.classList.remove('open');
        });
    }

    // Settings Toggles
    if (settingsThemeToggle) {
        settingsThemeToggle.addEventListener('change', toggleTheme);
    }
    if (settingsBrowserToggle) {
        settingsBrowserToggle.addEventListener('change', toggleBrowserPref);
    }

    // Auth Button
    if (authBtn) {
        authBtn.addEventListener('click', () => {
            if (!isFirebaseReady) {
                showAlert("Aviso", "Firebase offline. Usando modo local.");
                return;
            }
            if (user) {
                showConfirmDialog(
                    "Sign Out?",
                    "Are you sure you want to sign out?",
                    "Sign Out",
                    () => auth.signOut(),
                    false // Not danger (no red button needed, or maybe neutral?)
                );
            } else {
                const provider = new firebase.auth.GoogleAuthProvider();
                auth.signInWithPopup(provider).catch(e => {
                    if (window.location.protocol === 'file:') {
                        showAlert("Login Indisponível", "Erro em localhost/file. Use um servidor.");
                    } else {
                        showAlert("Falha no Login", e.message);
                    }
                });
            }
        });
    }

    if (tabButtons) {
        tabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                tabButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                const targetId = btn.getAttribute('data-target');
                document.querySelectorAll('.view-section').forEach(section => {
                    section.classList.remove('active');
                    if (section.id === targetId) section.classList.add('active');
                });
            });
        });
    }

    // Modals
    if (fab) fab.addEventListener('click', () => openAddModal());

    const closeAddFn = () => modalOverlay.classList.remove('open');
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeAddFn);
    if (cancelBtn) cancelBtn.addEventListener('click', closeAddFn);
    if (modalOverlay) modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeAddFn();
    });

    // Settings
    function openSettingsFn() {
        if (settingsModal) settingsModal.classList.add('open');
    }

    function closeSettingsFn() {
        if (settingsModal) settingsModal.classList.remove('open');
    }

    if (settingsBtn) {
        settingsBtn.addEventListener('click', openSettingsFn);
    }
    if (closeSettingsBtn) {
        closeSettingsBtn.addEventListener('click', closeSettingsFn);
    }
    if (settingsModal) {
        settingsModal.addEventListener('click', (e) => {
            if (e.target === settingsModal) closeSettingsFn();
        });
    }

    if (confirmCancelBtn) confirmCancelBtn.addEventListener('click', () => confirmOverlay.classList.remove('open'));
    if (confirmOverlay) confirmOverlay.addEventListener('click', (e) => {
        if (e.target === confirmOverlay) confirmOverlay.classList.remove('open');
    });
    if (confirmActionBtn) confirmActionBtn.addEventListener('click', onConfirmAction);

    if (alertOkBtn) alertOkBtn.addEventListener('click', () => alertOverlay.classList.remove('open'));
    if (alertOverlay) alertOverlay.addEventListener('click', (e) => {
        if (e.target === alertOverlay) alertOverlay.classList.remove('open');
    });

    // Webview
    if (webviewCloseBtn) webviewCloseBtn.addEventListener('click', closeWebview);
    if (webviewExternalBtn) webviewExternalBtn.addEventListener('click', () => {
        if (currentWebviewUrl) window.open(currentWebviewUrl, '_blank');
    });

    if (addForm) addForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const submitBtn = addForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = "Saving...";
        submitBtn.disabled = true;

        try {
            const type = document.querySelector('input[name="item-type"]:checked').value;
            const url = document.getElementById('input-url').value;
            let title = document.getElementById('input-title').value;

            let finalUrl = url;
            if (!/^https?:\/\//i.test(finalUrl)) finalUrl = 'https://' + finalUrl;

            // Metadata Fetching
            // Metadata Fetching
            let fetchedData = {};

            // SPECIAL CHECK: Check for known auth-protected sites (e.g. Google Keep)
            // If recognized, SKIP fetchMetadata to avoid "Sign-in" title and garbage icon.
            let knownAppFound = false;
            const cleanCheckUrl = finalUrl.replace(/\/$/, '').toLowerCase();

            if (cleanCheckUrl.includes('keep.google.com')) {
                knownAppFound = true;
                if (!title) title = "Google Keep";
                fetchedData = {
                    title: "Google Keep",
                    logo: 'https://www.gstatic.com/images/branding/product/1x/keep_2020q4_48dp.png'
                };
            } else if (cleanCheckUrl.includes('mail.google.com')) {
                knownAppFound = true;
                if (!title) title = "Gmail";
                fetchedData = {
                    title: "Gmail",
                    logo: 'https://www.gstatic.com/images/branding/product/1x/gmail_2020q4_48dp.png'
                };
            }

            // Normal Flow if not a known special app
            if (!knownAppFound) {
                if ((type === 'reading' && !title) || (type === 'bookmark')) {
                    try {
                        fetchedData = await fetchMetadata(finalUrl);
                        if (fetchedData) {
                            if (!title && fetchedData.title) title = fetchedData.title;
                        }
                    } catch (e) { console.log('Meta fetch err', e); }
                }
            }

            const item = {
                id: editingItemId || Date.now().toString(),
                type,
                url: finalUrl,
                title: title || new URL(finalUrl).hostname,
                timestamp: Date.now()
            };

            if (type === 'reading' && fetchedData && fetchedData.image) {
                item.image = fetchedData.image;
            }
            if (fetchedData && fetchedData.logo) {
                item.icon = fetchedData.logo;
            }

            await saveItem(item);

            addForm.reset();
            closeAddFn();

        } catch (err) {
            console.error(err);
            showAlert("Ops", "Error: " + err.message);
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    });
}

// -- Context Menu Logic --
function openContextMenu(e, item, isTouch = false) {
    if (contextMenu.classList.contains('open')) {
        closeContextMenu();
        return; // Toggle behavior on touch? or just close and reopen?
    }

    ctxTargetId = item.id;
    ctxTargetType = item.type;
    ctxTargetPinned = !!item.isPinned;

    // Update Menu Text
    const pinText = document.getElementById('ctx-pin-text');
    if (pinText) pinText.textContent = ctxTargetPinned ? "Unpin" : "Pin to Top";

    contextMenu.classList.add('open');

    // Positioning
    let x, y;
    if (isTouch && e.touches && e.touches.length > 0) {
        x = e.touches[0].clientX;
        y = e.touches[0].clientY;
    } else {
        x = e.clientX;
        y = e.clientY;
    }

    // Boundary Validation
    const menuRect = contextMenu.getBoundingClientRect();
    if (x + menuRect.width > window.innerWidth) x -= menuRect.width;
    if (y + menuRect.height > window.innerHeight) y -= menuRect.height;

    // Prevent top/left negative
    if (x < 0) x = 0;
    if (y < 0) y = 0;

    contextMenu.style.left = `${x}px`;
    contextMenu.style.top = `${y}px`;

    // Global Close Listener
    setTimeout(() => {
        document.addEventListener('click', closeContextMenuOut);
        document.addEventListener('scroll', closeContextMenuOut);
    }, 10);
}

function closeContextMenu() {
    contextMenu.classList.remove('open');
    document.removeEventListener('click', closeContextMenuOut);
    document.removeEventListener('scroll', closeContextMenuOut);
}

function closeContextMenuOut(e) {
    if (!contextMenu.contains(e.target)) {
        closeContextMenu();
    }
}

// Menu Actions
if (ctxPin) ctxPin.addEventListener('click', togglePinTarget);
if (ctxEdit) ctxEdit.addEventListener('click', editTarget);
if (ctxDelete) ctxDelete.addEventListener('click', deleteTarget);

async function togglePinTarget() {
    if (!ctxTargetId) return;
    const itemIndex = items.findIndex(i => i.id === ctxTargetId);
    if (itemIndex > -1) {
        const item = items[itemIndex];
        item.isPinned = !item.isPinned;
        // Reset order if pinning? Or set order?
        if (item.isPinned && !item.order) {
            // Put at end of pinned list (max order + 1)
            const maxOrder = items.filter(i => i.isPinned).reduce((max, i) => Math.max(max, i.order || 0), 0);
            item.order = maxOrder + 1;
        }
        await saveItem(item);
        renderAll();
    }
    closeContextMenu();
}

function editTarget() {
    if (!ctxTargetId) return;
    const item = items.find(i => i.id === ctxTargetId);
    if (item) openEditModal(item);
    closeContextMenu();
}

function deleteTarget() {
    if (!ctxTargetId) return;
    requestDelete(ctxTargetId);
    closeContextMenu();
}

// -- Drag and Drop Logic --
let dragSrcEl = null;

function setupDragEvents(card) {
    card.addEventListener('dragstart', handleDragStart);
    card.addEventListener('dragover', handleDragOver); // Necessary to allow dropping
    card.addEventListener('dragenter', handleDragEnter);
    card.addEventListener('dragleave', handleDragLeave);
    card.addEventListener('drop', handleDrop);
    card.addEventListener('dragend', handleDragEnd);
}

function handleDragStart(e) {
    this.style.opacity = '0.4';
    dragSrcEl = this;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.getAttribute('data-id'));
    this.classList.add('dragging');
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleDragEnter(e) {
    this.classList.add('drag-over');
}

function handleDragLeave(e) {
    this.classList.remove('drag-over');
}

async function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }
    e.preventDefault(); // Should ensure drop event fires reliably

    const srcId = e.dataTransfer.getData('text/plain');
    const destId = this.getAttribute('data-id');

    if (srcId && destId && srcId !== destId) {
        await reorderItems(srcId, destId);
    }
    return false;
}

function handleDragEnd(e) {
    this.style.opacity = '1';
    this.classList.remove('dragging');
    document.querySelectorAll('.bookmark-card, .reading-item').forEach(c => c.classList.remove('drag-over'));
}

async function reorderItems(srcId, destId) {
    const srcItem = items.find(i => i.id === srcId);
    const destItem = items.find(i => i.id === destId);

    if (!srcItem || !destItem || srcItem.type !== destItem.type) return;

    // Logic: Identify position
    // We are dragging in a list that is sorted by Pinned Status then Order then Timestamp.

    // 1. Determine "New List State"
    // Extract everything of this type
    const list = items.filter(i => i.type === srcItem.type);

    // Visualize the Sorted List currently on screen
    const sortedList = list.sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        if (a.isPinned) return (a.order || 0) - (b.order || 0);
        return b.timestamp - a.timestamp;
    });

    const srcIndex = sortedList.findIndex(i => i.id === srcId);
    const destIndex = sortedList.findIndex(i => i.id === destId);

    if (srcIndex < 0 || destIndex < 0) return;

    // Move in array
    sortedList.splice(srcIndex, 1);
    sortedList.splice(destIndex, 0, srcItem);

    // 2. Re-evaluate Pinned Status based on Neighbors
    // We look at the item BEFORE and AFTER the new position of Src in the unified list.
    // Actually, simpler: Look at Dest. 
    // If I drop onto Dest... should I take its pinned status?
    // Case 1: Drag Pinned (A) to Unpinned (B). Dest=B(unpinned). Src becomes Unpinned? Yes.
    // Case 2: Drag Unpinned (C) to Pinned (D). Dest=D(pinned). Src becomes Pinned? Yes.

    srcItem.isPinned = destItem.isPinned;

    // 3. Re-assign Order
    // Let's iterate the whole SortedList and assign 'order' index.

    sortedList.forEach((item, index) => {
        item.order = index;
    });

    // OPTIMISTIC UPDATE
    renderAll();

    // Save
    if (isFirebaseReady) {
        try {
            const batch = db.batch();
            const userRef = db.collection('users').doc(user.uid).collection('items');

            sortedList.forEach(item => {
                const docRef = userRef.doc(item.id);
                batch.update(docRef, { order: item.order, isPinned: item.isPinned });
            });
            await batch.commit();
        } catch (e) { console.error("Batch save failed", e); }
    } else {
        saveLocalData();
        // renderAll already called
    }
}
