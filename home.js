// Firebase設定
const firebaseConfig = {
    apiKey: "AIzaSyD9aDMtNeMUaUv4UAG28SZDJyCrskwrCXk",
    authDomain: "shimizu-ayumi-homepage.firebaseapp.com",
    projectId: "shimizu-ayumi-homepage",
    storageBucket: "shimizu-ayumi-homepage.firebasestorage.app",
    messagingSenderId: "996684398293",
    appId: "1:996684398293:web:e361b0adbe955686f32c5c",
    measurementId: "G-N8ENT8NJHM"
};

// Firebase初期化
let db = null;
let storage = null;
let firebaseInitialized = false;

if (typeof firebase !== 'undefined') {
    try {
        if (firebase.apps.length === 0) {
            firebase.initializeApp(firebaseConfig);
        }
        db = firebase.firestore();
        storage = firebase.storage();
        firebaseInitialized = true;
        console.log('Firebaseが初期化されました');
    } catch (error) {
        console.error('Firebase初期化エラー:', error);
    }
} else {
    console.warn('Firebaseスクリプトが読み込まれていません。');
}

// ユーザーID
function getUserId() {
    let userId = localStorage.getItem('userId');
    if (!userId) {
        userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('userId', userId);
    }
    return userId;
}

// =============================
// IndexedDB（ローカルキャッシュ用）
// =============================

let indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
let db_indexed = null;

function initIndexedDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('MemoriesDB', 2);

        request.onerror = () => reject(request.error);

        request.onsuccess = () => {
            db_indexed = request.result;
            resolve(db_indexed);
        };

        request.onupgradeneeded = (event) => {
            db_indexed = event.target.result;
            if (!db_indexed.objectStoreNames.contains('memories')) {
                db_indexed.createObjectStore('memories', { keyPath: 'date' });
            }
        };
    });
}

function saveToIndexedDB(data) {
    if (!db_indexed) return Promise.resolve();
    return new Promise((resolve, reject) => {
        const tx = db_indexed.transaction(['memories'], 'readwrite');
        const store = tx.objectStore('memories');
        const req = store.put(data);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => resolve();
    });
}

function loadFromIndexedDB() {
    if (!db_indexed) return Promise.resolve([]);
    return new Promise((resolve, reject) => {
        const tx = db_indexed.transaction(['memories'], 'readonly');
        const store = tx.objectStore('memories');
        const req = store.getAll();
        req.onerror = () => reject(req.error);
        req.onsuccess = () => resolve(req.result);
    });
}

function removeFromIndexedDB(dateKey) {
    if (!db_indexed) return Promise.resolve();
    return new Promise((resolve, reject) => {
        const tx = db_indexed.transaction(['memories'], 'readwrite');
        const store = tx.objectStore('memories');
        const req = store.delete(dateKey);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => resolve();
    });
}

// =============================
// 現在のフィルター状態
// =============================
let currentFilter = 'all'; // 'all' | 'image' | 'video'

// =============================
// ページ初期化
// =============================

document.addEventListener('DOMContentLoaded', function () {
    calculateRelationshipDays();
    setupTabNavigation();
    setupMediaUpload();
    setupModalEvents();
    setupHashtagSearch();
    setupMediaFilter();
    setupCalendar();
    displayCurrentDate();
    displayWeather();

    initIndexedDB().then(() => {
        loadMediaFromFirebase();
    }).catch(() => {
        loadMediaFromFirebase();
    });
});

// =============================
// タブナビゲーション
// =============================

function setupTabNavigation() {
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', function () {
            switchTab(this.getAttribute('data-tab'));
        });
    });
}

function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
    document.getElementById(tabName).classList.add('active');
    document.querySelector('[data-tab="' + tabName + '"]').classList.add('active');
    if (tabName === 'calendar') renderCalendar();
}

// =============================
// 交際期間
// =============================

