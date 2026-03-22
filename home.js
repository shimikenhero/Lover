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
        
        // 既に初期化されている場合はスキップ
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
    
    // IndexedDBを初期化してからFirebaseから読み込む
    initIndexedDB().then(() => {
        loadPhotosFromFirebase();
    }).catch(() => {
        console.warn('IndexedDB初期化失敗、localStorageから読み込みます');
        loadPhotosFromFirebase();
    });
});

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
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
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
    
    // 古いイベントリスナーを完全に削除
    nowButton.replaceWith(nowButton.cloneNode(true));
    cancelButton.replaceWith(cancelButton.cloneNode(true));
    
    // 新しい参照を取得
    const newNowButton = document.getElementById('nowButton');
    const newCancelButton = document.getElementById('cancelButton');
    
    // イベントリスナーを登録
    newNowButton.addEventListener('click', handleNowButtonClick);
    newCancelButton.addEventListener('click', handleCancelButtonClick);
    
    // スマホのタッチイベントにも対応
    newNowButton.addEventListener('touchend', function(e) {
        e.preventDefault();
        handleNowButtonClick.call(this, e);
    });
    newCancelButton.addEventListener('touchend', function(e) {
        e.preventDefault();
        handleCancelButtonClick.call(this, e);
    });
    
    // グローバル変数に保存して関数内でアクセス
    window.currentImageData = imageData;
}

// Nowボタンクリック処理
function handleNowButtonClick(e) {
    try {
        if (e && e.preventDefault) {
            e.preventDefault();
        }
        if (e && e.stopPropagation) {
            e.stopPropagation();
        }
        
        console.log('Nowボタンがクリックされました');
        console.log('currentImageData:', window.currentImageData ? '存在' : '存在しません');
        
        if (window.currentImageData) {
            console.log('savePhotoWithTimestampを実行中...');
            savePhotoWithTimestamp(window.currentImageData);
            
            setTimeout(() => {
                document.getElementById('previewArea').classList.add('hidden');
                document.getElementById('imageUpload').value = '';
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
    if (e && e.preventDefault) {
        e.preventDefault();
    }
    e.stopPropagation();
    
    console.log('キャンセルボタンがクリックされました');
    
    document.getElementById('previewArea').classList.add('hidden');
    document.getElementById('imageUpload').value = '';
    window.currentImageData = null;
}

// タイムスタンプ付きで写真を保存
function savePhotoWithTimestamp(imageData) {
    try {
        console.log('savePhotoWithTimestamp開始');
        const now = new Date();
        const timestamp = formatDateTime(now);
        
        const photoData = {
            image: imageData,
            timestamp: timestamp,
            date: now.toISOString(),
            userId: getUserId()
        };
        
        console.log('photoData作成完了:', photoData.timestamp);
        
        savePhotoToFirebase(photoData);
        savePhotoToLocalStorage(photoData);
        addPhotoToGallery(photoData);
        
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
    
    return `${year}年${month}月${day}日 ${hours}:${minutes}`;
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
    
    // 画像を圧縮
    compressImage(photoData.image, 0.6).then((compressedImage) => {
        const firestoreData = {
            timestamp: photoData.timestamp,
            date: photoData.date,
            userId: photoData.userId,
            image: compressedImage
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
                }
            });
        });
        return;
    }
    
    db.collection('memories')
        .orderBy('date', 'desc')
        .onSnapshot((snapshot) => {
            const photoGallery = document.getElementById('photoGallery');
            photoGallery.innerHTML = '';
            
            snapshot.forEach((doc) => {
                const photoData = doc.data();
                photoData.firebaseId = doc.id;
                
                // Firestoreから直接圧縮画像データを取得
                if (photoData.image) {
                    addPhotoToGallery(photoData);
                }
            });
        },
        (error) => {
            console.error('Firebaseから読み込む際にエラー:', error);
            loadPhotosFromIndexedDB().then((photos) => {
                photos.reverse();
                photos.forEach(photoData => {
                    if (photoData.image) {
                        addPhotoToGallery(photoData);
                    }
                });
            });
        });
}

// ローカルストレージから写真を読み込む
function loadPhotosFromLocalStorage() {
    const photos = JSON.parse(localStorage.getItem('photos')) || [];
    
    photos.forEach(photoData => {
        if (photoData.image) {
            addPhotoToGallery(photoData);
        }
    });
}

// ギャラリーに写真を追加
function addPhotoToGallery(photoData) {
    const photoGallery = document.getElementById('photoGallery');
    
    if (document.querySelector(`[data-firebase-id="${photoData.firebaseId}"]`)) {
        return;
    }
    
    const photoItem = document.createElement('div');
    photoItem.className = 'photo-item';
    photoItem.setAttribute('data-firebase-id', photoData.firebaseId || photoData.date);
    
    const img = document.createElement('img');
    img.src = photoData.image;
    
    const timestampLabel = document.createElement('div');
    timestampLabel.className = 'timestamp-label';
    timestampLabel.textContent = photoData.timestamp;
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.innerHTML = '×';
    deleteBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        photoItem.remove();
        
        if (photoData.firebaseId) {
            removePhotoFromFirebase(photoData.firebaseId);
        }
        removePhotoFromIndexedDB(photoData.date);
        removePhotoFromLocalStorage(photoData);
    });
    
    photoItem.appendChild(img);
    photoItem.appendChild(timestampLabel);
    photoItem.appendChild(deleteBtn);
    photoGallery.appendChild(photoItem);
}

// Firebaseから写真を削除
function removePhotoFromFirebase(firebaseId) {
    if (!firebaseInitialized || !db) {
        return;
    }
    
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
