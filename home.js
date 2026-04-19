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

// IndexedDBに写真を保存
function savePhotoToIndexedDB(photoData) {
    if (!db_indexed) {
        console.log('IndexedDBが初期化されていません');
        return Promise.resolve();
    }

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

// IndexedDBから写真を読み込む
function loadPhotosFromIndexedDB() {
    if (!db_indexed) {
        console.log('IndexedDBが初期化されていません');
        return Promise.resolve([]);
    }

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

// IndexedDBから写真を削除
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
    setupImageUpload();
    setupModalEvents();
    setupHashtagSearch();
    setupCalendar();
    displayCurrentDate();
    displayWeather();

    initIndexedDB().then(() => {
        loadPhotosFromFirebase();
    }).catch(() => {
        console.warn('IndexedDB初期化失敗、localStorageから読み込みます');
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
        console.log('×ボタンクリック');
        modal.classList.add('hidden');
    });

    modal.addEventListener('click', function(e) {
        if (e.target === this) {
            console.log('背景クリック');
            modal.classList.add('hidden');
        }
    });

    modalDeleteBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('削除ボタンクリック');

        if (window.currentPhotoData) {
            deletePhoto(window.currentPhotoData);
            modal.classList.add('hidden');
        }
    });
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
        if (query.length > 0) {
            clearBtn.classList.remove('hidden');
        } else {
            clearBtn.classList.add('hidden');
        }
        filterGalleryByHashtag(query);
    });

    clearBtn.addEventListener('click', function() {
        searchInput.value = '';
        clearBtn.classList.add('hidden');
        filterGalleryByHashtag('');
        searchInput.focus();
    });

    searchInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            filterGalleryByHashtag(this.value.trim());
        }
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
            const tags = item.getAttribute('data-hashtags') || '';
            const normalizedTags = tags.toLowerCase();

            if (normalizedTags.includes(normalizedQuery)) {
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
            resultInfo.textContent = '「#' + normalizedQuery + '」の写真は見つかりませんでした';
            resultInfo.className = 'search-result-info no-result';
        } else {
            resultInfo.textContent = '「#' + normalizedQuery + '」の写真が ' + visibleCount + ' 件見つかりました';
            resultInfo.className = 'search-result-info has-result';
        }
    }
}

// =============================
// カレンダー機能
// =============================

// カレンダーの状態
const calendarState = {
    view: 'month',   // 'month' or 'year'
    year: new Date().getFullYear(),
    month: new Date().getMonth()  // 0-11
};

// 写真データのキャッシュ（日付 → 写真リスト）
let photoDatesMap = {};

function setupCalendar() {
    const viewSelect = document.getElementById('calendarViewSelect');
    const prevBtn = document.getElementById('calPrev');
    const nextBtn = document.getElementById('calNext');

    if (!viewSelect) return;

    // プルダウン切り替え
    viewSelect.addEventListener('change', function() {
        calendarState.view = this.value;
        renderCalendar();
    });

    // 前へボタン
    prevBtn.addEventListener('click', function() {
        if (calendarState.view === 'month') {
            calendarState.month--;
            if (calendarState.month < 0) {
                calendarState.month = 11;
                calendarState.year--;
            }
        } else {
            calendarState.year--;
        }
        renderCalendar();
    });

    // 次へボタン
    nextBtn.addEventListener('click', function() {
        if (calendarState.view === 'month') {
            calendarState.month++;
            if (calendarState.month > 11) {
                calendarState.month = 0;
                calendarState.year++;
            }
        } else {
            calendarState.year++;
        }
        renderCalendar();
    });

    renderCalendar();
}

// カレンダーを描画
function renderCalendar() {
    if (calendarState.view === 'month') {
        renderMonthCalendar();
    } else {
        renderYearCalendar();
    }
}

// タイトルを更新
function updateCalendarTitle() {
    const titleEl = document.getElementById('calendarTitle');
    if (calendarState.view === 'month') {
        const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月',
                            '7月', '8月', '9月', '10月', '11月', '12月'];
        titleEl.textContent = calendarState.year + '年 ' + monthNames[calendarState.month];
    } else {
        titleEl.textContent = calendarState.year + '年';
    }
}

