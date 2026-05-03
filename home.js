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
let firebaseInitialized = false;

console.log('typeof firebase:', typeof firebase);

if (typeof firebase !== 'undefined') {
    try {
        console.log('Firebaseスクリプト検出。初期化を開始します');
        console.log('firebase.apps.length:', firebase.apps.length);

        if (firebase.apps.length === 0) {
            firebase.initializeApp(firebaseConfig);
            console.log('initializeApp実行');
        }

        db = firebase.firestore();
        firebaseInitialized = true;
        console.log('Firebaseが初期化されました');
    } catch (error) {
        console.error('Firebase初期化エラー:', error);
        console.error('エラー詳細:', error.message);
    }
} else {
    console.warn('Firebaseスクリプトが読み込まれていません。ローカルストレージのみを使用します。');
}

// ユーザーID（ローカルに保存）
function getUserId() {
    let userId = localStorage.getItem('userId');
    if (!userId) {
        userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('userId', userId);
    }
    return userId;
}

// IndexedDB初期化
let indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
let db_indexed = null;

function initIndexedDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('MemoriesDB', 1);

        request.onerror = () => {
            console.error('IndexedDB初期化エラー:', request.error);
            reject(request.error);
        };

        request.onsuccess = () => {
            db_indexed = request.result;
            console.log('IndexedDB初期化成功');
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

// IndexedDBに保存
function savePhotoToIndexedDB(photoData) {
    if (!db_indexed) return Promise.resolve();

    return new Promise((resolve, reject) => {
        const transaction = db_indexed.transaction(['memories'], 'readwrite');
        const store = transaction.objectStore('memories');
        const request = store.put(photoData);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            console.log('IndexedDBに保存しました');
            resolve();
        };
    });
}

// IndexedDBから読み込む
function loadPhotosFromIndexedDB() {
    if (!db_indexed) return Promise.resolve([]);

    return new Promise((resolve, reject) => {
        const transaction = db_indexed.transaction(['memories'], 'readonly');
        const store = transaction.objectStore('memories');
        const request = store.getAll();

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            console.log('IndexedDBから読み込み:', request.result.length, '件');
            resolve(request.result);
        };
    });
}

// IndexedDBから削除
function removePhotoFromIndexedDB(photoDate) {
    if (!db_indexed) return Promise.resolve();

    return new Promise((resolve, reject) => {
        const transaction = db_indexed.transaction(['memories'], 'readwrite');
        const store = transaction.objectStore('memories');
        const request = store.delete(photoDate);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            console.log('IndexedDBから削除しました');
            resolve();
        };
    });
}

// ページ読み込み時の初期化
document.addEventListener('DOMContentLoaded', function() {
    initializePage();
    calculateRelationshipDays();
    setupTabNavigation();
    setupMediaUpload();   // ← imageUpload → mediaUpload に変更
    setupModalEvents();
    setupHashtagSearch();
    setupCalendar();
    displayCurrentDate();
    displayWeather();

    initIndexedDB().then(() => {
        loadPhotosFromFirebase();
    }).catch(() => {
        console.warn('IndexedDB初期化失敗、Firebaseから読み込みます');
        loadPhotosFromFirebase();
    });
});

// モーダルイベントを初期化
function setupModalEvents() {
    const modal = document.getElementById('photoModal');
    const modalCloseBtn = document.getElementById('modalCloseBtn');
    const modalDeleteBtn = document.getElementById('modalDeleteBtn');

    modalCloseBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        closeModal();
    });

    modal.addEventListener('click', function(e) {
        if (e.target === this) {
            closeModal();
        }
    });

    modalDeleteBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();

        if (window.currentPhotoData) {
            deletePhoto(window.currentPhotoData);
            closeModal();
        }
    });
}

// モーダルを閉じる（動画を停止してから閉じる）
function closeModal() {
    const modalVideo = document.getElementById('modalVideo');
    if (modalVideo) {
        modalVideo.pause();
        modalVideo.src = '';
    }
    document.getElementById('photoModal').classList.add('hidden');
}

// =============================
// ハッシュタグ検索機能
// =============================

function setupHashtagSearch() {
    const searchInput = document.getElementById('hashtagSearchInput');
    const clearBtn = document.getElementById('hashtagSearchClear');

    if (!searchInput) return;

    searchInput.addEventListener('input', function() {
        const query = this.value.trim();
        clearBtn.classList.toggle('hidden', query.length === 0);
        filterGalleryByHashtag(query);
    });

    clearBtn.addEventListener('click', function() {
        searchInput.value = '';
        clearBtn.classList.add('hidden');
        filterGalleryByHashtag('');
        searchInput.focus();
    });

    searchInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') filterGalleryByHashtag(this.value.trim());
    });
}