function calculateRelationshipDays() {
    const startDate = new Date('2025-11-09');
    const today = new Date();
    startDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    const days = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));
    document.getElementById('dayCount').textContent = days;
}

// =============================
// メディアフィルター（写真・動画切り替え）
// =============================

function setupMediaFilter() {
    document.querySelectorAll('.media-filter-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            document.querySelectorAll('.media-filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentFilter = this.getAttribute('data-filter');
            applyMediaFilter();
        });
    });
}

function applyMediaFilter() {
    document.querySelectorAll('.photo-item').forEach(item => {
        const type = item.getAttribute('data-media-type');
        if (currentFilter === 'all') {
            item.classList.remove('hidden-by-filter');
        } else if (currentFilter === type) {
            item.classList.remove('hidden-by-filter');
        } else {
            item.classList.add('hidden-by-filter');
        }
    });
}

// =============================
// ハッシュタグ検索
// =============================

function setupHashtagSearch() {
    const searchInput = document.getElementById('hashtagSearchInput');
    const clearBtn = document.getElementById('hashtagSearchClear');
    if (!searchInput) return;

    searchInput.addEventListener('input', function () {
        clearBtn.classList.toggle('hidden', this.value.trim().length === 0);
        filterGalleryByHashtag(this.value.trim());
    });

    clearBtn.addEventListener('click', function () {
        searchInput.value = '';
        clearBtn.classList.add('hidden');
        filterGalleryByHashtag('');
        searchInput.focus();
    });

    searchInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') filterGalleryByHashtag(this.value.trim());
    });
}

function filterGalleryByHashtag(query) {
    const resultInfo = document.getElementById('searchResultInfo');
    const normalizedQuery = query.replace(/^#/, '').toLowerCase();
    let visibleCount = 0;

    document.querySelectorAll('.photo-item').forEach(item => {
        if (!normalizedQuery) {
            item.classList.remove('hidden-by-search');
            visibleCount++;
        } else {
            const tags = (item.getAttribute('data-hashtags') || '').toLowerCase();
            if (tags.includes(normalizedQuery)) {
                item.classList.remove('hidden-by-search');
                visibleCount++;
            } else {
                item.classList.add('hidden-by-search');
            }
        }
    });

    if (!normalizedQuery) {
        resultInfo.classList.add('hidden');
    } else {
        resultInfo.classList.remove('hidden');
        resultInfo.textContent = visibleCount === 0
            ? '「#' + normalizedQuery + '」のメディアは見つかりませんでした'
            : '「#' + normalizedQuery + '」のメディアが ' + visibleCount + ' 件見つかりました';
        resultInfo.className = 'search-result-info ' + (visibleCount === 0 ? 'no-result' : 'has-result');
    }
}

// =============================
// モーダル
// =============================

function setupModalEvents() {
    const modal = document.getElementById('photoModal');
    document.getElementById('modalCloseBtn').addEventListener('click', closeModal);
    modal.addEventListener('click', function (e) { if (e.target === this) closeModal(); });
    document.getElementById('modalDeleteBtn').addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (window.currentMediaData) {
            deleteMedia(window.currentMediaData);
            closeModal();
        }
    });
}

function closeModal() {
    const modalVideo = document.getElementById('modalVideo');
    modalVideo.pause();
    modalVideo.src = '';
    document.getElementById('photoModal').classList.add('hidden');
}

// =============================
// メディアアップロード
// =============================

function setupMediaUpload() {
    const input = document.getElementById('mediaUpload');
    const uploadBox = document.querySelector('.upload-box');

    input.addEventListener('change', handleMediaUpload);

    uploadBox.addEventListener('dragover', function (e) {
        e.preventDefault();
        this.style.borderColor = '#764ba2';
        this.style.background = '#f0f1ff';
    });

    uploadBox.addEventListener('dragleave', function (e) {
        e.preventDefault();
        this.style.borderColor = '#667eea';
        this.style.background = '#f8f9ff';
    });

    uploadBox.addEventListener('drop', function (e) {
        e.preventDefault();
        this.style.borderColor = '#667eea';
        this.style.background = '#f8f9ff';
        handleFiles(e.dataTransfer.files);
    });
}

