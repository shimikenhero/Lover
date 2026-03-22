// ページ読み込み時の初期化
document.addEventListener('DOMContentLoaded', function() {
    initializePage();
    calculateRelationshipDays();
    setupTabNavigation();
    setupImageUpload();
    loadPhotosFromStorage();
});

// ページ初期化
function initializePage() {
    // ゆっくり出てくる演出は CSS の animation で実装済み
    console.log('ページが読み込まれました');
}

// 交際期間の日数を計算
function calculateRelationshipDays() {
    const startDate = new Date('2025-11-09');
    const today = new Date();
    
    // 時間をリセットして日数を正確に計算
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
    // すべてのタブコンテンツを非表示
    const tabContents = document.querySelectorAll('.tab-content');
    tabContents.forEach(content => {
        content.classList.remove('active');
    });
    
    // すべてのタブボタンをインアクティブ
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
        button.classList.remove('active');
    });
    
    // 選択されたタブを表示
    document.getElementById(tabName).classList.add('active');
    
    // 選択されたボタンをアクティブに
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
}

// 画像アップロード設定
function setupImageUpload() {
    const imageUploadInput = document.getElementById('imageUpload');
    const uploadBox = document.querySelector('.upload-box');
    
    // ファイル入力変更イベント
    imageUploadInput.addEventListener('change', handleImageUpload);
    
    // ドラッグ&ドロップ機能
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
    
    // 前の「Now」ボタンのイベントリスナーを削除
    const newNowButton = nowButton.cloneNode(true);
    nowButton.parentNode.replaceChild(newNowButton, nowButton);
    
    newNowButton.addEventListener('click', function() {
        savePhotoWithTimestamp(imageData);
        previewArea.classList.add('hidden');
        document.getElementById('imageUpload').value = '';
    });
    
    cancelButton.addEventListener('click', function() {
        previewArea.classList.add('hidden');
        document.getElementById('imageUpload').value = '';
    });
}

// ギャラリーに写真を追加
function addPhotoToGallery(photoData) {
    const photoGallery = document.getElementById('photoGallery');
    
    const photoItem = document.createElement('div');
    photoItem.className = 'photo-item';
    
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
        removePhotoFromStorage(photoData);
    });
    
    photoItem.appendChild(img);
    photoItem.appendChild(timestampLabel);
    photoItem.appendChild(deleteBtn);
    photoGallery.appendChild(photoItem);
}

// タイムスタンプ付きで写真を保存
function savePhotoWithTimestamp(imageData) {
    const now = new Date();
    const timestamp = formatDateTime(now);
    
    const photoData = {
        image: imageData,
        timestamp: timestamp,
        date: now.toISOString()
    };
    
    addPhotoToGallery(photoData);
    savePhotoToStorage(photoData);
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

// LocalStorage に写真を保存
function savePhotoToStorage(photoData) {
    let photos = JSON.parse(localStorage.getItem('photos')) || [];
    photos.push(photoData);
    localStorage.setItem('photos', JSON.stringify(photos));
}

// LocalStorage から写真を読み込む
function loadPhotosFromStorage() {
    const photos = JSON.parse(localStorage.getItem('photos')) || [];
    
    photos.forEach(photoData => {
        if (photoData.image) {
            addPhotoToGallery(photoData);
        }
    });
}

// LocalStorage から写真を削除
function removePhotoFromStorage(photoData) {
    let photos = JSON.parse(localStorage.getItem('photos')) || [];
    photos = photos.filter(photo => photo.date !== photoData.date);
    localStorage.setItem('photos', JSON.stringify(photos));
}