function filterGalleryByHashtag(query) {
    const photoItems = document.querySelectorAll('.photo-item');
    const resultInfo = document.getElementById('searchResultInfo');
    const normalizedQuery = query.replace(/^#/, '').toLowerCase();
    let visibleCount = 0;

    photoItems.forEach(item => {
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
        if (visibleCount === 0) {
            resultInfo.textContent = '「#' + normalizedQuery + '」のメディアは見つかりませんでした';
            resultInfo.className = 'search-result-info no-result';
        } else {
            resultInfo.textContent = '「#' + normalizedQuery + '」のメディアが ' + visibleCount + ' 件見つかりました';
            resultInfo.className = 'search-result-info has-result';
        }
    }
}

// =============================
// カレンダー機能
// =============================

const calendarState = {
    view: 'month',
    year: new Date().getFullYear(),
    month: new Date().getMonth()
};

let photoDatesMap = {};

function setupCalendar() {
    const viewSelect = document.getElementById('calendarViewSelect');
    const prevBtn = document.getElementById('calPrev');
    const nextBtn = document.getElementById('calNext');

    if (!viewSelect) return;

    viewSelect.addEventListener('change', function() {
        calendarState.view = this.value;
        renderCalendar();
    });

    prevBtn.addEventListener('click', function() {
        if (calendarState.view === 'month') {
            calendarState.month--;
            if (calendarState.month < 0) { calendarState.month = 11; calendarState.year--; }
        } else {
            calendarState.year--;
        }
        renderCalendar();
    });

    nextBtn.addEventListener('click', function() {
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
    if (calendarState.view === 'month') {
        renderMonthCalendar();
    } else {
        renderYearCalendar();
    }
}

function updateCalendarTitle() {
    const titleEl = document.getElementById('calendarTitle');
    if (calendarState.view === 'month') {
        const monthNames = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
        titleEl.textContent = calendarState.year + '年 ' + monthNames[calendarState.month];
    } else {
        titleEl.textContent = calendarState.year + '年';
    }
}

function renderMonthCalendar() {
    updateCalendarTitle();
    const body = document.getElementById('calendarBody');
    body.innerHTML = '';

    const year = calendarState.year;
    const month = calendarState.month;
    const table = document.createElement('table');
    table.className = 'calendar-table';

    const dayNames = ['日','月','火','水','木','金','土'];
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    dayNames.forEach((d, i) => {
        const th = document.createElement('th');
        th.textContent = d;
        if (i === 0) th.className = 'sunday';
        if (i === 6) th.className = 'saturday';
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();

    let day = 1;
    for (let row = 0; row < 6; row++) {
        const tr = document.createElement('tr');
        for (let col = 0; col < 7; col++) {
            const td = document.createElement('td');

            if ((row === 0 && col < firstDay) || day > daysInMonth) {
                td.className = 'empty';
            } else {
                const dateKey = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
                const media = photoDatesMap[dateKey] || [];

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
                    const dot = document.createElement('span');
                    dot.className = 'photo-dot';
                    // 動画があればビデオアイコン、写真のみなら📷
                    const hasVideo = media.some(m => m.mediaType === 'video');
                    const hasImage = media.some(m => m.mediaType !== 'video');
                    dot.textContent = hasVideo && hasImage ? '📷🎬' : hasVideo ? '🎬' : '📷';
                    dot.title = media.length + '件のメディア';
                    td.appendChild(dot);
                    td.classList.add('has-photo');
                    td.addEventListener('click', function() { switchTab('memories'); });
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

    const year = calendarState.year;
    const today = new Date();
    const monthNames = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];

    const grid = document.createElement('div');
    grid.className = 'year-grid';

    for (let m = 0; m < 12; m++) {
        const monthCard = document.createElement('div');
        monthCard.className = 'month-card';

        const monthTitle = document.createElement('div');
        monthTitle.className = 'month-card-title';
        monthTitle.textContent = monthNames[m];
        monthTitle.addEventListener('click', function() {
            calendarState.view = 'month';
            calendarState.month = m;
            document.getElementById('calendarViewSelect').value = 'month';
            renderCalendar();
        });
        monthCard.appendChild(monthTitle);

        const miniTable = document.createElement('table');
        miniTable.className = 'mini-calendar';

        const miniThead = document.createElement('thead');
        const miniHeaderRow = document.createElement('tr');
        ['日','月','火','水','木','金','土'].forEach((d, i) => {
            const th = document.createElement('th');
            th.textContent = d;
            if (i === 0) th.className = 'sunday';
            if (i === 6) th.className = 'saturday';
            miniHeaderRow.appendChild(th);
        });
        miniThead.appendChild(miniHeaderRow);
        miniTable.appendChild(miniThead);

        const miniTbody = document.createElement('tbody');
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
                    const dateKey = year + '-' + String(m + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
                    const media = photoDatesMap[dateKey] || [];

                    if (col === 0) td.className = 'sunday';
                    if (col === 6) td.className = 'saturday';

                    if (year === today.getFullYear() && m === today.getMonth() && day === today.getDate()) {
                        td.classList.add('today');
                    }

                    td.textContent = day;

                    if (media.length > 0) {
                        td.classList.add('has-photo');
                        td.title = media.length + '件のメディア';
                    }

                    day++;
                }
                tr.appendChild(td);
            }
            miniTbody.appendChild(tr);
            if (day > daysInMonth) break;
        }

        miniTable.appendChild(miniTbody);
        monthCard.appendChild(miniTable);
        grid.appendChild(monthCard);
    }

    body.appendChild(grid);
}

function updatePhotoDatesMap(mediaData) {
    if (!mediaData.date) return;
    const d = new Date(mediaData.date);
    const key = d.getFullYear() + '-' +
                String(d.getMonth() + 1).padStart(2, '0') + '-' +
                String(d.getDate()).padStart(2, '0');
    if (!photoDatesMap[key]) photoDatesMap[key] = [];
    photoDatesMap[key].push(mediaData);
}

// ページ初期化
function initializePage() {
    console.log('ページが読み込まれました');
    console.log('ユーザーID:', getUserId());
}

// 交際期間の日数を計算
function calculateRelationshipDays() {
    const startDate = new Date('2025-11-09');
    const today = new Date();

    startDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    const timeDifference = today - startDate;
    const daysDifference = Math.floor(timeDifference / (1000 * 60 * 60 * 24));
    document.getElementById('dayCount').textContent = daysDifference;
}

// タブナビゲーション設定
function setupTabNavigation() {
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            switchTab(this.getAttribute('data-tab'));
        });
    });
}

// タブ切り替え
function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
    document.getElementById(tabName).classList.add('active');
    document.querySelector('[data-tab="' + tabName + '"]').classList.add('active');

    if (tabName === 'calendar') renderCalendar();
}

// =============================
// メディアアップロード（画像・動画）
// =============================

function setupMediaUpload() {
    const mediaUploadInput = document.getElementById('mediaUpload');
    const uploadBox = document.querySelector('.upload-box');

    mediaUploadInput.addEventListener('change', handleMediaUpload);

    uploadBox.addEventListener('dragover', function(e) {
        e.preventDefault();
        uploadBox.style.borderColor = '#764ba2';
        uploadBox.style.background = '#f0f1ff';
    });

    uploadBox.addEventListener('dragleave', function(e) {
        e.preventDefault();
        uploadBox.style.borderColor = '#667eea';
        uploadBox.style.background = '#f8f9ff';
    });

    uploadBox.addEventListener('drop', function(e) {
        e.preventDefault();
        uploadBox.style.borderColor = '#667eea';
        uploadBox.style.background = '#f8f9ff';
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
            readFileAsDataURL(file, 'image');
        } else if (file.type.startsWith('video/')) {
            readFileAsDataURL(file, 'video');
        }
    }
}

function readFileAsDataURL(file, mediaType) {
    const reader = new FileReader();
    reader.onload = function(e) {
        showPreview(e.target.result, mediaType);
    };
    reader.readAsDataURL(file);
}

// プレビューを表示
function showPreview(mediaData, mediaType) {
    const previewArea = document.getElementById('previewArea');
    const previewImage = document.getElementById('previewImage');
    const previewVideo = document.getElementById('previewVideo');
    const previewMessage = document.getElementById('previewMessage');
    const nowButton = document.getElementById('nowButton');
    const cancelButton = document.getElementById('cancelButton');

    // 入力欄をリセット
    document.getElementById('photoComment').value = '';
    document.getElementById('photoHashtags').value = '';

    // 画像・動画の表示切り替え
    if (mediaType === 'video') {
        previewImage.classList.add('hidden');
        previewVideo.classList.remove('hidden');
        previewVideo.src = mediaData;
        previewMessage.textContent = '「Now」ボタンを押すと、今の日付と時刻と共に保存されます（動画はデバイスに保存されます）';
    } else {
        previewVideo.classList.add('hidden');
        previewVideo.src = '';
        previewImage.classList.remove('hidden');
        previewImage.src = mediaData;
        previewMessage.textContent = '「Now」ボタンを押すと、今の日付と時刻と共に保存されます';
    }

    previewArea.classList.remove('hidden');

    // イベントリスナーを付け替え
    nowButton.replaceWith(nowButton.cloneNode(true));
    cancelButton.replaceWith(cancelButton.cloneNode(true));

    const newNowButton = document.getElementById('nowButton');
    const newCancelButton = document.getElementById('cancelButton');

    newNowButton.addEventListener('click', handleNowButtonClick);
    newCancelButton.addEventListener('click', handleCancelButtonClick);

    newNowButton.addEventListener('touchend', function(e) {
        e.preventDefault();
        handleNowButtonClick.call(this, e);
    });
    newCancelButton.addEventListener('touchend', function(e) {
        e.preventDefault();
        handleCancelButtonClick.call(this, e);
    });

    window.currentMediaData = mediaData;
    window.currentMediaType = mediaType;
}

// Nowボタン処理
function handleNowButtonClick(e) {
    try {
        if (e && e.preventDefault) e.preventDefault();
        if (e && e.stopPropagation) e.stopPropagation();

        if (window.currentMediaData) {
            const comment = document.getElementById('photoComment').value.trim();
            const hashtagRaw = document.getElementById('photoHashtags').value.trim();
            const hashtags = hashtagRaw
                ? hashtagRaw.split(/\s+/).map(tag => tag.startsWith('#') ? tag : '#' + tag)
                : [];

            saveMediaWithTimestamp(window.currentMediaData, window.currentMediaType, comment, hashtags);

            setTimeout(() => {
                document.getElementById('previewArea').classList.add('hidden');
                document.getElementById('mediaUpload').value = '';
                document.getElementById('photoComment').value = '';
                document.getElementById('photoHashtags').value = '';
                document.getElementById('previewVideo').src = '';
                window.currentMediaData = null;
                window.currentMediaType = null;
            }, 500);
        }
    } catch (error) {
        console.error('Nowボタンクリック時のエラー:', error);
    }
}

// キャンセルボタン処理
function handleCancelButtonClick(e) {
    if (e && e.preventDefault) e.preventDefault();
    e.stopPropagation();

    document.getElementById('previewArea').classList.add('hidden');
    document.getElementById('mediaUpload').value = '';
    document.getElementById('photoComment').value = '';
    document.getElementById('photoHashtags').value = '';
    document.getElementById('previewVideo').src = '';
    window.currentMediaData = null;
    window.currentMediaType = null;
}

// メディアをタイムスタンプ付きで保存
function saveMediaWithTimestamp(mediaData, mediaType, comment = '', hashtags = []) {
    try {
        const now = new Date();
        const timestamp = formatDateTime(now);

        const mediaObj = {
            image: mediaType === 'image' ? mediaData : null,
            video: mediaType === 'video' ? mediaData : null,
            mediaType: mediaType,
            timestamp: timestamp,
            date: now.toISOString(),
            userId: getUserId(),
            comment: comment,
            hashtags: hashtags
        };

        // 動画はサイズが大きいのでFirebaseには画像のみ保存
        if (mediaType === 'image') {
            savePhotoToFirebase(mediaObj);
        } else {
            // 動画はIndexedDBのみに保存
            savePhotoToIndexedDB(mediaObj);
            console.log('動画はデバイスのみに保存されます（Firebaseには保存されません）');
        }

        savePhotoToLocalStorageMeta(mediaObj); // メタ情報のみlocalStorageへ
        addMediaToGallery(mediaObj);
        updatePhotoDatesMap(mediaObj);

        console.log('保存完了');
    } catch (error) {
        console.error('saveMediaWithTimestampエラー:', error);
    }
}

// localStorageにはメタ情報のみ保存（動画データ本体はIndexedDB）
function savePhotoToLocalStorageMeta(mediaObj) {
    try {
        let photos = JSON.parse(localStorage.getItem('photos')) || [];
        const exists = photos.some(p => p.date === mediaObj.date);
        if (!exists) {
            // 画像はそのまま、動画はデータなしでメタのみ
            const meta = {
                timestamp: mediaObj.timestamp,
                date: mediaObj.date,
                userId: mediaObj.userId,
                comment: mediaObj.comment,
                hashtags: mediaObj.hashtags,
                mediaType: mediaObj.mediaType,
                image: mediaObj.mediaType === 'image' ? mediaObj.image : null,
                video: null  // 動画データは入れない（IndexedDBから取得）
            };
            photos.push(meta);
            localStorage.setItem('photos', JSON.stringify(photos));
        }
    } catch (error) {
        console.warn('localStorage保存スキップ:', error.message);
    }
}

// 日付時刻をフォーマット
function formatDateTime(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return year + '年' + month + '月' + day + '日 ' + hours + ':' + minutes;
}

// 画像を圧縮
function compressImage(imageData, quality = 0.6) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            let width = img.width;
            let height = img.height;
            const maxWidth = 1200;
            if (width > maxWidth) {
                height = (height * maxWidth) / width;
                width = maxWidth;
            }
            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.src = imageData;
    });
}