function handleMediaUpload(e) {
    handleFiles(e.target.files);
}

function handleFiles(files) {
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type.startsWith('image/')) {
            readFileAndPreview(file, 'image');
        } else if (file.type.startsWith('video/')) {
            // 動画はFileオブジェクトをそのまま保持（base64に変換しない）
            showVideoPreview(file);
        }
    }
}

function readFileAndPreview(file, mediaType) {
    const reader = new FileReader();
    reader.onload = function (e) {
        showImagePreview(e.target.result);
    };
    reader.readAsDataURL(file);
}

// 画像プレビュー
function showImagePreview(imageData) {
    const previewArea = document.getElementById('previewArea');
    document.getElementById('previewImage').classList.remove('hidden');
    document.getElementById('previewImage').src = imageData;
    document.getElementById('previewVideo').classList.add('hidden');
    document.getElementById('previewVideo').src = '';
    document.getElementById('previewMessage').textContent = '「Now」ボタンを押すと、今の日付と時刻と共に保存されます';
    document.getElementById('photoComment').value = '';
    document.getElementById('photoHashtags').value = '';
    previewArea.classList.remove('hidden');

    window.currentMediaData = imageData;
    window.currentMediaType = 'image';
    window.currentMediaFile = null;

    setupPreviewButtons();
}

// 動画プレビュー（Fileオブジェクトを使用）
function showVideoPreview(file) {
    const previewArea = document.getElementById('previewArea');
    const previewVideo = document.getElementById('previewVideo');

    document.getElementById('previewImage').classList.add('hidden');
    document.getElementById('previewImage').src = '';
    previewVideo.classList.remove('hidden');

    // Object URLでプレビュー（base64変換なし→高速）
    const objectUrl = URL.createObjectURL(file);
    previewVideo.src = objectUrl;

    document.getElementById('previewMessage').textContent = '「Now」ボタンを押すと Firebase Storage にアップロードされ、共有されます';
    document.getElementById('photoComment').value = '';
    document.getElementById('photoHashtags').value = '';
    previewArea.classList.remove('hidden');

    window.currentMediaData = null;
    window.currentMediaType = 'video';
    window.currentMediaFile = file;       // Fileオブジェクトを保持
    window.currentMediaObjectUrl = objectUrl;

    setupPreviewButtons();
}

function setupPreviewButtons() {
    const nowButton = document.getElementById('nowButton');
    const cancelButton = document.getElementById('cancelButton');

    nowButton.replaceWith(nowButton.cloneNode(true));
    cancelButton.replaceWith(cancelButton.cloneNode(true));

    const newNow = document.getElementById('nowButton');
    const newCancel = document.getElementById('cancelButton');

    newNow.addEventListener('click', handleNowButtonClick);
    newCancel.addEventListener('click', handleCancelButtonClick);

    newNow.addEventListener('touchend', function (e) {
        e.preventDefault();
        handleNowButtonClick.call(this, e);
    });
    newCancel.addEventListener('touchend', function (e) {
        e.preventDefault();
        handleCancelButtonClick.call(this, e);
    });
}

function handleNowButtonClick(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (e && e.stopPropagation) e.stopPropagation();

    const comment = document.getElementById('photoComment').value.trim();
    const hashtagRaw = document.getElementById('photoHashtags').value.trim();
    const hashtags = hashtagRaw
        ? hashtagRaw.split(/\s+/).map(tag => tag.startsWith('#') ? tag : '#' + tag)
        : [];

    if (window.currentMediaType === 'image' && window.currentMediaData) {
        saveImageWithTimestamp(window.currentMediaData, comment, hashtags);
        resetPreview();
    } else if (window.currentMediaType === 'video' && window.currentMediaFile) {
        // 動画はFirebase Storageにアップロード
        uploadVideoToStorage(window.currentMediaFile, comment, hashtags);
    }
}

