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

if (typeof firebase !== 'undefined') {
    try {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        firebaseInitialized = true;
        console.log('Firebaseが初期化されました');
    } catch (error) {
        console.error('Firebase初期化エラー:', error);
        alert('Firebaseの接続に失敗しました。ローカルモードで動作します。');
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

// ページ読み込み時の初期化
document.addEventListener('DOMContentLoaded', function() {
    initializePage();
    calculateRelationshipDays();
    setupTabNavigation();
    setupImageUpload();
    loadPhotosFromFirebase();
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
    if (e && e.preventDefault) {
        e.preventDefault();
    }
    e.stopPropagation();
    
    console.log('Nowボタンがクリックされました');
    
    if (window.currentImageData) {
        savePhotoWithTimestamp(window.currentImageData);
        document.getElementById('previewArea').classList.add('hidden');
        document.getElementById('imageUpload').value = '';
        window.currentImageData = null;
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
    const now = new Date();
    const timestamp = formatDateTime(now);
    
    const photoData = {
        image: imageData,
        timestamp: timestamp,
        date: now.toISOString(),
        userId: getUserId()
    };
    
    savePhotoToFirebase(photoData);
    savePhotoToLocalStorage(photoData);
    addPhotoToGallery(photoData);
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

// Firebaseに写真を保存
function savePhotoToFirebase(photoData) {
    if (!firebaseInitialized || !db) {
        console.log('Firebaseが利用できないため、ローカルのみに保存します');
        return;
    }
    
    db.collection('memories')
        .add(photoData)
        .then((docRef) => {
            console.log('Firebaseに保存しました:', docRef.id);
            photoData.firebaseId = docRef.id;
            savePhotoToLocalStorage(photoData);
        })
        .catch((error) => {
            console.error('Firebaseへの保存に失敗:', error);
            console.log('ローカルストレージに保存されています');
        });
}

// ローカルストレージに写真を保存
function savePhotoToLocalStorage(photoData) {
    let photos = JSON.parse(localStorage.getItem('photos')) || [];
    const exists = photos.some(p => p.date === photoData.date);
    if (!exists) {
        photos.push(photoData);
        localStorage.setItem('photos', JSON.stringify(photos));
    }
}

// Firebaseから写真を読み込む
function loadPhotosFromFirebase() {
    if (!firebaseInitialized || !db) {
        console.log('Firebaseが利用できないため、ローカルストレージから読み込みます');
        loadPhotosFromLocalStorage();
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
                addPhotoToGallery(photoData);
            });
        },
        (error) => {
            console.error('Firebaseから読み込む際にエラー:', error);
            loadPhotosFromLocalStorage();
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