// Firebaseに画像を保存（動画は保存しない）
function savePhotoToFirebase(mediaObj) {
    if (!firebaseInitialized || !db) return;

    compressImage(mediaObj.image, 0.6).then((compressedImage) => {
        const firestoreData = {
            timestamp: mediaObj.timestamp,
            date: mediaObj.date,
            userId: mediaObj.userId,
            image: compressedImage,
            mediaType: 'image',
            comment: mediaObj.comment || '',
            hashtags: mediaObj.hashtags || []
        };

        db.collection('memories').add(firestoreData)
            .then(docRef => console.log('Firestoreに保存しました:', docRef.id))
            .catch(error => console.error('Firestore保存エラー:', error));
    });
}

// Firebaseから読み込む
function loadPhotosFromFirebase() {
    if (!firebaseInitialized || !db) {
        loadPhotosFromIndexedDB().then((media) => {
            media.reverse();
            media.forEach(m => { if (m.image || m.video) { addMediaToGallery(m); updatePhotoDatesMap(m); } });
            renderCalendar();
        });
        return;
    }

    db.collection('memories')
        .orderBy('date', 'desc')
        .onSnapshot((snapshot) => {
            const photoGallery = document.getElementById('photoGallery');
            photoGallery.innerHTML = '';
            photoDatesMap = {};

            // Firebaseの画像を先に表示
            snapshot.forEach((doc) => {
                const data = doc.data();
                data.firebaseId = doc.id;
                if (data.image) {
                    addMediaToGallery(data);
                    updatePhotoDatesMap(data);
                }
            });

            // IndexedDBの動画も追加（重複しないように）
            loadPhotosFromIndexedDB().then((localMedia) => {
                localMedia.forEach(m => {
                    if (m.mediaType === 'video' && m.video) {
                        addMediaToGallery(m);
                        updatePhotoDatesMap(m);
                    }
                });
                renderCalendar();
            });

            const searchInput = document.getElementById('hashtagSearchInput');
            if (searchInput && searchInput.value.trim()) {
                filterGalleryByHashtag(searchInput.value.trim());
            }
        },
        (error) => {
            console.error('Firebaseから読み込む際にエラー:', error);
            loadPhotosFromIndexedDB().then((media) => {
                media.reverse();
                media.forEach(m => { if (m.image || m.video) { addMediaToGallery(m); updatePhotoDatesMap(m); } });
                renderCalendar();
            });
        });
}