function handleCancelButtonClick(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (e && e.stopPropagation) e.stopPropagation();
    resetPreview();
}

function resetPreview() {
    document.getElementById('previewArea').classList.add('hidden');
    document.getElementById('mediaUpload').value = '';
    document.getElementById('photoComment').value = '';
    document.getElementById('photoHashtags').value = '';
    document.getElementById('previewVideo').src = '';
    document.getElementById('uploadProgress').classList.add('hidden');
    if (window.currentMediaObjectUrl) {
        URL.revokeObjectURL(window.currentMediaObjectUrl);
    }
    window.currentMediaData = null;
    window.currentMediaType = null;
    window.currentMediaFile = null;
    window.currentMediaObjectUrl = null;
}

// =============================
// 画像の保存
// =============================

function saveImageWithTimestamp(imageData, comment, hashtags) {
    const now = new Date();
    const timestamp = formatDateTime(now);

    const mediaObj = {
        mediaType: 'image',
        image: imageData,
        videoUrl: null,
        timestamp: timestamp,
        date: now.toISOString(),
        userId: getUserId(),
        comment: comment,
        hashtags: hashtags
    };

    saveImageToFirebase(mediaObj);
    addMediaToGallery(mediaObj);
    updatePhotoDatesMap(mediaObj);
}

function saveImageToFirebase(mediaObj) {
    if (!firebaseInitialized || !db) return;

    compressImage(mediaObj.image, 0.6).then(compressed => {
        db.collection('memories').add({
            mediaType: 'image',
            image: compressed,
            videoUrl: null,
            timestamp: mediaObj.timestamp,
            date: mediaObj.date,
            userId: mediaObj.userId,
            comment: mediaObj.comment || '',
            hashtags: mediaObj.hashtags || []
        }).then(ref => console.log('画像をFirestoreに保存:', ref.id))
          .catch(err => console.error('Firestore保存エラー:', err));
    });
}

// =============================
// 動画のアップロード（Firebase Storage）
// =============================

function uploadVideoToStorage(file, comment, hashtags) {
    if (!firebaseInitialized || !storage || !db) {
        alert('Firebase Storageが利用できません。');
        return;
    }

    const now = new Date();
    const timestamp = formatDateTime(now);
    const dateStr = now.toISOString();
    const fileName = 'videos/' + getUserId() + '_' + Date.now() + '_' + file.name;

    const storageRef = storage.ref(fileName);
    const uploadTask = storageRef.put(file);

    // 進捗バーを表示
    const progressArea = document.getElementById('uploadProgress');
    const progressFill = document.getElementById('progressBarFill');
    const progressPercent = document.getElementById('progressPercent');
    const nowBtn = document.getElementById('nowButton');
    const cancelBtn = document.getElementById('cancelButton');

    progressArea.classList.remove('hidden');
    nowBtn.disabled = true;
    cancelBtn.disabled = true;
    nowBtn.style.opacity = '0.5';
    cancelBtn.style.opacity = '0.5';

    uploadTask.on('state_changed',
        // 進捗
        function (snapshot) {
            const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
            progressFill.style.width = pct + '%';
            progressPercent.textContent = pct;
        },
        // エラー
        function (error) {
            console.error('動画アップロードエラー:', error);
            alert('動画のアップロードに失敗しました: ' + error.message);
            progressArea.classList.add('hidden');
            nowBtn.disabled = false;
            cancelBtn.disabled = false;
            nowBtn.style.opacity = '1';
            cancelBtn.style.opacity = '1';
        },
        // 完了
        function () {
            uploadTask.snapshot.ref.getDownloadURL().then(function (downloadUrl) {
                const mediaObj = {
                    mediaType: 'video',
                    image: null,
                    videoUrl: downloadUrl,
                    storagePath: fileName,
                    timestamp: timestamp,
                    date: dateStr,
                    userId: getUserId(),
                    comment: comment,
                    hashtags: hashtags
                };

                // Firestoreにメタデータを保存
                db.collection('memories').add({
                    mediaType: 'video',
                    image: null,
                    videoUrl: downloadUrl,
                    storagePath: fileName,
                    timestamp: timestamp,
                    date: dateStr,
                    userId: getUserId(),
                    comment: comment || '',
                    hashtags: hashtags || []
                }).then(ref => {
                    console.log('動画メタをFirestoreに保存:', ref.id);
                    mediaObj.firebaseId = ref.id;
                }).catch(err => console.error('Firestore保存エラー:', err));

                addMediaToGallery(mediaObj);
                updatePhotoDatesMap(mediaObj);
                resetPreview();
            });
        }
    );
}