// 月カレンダーを描画
function renderMonthCalendar() {
    updateCalendarTitle();
    const body = document.getElementById('calendarBody');
    body.innerHTML = '';

    const year = calendarState.year;
    const month = calendarState.month;

    // カレンダーテーブル
    const table = document.createElement('table');
    table.className = 'calendar-table';

    // 曜日ヘッダー
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
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

    // 日付セル
    const tbody = document.createElement('tbody');
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();

    let day = 1;
    for (let row = 0; row < 6; row++) {
        const tr = document.createElement('tr');
        for (let col = 0; col < 7; col++) {
            const td = document.createElement('td');

            if (row === 0 && col < firstDay) {
                td.className = 'empty';
            } else if (day > daysInMonth) {
                td.className = 'empty';
            } else {
                const dateKey = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
                const photos = photoDatesMap[dateKey] || [];

                td.className = 'calendar-day';
                if (col === 0) td.classList.add('sunday');
                if (col === 6) td.classList.add('saturday');

                // 今日をハイライト
                if (year === today.getFullYear() && month === today.getMonth() && day === today.getDate()) {
                    td.classList.add('today');
                }

                // 日付番号
                const dayNum = document.createElement('span');
                dayNum.className = 'day-number';
                dayNum.textContent = day;
                td.appendChild(dayNum);

                // 写真がある日にドット表示
                if (photos.length > 0) {
                    const dot = document.createElement('span');
                    dot.className = 'photo-dot';
                    dot.textContent = '📷';
                    dot.title = photos.length + '枚の写真';
                    td.appendChild(dot);

                    // クリックで思い出フォルダーへ
                    td.classList.add('has-photo');
                    td.addEventListener('click', function() {
                        switchTab('memories');
                    });
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

// 年カレンダーを描画
function renderYearCalendar() {
    updateCalendarTitle();
    const body = document.getElementById('calendarBody');
    body.innerHTML = '';

    const year = calendarState.year;
    const today = new Date();
    const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月',
                        '7月', '8月', '9月', '10月', '11月', '12月'];

    const grid = document.createElement('div');
    grid.className = 'year-grid';

    for (let m = 0; m < 12; m++) {
        const monthCard = document.createElement('div');
        monthCard.className = 'month-card';

        // 月タイトル（クリックで月表示に切り替え）
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

        // ミニカレンダー
        const miniTable = document.createElement('table');
        miniTable.className = 'mini-calendar';

        // 曜日ヘッダー
        const miniThead = document.createElement('thead');
        const miniHeaderRow = document.createElement('tr');
        ['日', '月', '火', '水', '木', '金', '土'].forEach((d, i) => {
            const th = document.createElement('th');
            th.textContent = d;
            if (i === 0) th.className = 'sunday';
            if (i === 6) th.className = 'saturday';
            miniHeaderRow.appendChild(th);
        });
        miniThead.appendChild(miniHeaderRow);
        miniTable.appendChild(miniThead);

        // 日付
        const miniTbody = document.createElement('tbody');
        const firstDay = new Date(year, m, 1).getDay();
        const daysInMonth = new Date(year, m + 1, 0).getDate();

        let day = 1;
        for (let row = 0; row < 6; row++) {
            const tr = document.createElement('tr');
            for (let col = 0; col < 7; col++) {
                const td = document.createElement('td');

                if (row === 0 && col < firstDay) {
                    td.className = 'empty';
                } else if (day > daysInMonth) {
                    td.className = 'empty';
                } else {
                    const dateKey = year + '-' + String(m + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
                    const photos = photoDatesMap[dateKey] || [];

                    if (col === 0) td.className = 'sunday';
                    if (col === 6) td.className = 'saturday';

                    // 今日をハイライト
                    if (year === today.getFullYear() && m === today.getMonth() && day === today.getDate()) {
                        td.classList.add('today');
                    }

                    td.textContent = day;

                    // 写真がある日にドット
                    if (photos.length > 0) {
                        td.classList.add('has-photo');
                        td.title = photos.length + '枚の写真';
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

// Firebaseから写真を読み込んだときにカレンダー用マップを更新
function updatePhotoDatesMap(photoData) {
    if (!photoData.date) return;
    const d = new Date(photoData.date);
    const key = d.getFullYear() + '-' +
                String(d.getMonth() + 1).padStart(2, '0') + '-' +
                String(d.getDate()).padStart(2, '0');
    if (!photoDatesMap[key]) {
        photoDatesMap[key] = [];
    }
    photoDatesMap[key].push(photoData);
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

    const dayCountElement = document.getElementById('dayCount');
    dayCountElement.textContent = daysDifference;
}

// タブナビゲーション設定
function setupTabNavigation() {
    const tabButtons = document.querySelectorAll('.tab-button');

    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            switchTab(tabName);
        });
    });
}

// タブ切り替え
function switchTab(tabName) {
    const tabContents = document.querySelectorAll('.tab-content');
    tabContents.forEach(content => {
        content.classList.remove('active');
    });

    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
        button.classList.remove('active');
    });

    document.getElementById(tabName).classList.add('active');
    document.querySelector('[data-tab="' + tabName + '"]').classList.add('active');

    // カレンダータブを開いたら再描画
    if (tabName === 'calendar') {
        renderCalendar();
    }
}

// 画像アップロード設定
function setupImageUpload() {
    const imageUploadInput = document.getElementById('imageUpload');
    const uploadBox = document.querySelector('.upload-box');

    imageUploadInput.addEventListener('change', handleImageUpload);

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

        const files = e.dataTransfer.files;
        handleFiles(files);
    });
}

// 画像ファイル処理
function handleImageUpload(e) {
    const files = e.target.files;
    handleFiles(files);
}

// ファイル処理
function handleFiles(files) {
    for (let i = 0; i < files.length; i++) {
        if (files[i].type.startsWith('image/')) {
            const reader = new FileReader();

            reader.onload = function(e) {
                const imageData = e.target.result;
                showPreview(imageData);
            };

            reader.readAsDataURL(files[i]);
        }
    }
}

// プレビューを表示
function showPreview(imageData) {
    const previewArea = document.getElementById('previewArea');
    const previewImage = document.getElementById('previewImage');
    const previewMessage = document.getElementById('previewMessage');
    const nowButton = document.getElementById('nowButton');
    const cancelButton = document.getElementById('cancelButton');

    previewImage.src = imageData;
    previewArea.classList.remove('hidden');
    previewMessage.textContent = '「Now」ボタンを押すと、今の日付と時刻と共に保存されます';

    document.getElementById('photoComment').value = '';
    document.getElementById('photoHashtags').value = '';

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

    window.currentImageData = imageData;
}

// Nowボタンクリック処理
function handleNowButtonClick(e) {
    try {
        if (e && e.preventDefault) e.preventDefault();
        if (e && e.stopPropagation) e.stopPropagation();

        console.log('Nowボタンがクリックされました');

        if (window.currentImageData) {
            const comment = document.getElementById('photoComment').value.trim();
            const hashtagRaw = document.getElementById('photoHashtags').value.trim();
            const hashtags = hashtagRaw
                ? hashtagRaw.split(/\s+/).map(tag => tag.startsWith('#') ? tag : '#' + tag)
                : [];

            savePhotoWithTimestamp(window.currentImageData, comment, hashtags);

            setTimeout(() => {
                document.getElementById('previewArea').classList.add('hidden');
                document.getElementById('imageUpload').value = '';
                document.getElementById('photoComment').value = '';
                document.getElementById('photoHashtags').value = '';
                window.currentImageData = null;
                console.log('処理完了');
            }, 500);
        } else {
            console.error('currentImageDataが空です');
        }
    } catch (error) {
        console.error('Nowボタンクリック時のエラー:', error);
    }
}

// キャンセルボタンクリック処理
function handleCancelButtonClick(e) {
    if (e && e.preventDefault) e.preventDefault();
    e.stopPropagation();

    console.log('キャンセルボタンがクリックされました');

    document.getElementById('previewArea').classList.add('hidden');
    document.getElementById('imageUpload').value = '';
    document.getElementById('photoComment').value = '';
    document.getElementById('photoHashtags').value = '';
    window.currentImageData = null;
}

// タイムスタンプ付きで写真を保存
function savePhotoWithTimestamp(imageData, comment = '', hashtags = []) {
    try {
        console.log('savePhotoWithTimestamp開始');
        const now = new Date();
        const timestamp = formatDateTime(now);

        const photoData = {
            image: imageData,
            timestamp: timestamp,
            date: now.toISOString(),
            userId: getUserId(),
            comment: comment,
            hashtags: hashtags
        };

        console.log('photoData作成完了:', photoData.timestamp);

        savePhotoToFirebase(photoData);
        savePhotoToLocalStorage(photoData);
        addPhotoToGallery(photoData);
        updatePhotoDatesMap(photoData);

        console.log('保存完了');
    } catch (error) {
        console.error('savePhotoWithTimestampエラー:', error);
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

            const compressedData = canvas.toDataURL('image/jpeg', quality);
            console.log('画像圧縮完了:', Math.round(imageData.length / 1024), 'KB →', Math.round(compressedData.length / 1024), 'KB');
            resolve(compressedData);
        };
        img.src = imageData;
    });
}

// Firebaseに写真を保存
function savePhotoToFirebase(photoData) {
    if (!firebaseInitialized || !db) {
        console.log('Firebaseが利用できないため、ローカルのみに保存します');
        return;
    }

    compressImage(photoData.image, 0.6).then((compressedImage) => {
        const firestoreData = {
            timestamp: photoData.timestamp,
            date: photoData.date,
            userId: photoData.userId,
            image: compressedImage,
            comment: photoData.comment || '',
            hashtags: photoData.hashtags || []
        };

        db.collection('memories')
            .add(firestoreData)
            .then((docRef) => {
                console.log('Firestore（圧縮画像付き）に保存しました:', docRef.id);
            })
            .catch((error) => {
                console.error('Firestore保存エラー:', error);
                console.log('ローカルに保存されています');
            });
    });
}

// ローカルストレージに写真を保存
function savePhotoToLocalStorage(photoData) {
    try {
        let photos = JSON.parse(localStorage.getItem('photos')) || [];
        const exists = photos.some(p => p.date === photoData.date);
        if (!exists) {
            photos.push(photoData);
            localStorage.setItem('photos', JSON.stringify(photos));
        }
    } catch (error) {
        if (error.name === 'QuotaExceededError') {
            console.warn('localStorage容量超過。IndexedDBを使用します。');
            savePhotoToIndexedDB(photoData);
        } else {
            console.error('localStorage保存エラー:', error);
        }
    }
}

// Firebaseから写真を読み込む
function loadPhotosFromFirebase() {
    if (!firebaseInitialized || !db) {
        console.log('Firebaseが利用できないため、IndexedDBから読み込みます');
        loadPhotosFromIndexedDB().then((photos) => {
            photos.reverse();
            photos.forEach(photoData => {
                if (photoData.image) {
                    addPhotoToGallery(photoData);
                    updatePhotoDatesMap(photoData);
                }
            });
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

            snapshot.forEach((doc) => {
                const photoData = doc.data();
                photoData.firebaseId = doc.id;

                if (photoData.image) {
                    addPhotoToGallery(photoData);
                    updatePhotoDatesMap(photoData);
                }
            });

            // カレンダーを再描画
            renderCalendar();

            // 検索中なら再フィルタリング
            const searchInput = document.getElementById('hashtagSearchInput');
            if (searchInput && searchInput.value.trim()) {
                filterGalleryByHashtag(searchInput.value.trim());
            }
        },
        (error) => {
            console.error('Firebaseから読み込む際にエラー:', error);
            loadPhotosFromIndexedDB().then((photos) => {
                photos.reverse();
                photos.forEach(photoData => {
                    if (photoData.image) {
                        addPhotoToGallery(photoData);
                        updatePhotoDatesMap(photoData);
                    }
                });
                renderCalendar();
            });
        });
}

// ローカルストレージから写真を読み込む
function loadPhotosFromLocalStorage() {
    const photos = JSON.parse(localStorage.getItem('photos')) || [];
    photos.forEach(photoData => {
        if (photoData.image) {
            addPhotoToGallery(photoData);
            updatePhotoDatesMap(photoData);
        }
    });
}

// ギャラリーに写真を追加
function addPhotoToGallery(photoData) {
    const photoGallery = document.getElementById('photoGallery');

    if (document.querySelector('[data-firebase-id="' + photoData.firebaseId + '"]')) return;

    const photoItem = document.createElement('div');
    photoItem.className = 'photo-item';
    photoItem.setAttribute('data-firebase-id', photoData.firebaseId || photoData.date);

    if (photoData.hashtags && photoData.hashtags.length > 0) {
        photoItem.setAttribute('data-hashtags', photoData.hashtags.join(' '));
    }

    const img = document.createElement('img');
    img.src = photoData.image;

    const timestampLabel = document.createElement('div');
    timestampLabel.className = 'timestamp-label';
    timestampLabel.textContent = photoData.timestamp;

    if (photoData.hashtags && photoData.hashtags.length > 0) {
        const hashtagLabel = document.createElement('div');
        hashtagLabel.className = 'hashtag-label';
        hashtagLabel.textContent = photoData.hashtags.join(' ');
        photoItem.appendChild(hashtagLabel);
    }

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.innerHTML = '×';
    deleteBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        photoItem.remove();
        if (photoData.firebaseId) removePhotoFromFirebase(photoData.firebaseId);
        removePhotoFromIndexedDB(photoData.date);
        removePhotoFromLocalStorage(photoData);
    });

    photoItem.addEventListener('click', function() {
        showPhotoModal(photoData);
    });

    photoItem.appendChild(img);
    photoItem.appendChild(timestampLabel);
    photoItem.appendChild(deleteBtn);
    photoGallery.appendChild(photoItem);
}