// ギャラリーにメディアを追加
function addMediaToGallery(mediaObj) {
    const photoGallery = document.getElementById('photoGallery');
    const uid = mediaObj.firebaseId || mediaObj.date;

    if (document.querySelector('[data-firebase-id="' + uid + '"]')) return;

    const item = document.createElement('div');
    item.className = 'photo-item';
    item.setAttribute('data-firebase-id', uid);

    if (mediaObj.hashtags && mediaObj.hashtags.length > 0) {
        item.setAttribute('data-hashtags', mediaObj.hashtags.join(' '));
    }

    if (mediaObj.mediaType === 'video') {
        // 動画サムネイル
        const video = document.createElement('video');
        video.src = mediaObj.video;
        video.className = 'gallery-video';
        video.muted = true;
        video.preload = 'metadata';

        // 再生アイコンオーバーレイ
        const playOverlay = document.createElement('div');
        playOverlay.className = 'play-overlay';
        playOverlay.innerHTML = '▶';

        item.appendChild(video);
        item.appendChild(playOverlay);
    } else {
        // 画像
        const img = document.createElement('img');
        img.src = mediaObj.image;
        item.appendChild(img);
    }

    // タイムスタンプ
    const timestampLabel = document.createElement('div');
    timestampLabel.className = 'timestamp-label';
    timestampLabel.textContent = mediaObj.timestamp;
    item.appendChild(timestampLabel);

    // ハッシュタグラベル
    if (mediaObj.hashtags && mediaObj.hashtags.length > 0) {
        const hashtagLabel = document.createElement('div');
        hashtagLabel.className = 'hashtag-label';
        hashtagLabel.textContent = mediaObj.hashtags.join(' ');
        item.appendChild(hashtagLabel);
    }

    // 削除ボタン
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.innerHTML = '×';
    deleteBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        item.remove();
        if (mediaObj.firebaseId) removePhotoFromFirebase(mediaObj.firebaseId);
        removePhotoFromIndexedDB(mediaObj.date);
        removePhotoFromLocalStorage(mediaObj);
    });
    item.appendChild(deleteBtn);

    // クリックでモーダル表示
    item.addEventListener('click', function() {
        showMediaModal(mediaObj);
    });

    photoGallery.appendChild(item);
}