// =============================
// Firebase読み込み
// =============================

let photoDatesMap = {};

function loadMediaFromFirebase() {
    if (!firebaseInitialized || !db) {
        console.warn('Firebaseが利用できません');
        return;
    }

    db.collection('memories')
        .orderBy('date', 'desc')
        .onSnapshot(snapshot => {
            document.getElementById('photoGallery').innerHTML = '';
            photoDatesMap = {};

            snapshot.forEach(doc => {
                const data = doc.data();
                data.firebaseId = doc.id;
                addMediaToGallery(data);
                updatePhotoDatesMap(data);
            });

            applyMediaFilter();

            const searchInput = document.getElementById('hashtagSearchInput');
            if (searchInput && searchInput.value.trim()) {
                filterGalleryByHashtag(searchInput.value.trim());
            }

            renderCalendar();
        },
        error => {
            console.error('Firebase読み込みエラー:', error);
        });
}

// =============================
// ギャラリーへの追加
// =============================

function addMediaToGallery(mediaObj) {
    const gallery = document.getElementById('photoGallery');
    const uid = mediaObj.firebaseId || mediaObj.date;

    if (document.querySelector('[data-firebase-id="' + uid + '"]')) return;

    const item = document.createElement('div');
    item.className = 'photo-item';
    item.setAttribute('data-firebase-id', uid);
    item.setAttribute('data-media-type', mediaObj.mediaType || 'image');

    if (mediaObj.hashtags && mediaObj.hashtags.length > 0) {
        item.setAttribute('data-hashtags', mediaObj.hashtags.join(' '));
    }

    if (mediaObj.mediaType === 'video') {
        // 動画サムネイル：videoタグでプレビュー
        const video = document.createElement('video');
        video.src = mediaObj.videoUrl;
        video.className = 'gallery-video';
        video.muted = true;
        video.preload = 'metadata';
        video.playsInline = true;

        const playOverlay = document.createElement('div');
        playOverlay.className = 'play-overlay';
        playOverlay.innerHTML = '▶';

        item.appendChild(video);
        item.appendChild(playOverlay);
    } else {
        const img = document.createElement('img');
        img.src = mediaObj.image;
        item.appendChild(img);
    }

    // タイムスタンプ
    const label = document.createElement('div');
    label.className = 'timestamp-label';
    label.textContent = mediaObj.timestamp;
    item.appendChild(label);

    // ハッシュタグ
    if (mediaObj.hashtags && mediaObj.hashtags.length > 0) {
        const tagLabel = document.createElement('div');
        tagLabel.className = 'hashtag-label';
        tagLabel.textContent = mediaObj.hashtags.join(' ');
        item.appendChild(tagLabel);
    }

    // 削除ボタン
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.innerHTML = '×';
    deleteBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        deleteMedia(mediaObj);
        item.remove();
    });
    item.appendChild(deleteBtn);

    // クリックでモーダル
    item.addEventListener('click', function () {
        showMediaModal(mediaObj);
    });

    // フィルターを適用してから追加
    if (currentFilter !== 'all' && currentFilter !== (mediaObj.mediaType || 'image')) {
        item.classList.add('hidden-by-filter');
    }

    gallery.appendChild(item);
}