// モーダルを表示
function showPhotoModal(photoData) {
    const modal = document.getElementById('photoModal');
    const modalImage = document.getElementById('modalImage');
    const modalDate = document.getElementById('modalDate');
    const modalComment = document.getElementById('modalComment');
    const modalHashtags = document.getElementById('modalHashtags');

    window.currentPhotoData = photoData;

    modalImage.src = photoData.image;
    modalDate.textContent = photoData.timestamp;

    if (photoData.comment) {
        modalComment.textContent = photoData.comment;
        modalComment.style.display = 'block';
    } else {
        modalComment.style.display = 'none';
    }

    modalHashtags.innerHTML = '';
    if (photoData.hashtags && photoData.hashtags.length > 0) {
        photoData.hashtags.forEach(tag => {
            const span = document.createElement('span');
            span.className = 'modal-hashtag-item';
            span.textContent = tag;

            span.addEventListener('click', function() {
                modal.classList.add('hidden');
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
    console.log('モーダル表示');
}

// 写真を削除
function deletePhoto(photoData) {
    console.log('写真削除開始');

    if (photoData.firebaseId) removePhotoFromFirebase(photoData.firebaseId);
    removePhotoFromIndexedDB(photoData.date);
    removePhotoFromLocalStorage(photoData);

    const photoItem = document.querySelector('[data-firebase-id="' + photoData.firebaseId + '"]');
    if (photoItem) photoItem.remove();

    console.log('写真を削除しました');
}

// Firebaseから写真を削除
function removePhotoFromFirebase(firebaseId) {
    if (!firebaseInitialized || !db) return;

    db.collection('memories')
        .doc(firebaseId)
        .delete()
        .then(() => {
            console.log('Firebaseから削除しました');
        })
        .catch((error) => {
            console.error('Firebaseからの削除に失敗:', error);
        });
}

// ローカルストレージから写真を削除
function removePhotoFromLocalStorage(photoData) {
    let photos = JSON.parse(localStorage.getItem('photos')) || [];
    photos = photos.filter(photo => photo.date !== photoData.date);
    localStorage.setItem('photos', JSON.stringify(photos));
}

// 現在の日付を表示
function displayCurrentDate() {
    const dateElement = document.getElementById('currentDate');
    if (!dateElement) return;

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const date = String(now.getDate()).padStart(2, '0');
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    const day = dayNames[now.getDay()];

    const dateString = year + '年' + month + '月' + date + '日（' + day + '）';
    dateElement.textContent = dateString;
    console.log('日付表示:', dateString);
}

// 天気を表示（Open-Meteo API使用）
function displayWeather() {
    const weatherTempElement = document.getElementById('weatherTemp');
    const weatherDescElement = document.getElementById('weatherDesc');

    if (!weatherTempElement || !weatherDescElement) return;

    const latitude = 33.5904;
    const longitude = 130.4017;
    const apiUrl = 'https://api.open-meteo.com/v1/forecast?latitude=' + latitude + '&longitude=' + longitude + '&current=temperature_2m,weather_code&timezone=Asia/Tokyo';

    console.log('天気API呼び出し:', apiUrl);

    fetch(apiUrl)
        .then(response => response.json())
        .then(data => {
            console.log('APIレスポンス:', data);
            const temp = Math.round(data.current.temperature_2m);
            const weatherCode = data.current.weather_code;
            const weatherDescriptions = {
                0: '晴れ', 1: 'ほぼ晴れ', 2: '一部曇り', 3: '曇り',
                45: '霧', 48: 'むし霧',
                51: 'ほぼ止まない霧雨', 53: '霧雨', 55: '濃い霧雨',
                61: '弱い雨', 63: '雨', 65: '強い雨',
                71: '弱い雪', 73: '雪', 75: '強い雪',
                80: '弱いにわか雨', 81: 'にわか雨', 82: '強いにわか雨',
                85: 'にわか雪', 86: '強いにわか雪',
                95: '雷雨', 96: 'ひょう付き雷雨', 99: 'ひょう付き雷雨'
            };

            const description = weatherDescriptions[weatherCode] || '不明';
            weatherTempElement.textContent = temp + '°C';
            weatherDescElement.textContent = description;

            console.log('福岡の天気情報表示成功:', temp, '°C', description);
        })
        .catch(error => {
            console.error('天気情報取得失敗:', error);
            weatherTempElement.textContent = '--';
            weatherDescElement.textContent = '天気情報を取得できません';
        });
}