// モーダルを表示
function showMediaModal(mediaObj) {
    const modal = document.getElementById('photoModal');
    const modalImage = document.getElementById('modalImage');
    const modalVideo = document.getElementById('modalVideo');
    const modalDate = document.getElementById('modalDate');
    const modalComment = document.getElementById('modalComment');
    const modalHashtags = document.getElementById('modalHashtags');

    window.currentPhotoData = mediaObj;

    // 画像・動画の切り替え
    if (mediaObj.mediaType === 'video') {
        modalImage.classList.add('hidden');
        modalImage.src = '';
        modalVideo.classList.remove('hidden');
        modalVideo.src = mediaObj.video;
    } else {
        modalVideo.classList.add('hidden');
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
            span.addEventListener('click', function() {
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

// 写真・動画を削除
function deletePhoto(mediaObj) {
    if (mediaObj.firebaseId) removePhotoFromFirebase(mediaObj.firebaseId);
    removePhotoFromIndexedDB(mediaObj.date);
    removePhotoFromLocalStorage(mediaObj);

    const item = document.querySelector('[data-firebase-id="' + (mediaObj.firebaseId || mediaObj.date) + '"]');
    if (item) item.remove();
}

// Firebaseから削除
function removePhotoFromFirebase(firebaseId) {
    if (!firebaseInitialized || !db) return;
    db.collection('memories').doc(firebaseId).delete()
        .then(() => console.log('Firebaseから削除しました'))
        .catch(error => console.error('Firebaseからの削除に失敗:', error));
}

// ローカルストレージから削除
function removePhotoFromLocalStorage(mediaObj) {
    let photos = JSON.parse(localStorage.getItem('photos')) || [];
    photos = photos.filter(p => p.date !== mediaObj.date);
    localStorage.setItem('photos', JSON.stringify(photos));
}

// 現在の日付を表示
function displayCurrentDate() {
    const dateElement = document.getElementById('currentDate');
    if (!dateElement) return;
    const now = new Date();
    const dayNames = ['日','月','火','水','木','金','土'];
    dateElement.textContent = now.getFullYear() + '年' +
        String(now.getMonth() + 1).padStart(2, '0') + '月' +
        String(now.getDate()).padStart(2, '0') + '日（' +
        dayNames[now.getDay()] + '）';
}

// 天気を表示（Open-Meteo API使用）
function displayWeather() {
    const weatherTempElement = document.getElementById('weatherTemp');
    const weatherDescElement = document.getElementById('weatherDesc');
    if (!weatherTempElement || !weatherDescElement) return;

    const apiUrl = 'https://api.open-meteo.com/v1/forecast?latitude=33.5904&longitude=130.4017&current=temperature_2m,weather_code&timezone=Asia/Tokyo';

    fetch(apiUrl)
        .then(r => r.json())
        .then(data => {
            const temp = Math.round(data.current.temperature_2m);
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
            weatherTempElement.textContent = temp + '°C';
            weatherDescElement.textContent = descriptions[data.current.weather_code] || '不明';
        })
        .catch(() => {
            weatherTempElement.textContent = '--';
            weatherDescElement.textContent = '天気情報を取得できません';
        });
}