// =============================
// モーダル表示
// =============================

function showMediaModal(mediaObj) {
    const modal = document.getElementById('photoModal');
    const modalImage = document.getElementById('modalImage');
    const modalVideo = document.getElementById('modalVideo');
    const modalDate = document.getElementById('modalDate');
    const modalComment = document.getElementById('modalComment');
    const modalHashtags = document.getElementById('modalHashtags');

    window.currentMediaData = mediaObj;

    if (mediaObj.mediaType === 'video') {
        modalImage.classList.add('hidden');
        modalImage.src = '';
        modalVideo.classList.remove('hidden');
        modalVideo.src = mediaObj.videoUrl;  // Firebase StorageのURL
    } else {
        modalVideo.classList.add('hidden');
        modalVideo.pause();
        modalVideo.src = '';
        modalImage.classList.remove('hidden');
        modalImage.src = mediaObj.image;
    }

    modalDate.textContent = mediaObj.timestamp;

    if (mediaObj.comment) {
        modalComment.textContent = mediaObj.comment;
        modalComment.style.display = 'block';
    } else {
        modalComment.style.display = 'none';
    }

    modalHashtags.innerHTML = '';
    if (mediaObj.hashtags && mediaObj.hashtags.length > 0) {
        mediaObj.hashtags.forEach(tag => {
            const span = document.createElement('span');
            span.className = 'modal-hashtag-item';
            span.textContent = tag;
            span.addEventListener('click', function () {
                closeModal();
                const searchInput = document.getElementById('hashtagSearchInput');
                const clearBtn = document.getElementById('hashtagSearchClear');
                searchInput.value = tag;
                clearBtn.classList.remove('hidden');
                filterGalleryByHashtag(tag);
            });
            modalHashtags.appendChild(span);
        });
    }

    modal.classList.remove('hidden');
}

// =============================
// 削除
// =============================

function deleteMedia(mediaObj) {
    const uid = mediaObj.firebaseId || mediaObj.date;

    // Firestoreから削除
    if (mediaObj.firebaseId && firebaseInitialized && db) {
        db.collection('memories').doc(mediaObj.firebaseId).delete()
            .then(() => console.log('Firestoreから削除'))
            .catch(err => console.error('Firestore削除エラー:', err));
    }

    // Firebase Storageから動画を削除
    if (mediaObj.storagePath && firebaseInitialized && storage) {
        storage.ref(mediaObj.storagePath).delete()
            .then(() => console.log('Storageから動画を削除'))
            .catch(err => console.error('Storage削除エラー:', err));
    }

    // ローカルからも削除
    removeFromIndexedDB(mediaObj.date);

    // ギャラリーからDOMを削除
    const item = document.querySelector('[data-firebase-id="' + uid + '"]');
    if (item) item.remove();
}

// =============================
// ユーティリティ
// =============================

function formatDateTime(date) {
    return date.getFullYear() + '年' +
        String(date.getMonth() + 1).padStart(2, '0') + '月' +
        String(date.getDate()).padStart(2, '0') + '日 ' +
        String(date.getHours()).padStart(2, '0') + ':' +
        String(date.getMinutes()).padStart(2, '0');
}

