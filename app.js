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
const confirmDeleteBtn = document.getElementById('confirm-delete-btn');

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

// -- New Settings UI --
const loadingOverlay = document.getElementById('loading-overlay');
const settingsBtn = document.getElementById('settings-btn');
const settingsView = document.getElementById('settings-view');

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
                author: data.data.author || null
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

function getFaviconUrl(url) {
    try {
        const domain = new URL(url).hostname;
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
    const bookmarks = items.filter(i => i.type === 'bookmark').sort((a, b) => b.timestamp - a.timestamp);

    if (bookmarks.length === 0) {
        bookmarksContainer.innerHTML = '<div style="grid-column: 1/-1; text-align: center; opacity: 0.6; padding-top: 40px;">No bookmarks yet</div>';
    } else {
        bookmarks.forEach(item => {
            const card = document.createElement('div');
            card.className = 'bookmark-card';
            const iconUrl = getFaviconUrl(item.url);

            card.innerHTML = `
                <div class="card-actions">
                    <button class="action-btn edit-btn" title="Edit"><span class="material-symbols-outlined" style="font-size: 18px;">edit</span></button>
                    <button class="action-btn delete-btn" title="Delete"><span class="material-symbols-outlined" style="font-size: 18px;">delete</span></button>
                </div>
                <img src="${iconUrl}" class="bookmark-icon" loading="lazy">
                <div class="bookmark-title">${item.title || new URL(item.url).hostname}</div>
            `;

            card.addEventListener('click', (e) => {
                if (e.target.closest('.action-btn')) return;
                performOpenUrl(item.url); // Use In-App Logic
            });

            card.querySelector('.edit-btn').addEventListener('click', () => openEditModal(item));
            card.querySelector('.delete-btn').addEventListener('click', () => requestDelete(item.id));

            bookmarksContainer.appendChild(card);
        });
    }
}

function renderReadingList() {
    if (!readingContainer) return;
    readingContainer.innerHTML = '';
    const readingItems = items.filter(i => i.type === 'reading').sort((a, b) => b.timestamp - a.timestamp);

    if (readingItems.length === 0) {
        readingContainer.innerHTML = '<div style="text-align: center; opacity: 0.6; padding-top: 40px; grid-column: 1/-1;">Reading list empty</div>';
    } else {
        readingItems.forEach(item => {
            const card = document.createElement('div');
            card.className = 'reading-item';

            const imageUrl = item.image || getPlaceholderImage(item.url);
            const domain = new URL(item.url).hostname;
            const favicon = getFaviconUrl(item.url);

            card.innerHTML = `
                <div class="card-actions">
                    <button class="action-btn edit-btn" title="Edit"><span class="material-symbols-outlined" style="font-size: 18px;">edit</span></button>
                    <button class="action-btn delete-btn" title="Delete"><span class="material-symbols-outlined" style="font-size: 18px;">delete</span></button>
                </div>
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

            card.addEventListener('click', (e) => {
                if (e.target.closest('.action-btn')) return;
                performOpenUrl(item.url); // Use In-App Logic
            });

            card.querySelector('.edit-btn').addEventListener('click', () => openEditModal(item));
            card.querySelector('.delete-btn').addEventListener('click', () => requestDelete(item.id));

            readingContainer.appendChild(card);
        });
    }
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
    confirmOverlay.classList.add('open');
}

function confirmDelete() {
    if (pendingDeleteId) {
        deleteItem(pendingDeleteId);
        pendingDeleteId = null;
    }
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
        dateEl.textContent = now.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
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
                if (confirm("Sign out?")) auth.signOut();
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

    if (fab) fab.addEventListener('click', () => openAddModal());

    const closeAddFn = () => modalOverlay.classList.remove('open');
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeAddFn);
    if (cancelBtn) cancelBtn.addEventListener('click', closeAddFn);
    if (modalOverlay) modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeAddFn();
    });

    if (confirmCancelBtn) confirmCancelBtn.addEventListener('click', () => confirmOverlay.classList.remove('open'));
    if (confirmOverlay) confirmOverlay.addEventListener('click', (e) => {
        if (e.target === confirmOverlay) confirmOverlay.classList.remove('open');
    });
    if (confirmDeleteBtn) confirmDeleteBtn.addEventListener('click', confirmDelete);

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
            let fetchedData = {};
            if (type === 'reading' && !title) {
                fetchedData = await fetchMetadata(finalUrl);
                if (fetchedData && fetchedData.title) {
                    title = fetchedData.title;
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

    // User Profile (Legacy code removed, handled by authBtn now)
    /*
    if (userProfileBtn) userProfileBtn.addEventListener('click', () => {
        ...
    });
    */
}