function compressImage(imageData, quality) {
    return new Promise(resolve => {
        const img = new Image();
        img.onload = function () {
            const canvas = document.createElement('canvas');
            let w = img.width, h = img.height;
            const maxW = 1200;
            if (w > maxW) { h = h * maxW / w; w = maxW; }
            canvas.width = w;
            canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.src = imageData;
    });
}

// =============================
// カレンダー
// =============================

const calendarState = {
    view: 'month',
    year: new Date().getFullYear(),
    month: new Date().getMonth()
};

function setupCalendar() {
    const viewSelect = document.getElementById('calendarViewSelect');
    if (!viewSelect) return;

    viewSelect.addEventListener('change', function () {
        calendarState.view = this.value;
        renderCalendar();
    });

    document.getElementById('calPrev').addEventListener('click', function () {
        if (calendarState.view === 'month') {
            calendarState.month--;
            if (calendarState.month < 0) { calendarState.month = 11; calendarState.year--; }
        } else {
            calendarState.year--;
        }
        renderCalendar();
    });

    document.getElementById('calNext').addEventListener('click', function () {
        if (calendarState.view === 'month') {
            calendarState.month++;
            if (calendarState.month > 11) { calendarState.month = 0; calendarState.year++; }
        } else {
            calendarState.year++;
        }
        renderCalendar();
    });

    renderCalendar();
}

function renderCalendar() {
    calendarState.view === 'month' ? renderMonthCalendar() : renderYearCalendar();
}

function updateCalendarTitle() {
    const months = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
    document.getElementById('calendarTitle').textContent = calendarState.view === 'month'
        ? calendarState.year + '年 ' + months[calendarState.month]
        : calendarState.year + '年';
}

function updatePhotoDatesMap(mediaObj) {
    if (!mediaObj.date) return;
    const d = new Date(mediaObj.date);
    const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    if (!photoDatesMap[key]) photoDatesMap[key] = [];
    photoDatesMap[key].push(mediaObj);
}

function renderMonthCalendar() {
    updateCalendarTitle();
    const body = document.getElementById('calendarBody');
    body.innerHTML = '';

    const { year, month } = calendarState;
    const today = new Date();
    const table = document.createElement('table');
    table.className = 'calendar-table';

    const thead = document.createElement('thead');
    const hRow = document.createElement('tr');
    ['日','月','火','水','木','金','土'].forEach((d, i) => {
        const th = document.createElement('th');
        th.textContent = d;
        if (i === 0) th.className = 'sunday';
        if (i === 6) th.className = 'saturday';
        hRow.appendChild(th);
    });
    thead.appendChild(hRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let day = 1;

    for (let row = 0; row < 6; row++) {
        const tr = document.createElement('tr');
        for (let col = 0; col < 7; col++) {
            const td = document.createElement('td');
            if ((row === 0 && col < firstDay) || day > daysInMonth) {
                td.className = 'empty';
            } else {
                const key = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
                const media = photoDatesMap[key] || [];
                td.className = 'calendar-day';
                if (col === 0) td.classList.add('sunday');
                if (col === 6) td.classList.add('saturday');
                if (year === today.getFullYear() && month === today.getMonth() && day === today.getDate()) {
                    td.classList.add('today');
                }
                const dayNum = document.createElement('span');
                dayNum.className = 'day-number';
                dayNum.textContent = day;
                td.appendChild(dayNum);

                if (media.length > 0) {
                    const hasVideo = media.some(m => m.mediaType === 'video');
                    const hasImage = media.some(m => m.mediaType !== 'video');
                    const dot = document.createElement('span');
                    dot.className = 'photo-dot';
                    dot.textContent = hasVideo && hasImage ? '📷🎬' : hasVideo ? '🎬' : '📷';
                    td.appendChild(dot);
                    td.classList.add('has-photo');
                    td.addEventListener('click', () => switchTab('memories'));
                }
                day++;
            }
            tr.appendChild(td);
        }
        tbody.appendChild(tr);
        if (day > daysInMonth) break;
    }
    table.appendChild(tbody);
    body.appendChild(table);
}

function renderYearCalendar() {
    updateCalendarTitle();
    const body = document.getElementById('calendarBody');
    body.innerHTML = '';
    const { year } = calendarState;
    const today = new Date();
    const months = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
    const grid = document.createElement('div');
    grid.className = 'year-grid';

    for (let m = 0; m < 12; m++) {
        const card = document.createElement('div');
        card.className = 'month-card';
        const title = document.createElement('div');
        title.className = 'month-card-title';
        title.textContent = months[m];
        title.addEventListener('click', function () {
            calendarState.view = 'month';
            calendarState.month = m;
            document.getElementById('calendarViewSelect').value = 'month';
            renderCalendar();
        });
        card.appendChild(title);

        const miniTable = document.createElement('table');
        miniTable.className = 'mini-calendar';
        const mThead = document.createElement('thead');
        const mHRow = document.createElement('tr');
        ['日','月','火','水','木','金','土'].forEach((d, i) => {
            const th = document.createElement('th');
            th.textContent = d;
            if (i === 0) th.className = 'sunday';
            if (i === 6) th.className = 'saturday';
            mHRow.appendChild(th);
        });
        mThead.appendChild(mHRow);
        miniTable.appendChild(mThead);

        const mTbody = document.createElement('tbody');
        const firstDay = new Date(year, m, 1).getDay();
        const daysInMonth = new Date(year, m + 1, 0).getDate();
        let day = 1;

        for (let row = 0; row < 6; row++) {
            const tr = document.createElement('tr');
            for (let col = 0; col < 7; col++) {
                const td = document.createElement('td');
                if ((row === 0 && col < firstDay) || day > daysInMonth) {
                    td.className = 'empty';
                } else {
                    const key = year + '-' + String(m + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
                    const media = photoDatesMap[key] || [];
                    if (col === 0) td.className = 'sunday';
                    if (col === 6) td.className = 'saturday';
                    if (year === today.getFullYear() && m === today.getMonth() && day === today.getDate()) td.classList.add('today');
                    td.textContent = day;
                    if (media.length > 0) { td.classList.add('has-photo'); }
                    day++;
                }
                tr.appendChild(td);
            }
            mTbody.appendChild(tr);
            if (day > daysInMonth) break;
        }
        miniTable.appendChild(mTbody);
        card.appendChild(miniTable);
        grid.appendChild(card);
    }
    body.appendChild(grid);
}

// =============================
// 日付・天気表示
// =============================

function displayCurrentDate() {
    const el = document.getElementById('currentDate');
    if (!el) return;
    const now = new Date();
    const days = ['日','月','火','水','木','金','土'];
    el.textContent = now.getFullYear() + '年' +
        String(now.getMonth() + 1).padStart(2, '0') + '月' +
        String(now.getDate()).padStart(2, '0') + '日（' +
        days[now.getDay()] + '）';
}

function displayWeather() {
    const tempEl = document.getElementById('weatherTemp');
    const descEl = document.getElementById('weatherDesc');
    if (!tempEl || !descEl) return;

    fetch('https://api.open-meteo.com/v1/forecast?latitude=33.5904&longitude=130.4017&current=temperature_2m,weather_code&timezone=Asia/Tokyo')
        .then(r => r.json())
        .then(data => {
            const descriptions = {
                0:'晴れ', 1:'ほぼ晴れ', 2:'一部曇り', 3:'曇り',
                45:'霧', 48:'むし霧',
                51:'ほぼ止まない霧雨', 53:'霧雨', 55:'濃い霧雨',
                61:'弱い雨', 63:'雨', 65:'強い雨',
                71:'弱い雪', 73:'雪', 75:'強い雪',
                80:'弱いにわか雨', 81:'にわか雨', 82:'強いにわか雨',
                85:'にわか雪', 86:'強いにわか雪',
                95:'雷雨', 96:'ひょう付き雷雨', 99:'ひょう付き雷雨'
            };
            tempEl.textContent = Math.round(data.current.temperature_2m) + '°C';
            descEl.textContent = descriptions[data.current.weather_code] || '不明';
        })
        .catch(() => {
            tempEl.textContent = '--';
            descEl.textContent = '天気情報を取得できません';
        });
}