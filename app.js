// 引入 Firebase SDK (使用 v10 模組化 CDN 版本)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    signInWithPopup, 
    GoogleAuthProvider, 
    signOut, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    getDocs, 
    doc, 
    deleteDoc, 
    updateDoc, 
    query, 
    where, 
    orderBy 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ==========================================
// ⚠️ 請在這裡替換成您自己的 Firebase 專案設定金鑰 ⚠️
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyDnc_6lV2A0IBExuJrsH75pYPNY0D8U3zk",
  authDomain: "flashcard-787bc.firebaseapp.com",
  projectId: "flashcard-787bc",
  storageBucket: "flashcard-787bc.firebasestorage.app",
  messagingSenderId: "489419197911",
  appId: "1:489419197911:web:c268a2e499f3f392eecf92"
};

// 初始化 Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// 狀態管理變數
let currentUser = null;
let currentTab = "my"; // 支援值: "my" (我的卡片), "public" (共享卡片)

// DOM 元素選取
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const userInfo = document.getElementById("user-info");
const userName = document.getElementById("user-name");
const welcomeMessage = document.getElementById("welcome-message");
const mainContent = document.getElementById("main-content");
const addCardForm = document.getElementById("add-card-form");
const frontInput = document.getElementById("front-input");
const backInput = document.getElementById("back-input");
const publicCheckbox = document.getElementById("public-checkbox");
const submitBtn = document.getElementById("submit-btn");
const cancelEditBtn = document.getElementById("cancel-edit-btn");
const editCardId = document.getElementById("edit-card-id");
const formTitle = document.getElementById("form-title");
const tabMyCards = document.getElementById("show-my-cards");
const tabPublicCards = document.getElementById("show-public-cards");
const flashcardsContainer = document.getElementById("flashcards-container");

// ==========================================
// 1. 身分驗證邏輯 (Authentication)
// ==========================================

// 監聽用戶登入狀態改變
onAuthStateChanged(auth, (user) => {
    if (user) {
        // 用戶已登入
        currentUser = user;
        userName.textContent = user.displayName || user.email;
        
        loginBtn.classList.add("hidden");
        userInfo.classList.remove("hidden");
        welcomeMessage.classList.add("hidden");
        mainContent.classList.remove("hidden");
        
        // 預設加載「我的卡片」
        switchTab("my");
    } else {
        // 用戶未登入
        currentUser = null;
        loginBtn.classList.remove("hidden");
        userInfo.classList.add("hidden");
        welcomeMessage.classList.remove("hidden");
        mainContent.classList.add("hidden");
        flashcardsContainer.innerHTML = "";
    }
});

// Google 登入事件
loginBtn.addEventListener("click", async () => {
    try {
        await signInWithPopup(auth, provider);
    } catch (error) {
        console.error("登入失敗：", error.message);
        alert("登入過程中發生錯誤，請稍後再試。");
    }
});

// 登出事件
logoutBtn.addEventListener("click", async () => {
    try {
        await signOut(auth);
        resetForm();
    } catch (error) {
        console.error("登出失敗：", error.message);
    }
});

// ==========================================
// 2. 資料庫操作 (Firestore CRUD)
// ==========================================

// 切換分頁
tabMyCards.addEventListener("click", () => switchTab("my"));
tabPublicCards.addEventListener("click", () => switchTab("public"));

function switchTab(tab) {
    currentTab = tab;
    if (tab === "my") {
        tabMyCards.classList.add("active");
        tabPublicCards.classList.remove("active");
    } else {
        tabMyCards.classList.remove("active");
        tabPublicCards.classList.add("active");
    }
    loadFlashcards();
}

// 讀取並渲染卡片
async function loadFlashcards() {
    if (!currentUser) return;
    
    flashcardsContainer.innerHTML = "<p>載入卡片中...</p>";
    
    try {
        let q;
        const colRef = collection(db, "flashcards");
        
        if (currentTab === "my") {
            // 只撈取自己擁有的卡片 (不論是否公開)
            q = query(
                colRef, 
                where("uid", "==", currentUser.uid),
                orderBy("createdAt", "desc")
            );
        } else {
            // 撈取所有標記為 isPublic 且非自己建立的共享卡片 (或者全部共享卡片)
            q = query(
                colRef, 
                where("isPublic", "==", true),
                orderBy("createdAt", "desc")
            );
        }
        
        const querySnapshot = await getDocs(q);
        flashcardsContainer.innerHTML = "";
        
        if (querySnapshot.empty) {
            flashcardsContainer.innerHTML = `<p class="no-cards">目前沒有${currentTab === "my" ? "個人" : "共享"}卡片。立即在左側建立一張吧！</p>`;
            return;
        }
        
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            createCardElement(docSnap.id, data);
        });
    } catch (error) {
        console.error("載入卡片錯誤：", error);
        flashcardsContainer.innerHTML = `<p class="error-msg">讀取卡片失敗，請確認 Firebase Rules 規則是否已部署，或 Console 內是否有錯誤訊。 (Error: ${error.message})</p>`;
    }
}

// 動態建立卡片 DOM 物件
function createCardElement(id, data) {
    const cardWrapper = document.createElement("div");
    cardWrapper.className = "flashcard-wrapper";
    
    const isOwner = data.uid === currentUser.uid;
    
    // Anki 雙面翻轉結構
    cardWrapper.innerHTML = `
        <div class="flashcard" id="card-${id}">
            <!-- 正面 -->
            <div class="card-front">
                ${isOwner ? `
                <div class="card-actions" onclick="event.stopPropagation();">
                    <button class="action-btn edit-btn" data-id="${id}">編輯</button>
                    <button class="action-btn delete-btn" data-id="${id}">刪除</button>
                </div>` : ''}
                <div class="card-hint">FRONT (正面)</div>
                <div class="card-content">${escapeHTML(data.front)}</div>
                <div class="author-badge">${escapeHTML(data.authorName || '匿名')}</div>
            </div>
            <!-- 背面 -->
            <div class="card-back">
                <div class="card-hint">BACK (背面 / 答案)</div>
                <div class="card-content">${escapeHTML(data.back)}</div>
                <div class="author-badge">${escapeHTML(data.authorName || '匿名')}</div>
            </div>
        </div>
    `;
    
    // 點擊卡片觸發 3D 翻轉
    const cardElement = cardWrapper.querySelector(".flashcard");
    cardElement.addEventListener("click", () => {
        cardElement.classList.toggle("flipped");
    });
    
    // 綁定編輯與刪除按鈕事件 (僅當是卡片擁有者時才存在)
    if (isOwner) {
        const editBtn = cardWrapper.querySelector(".edit-btn");
        const deleteBtn = cardWrapper.querySelector(".delete-btn");
        
        editBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            startEdit(id, data);
        });
        
        deleteBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            deleteCard(id);
        });
    }
    
    flashcardsContainer.appendChild(cardWrapper);
}

// 提交表單：新增或編輯卡片
addCardForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    if (!currentUser) {
        alert("請先登入！");
        return;
    }
    
    const front = frontInput.value.trim();
    const back = backInput.value.trim();
    const isPublic = publicCheckbox.checked;
    const cardId = editCardId.value;
    
    try {
        if (cardId) {
            // 修改已有卡片 (Update)
            const cardRef = doc(db, "flashcards", cardId);
            await updateDoc(cardRef, {
                front: front,
                back: back,
                isPublic: isPublic,
                updatedAt: new Date()
            });
            alert("卡片修改成功！");
        } else {
            // 建立全新卡片 (Create)
            await addDoc(collection(db, "flashcards"), {
                front: front,
                back: back,
                isPublic: isPublic,
                uid: currentUser.uid,
                authorName: currentUser.displayName || currentUser.email,
                createdAt: new Date()
            });
            alert("卡片新增成功！");
        }
        
        resetForm();
        loadFlashcards();
    } catch (error) {
        console.error("保存失敗：", error);
        alert("儲存卡片失敗，原因：" + error.message);
    }
});

// 開始編輯模式
function startEdit(id, data) {
    formTitle.textContent = "編輯 Flashcard";
    frontInput.value = data.front;
    backInput.value = data.back;
    publicCheckbox.checked = data.isPublic;
    editCardId.value = id;
    
    submitBtn.textContent = "確認修改";
    cancelEditBtn.classList.remove("hidden");
    
    // 畫面捲動到輸入框
    addCardForm.scrollIntoView({ behavior: 'smooth' });
}

// 取消編輯按鈕
cancelEditBtn.addEventListener("click", resetForm);

function resetForm() {
    formTitle.textContent = "新增 Flashcard (字卡)";
    frontInput.value = "";
    backInput.value = "";
    publicCheckbox.checked = false;
    editCardId.value = "";
    
    submitBtn.textContent = "新增卡片";
    cancelEditBtn.classList.add("hidden");
}

// 刪除卡片邏輯
async function deleteCard(id) {
    if (confirm("您確定要刪除這張卡片嗎？此操作無法還原。")) {
        try {
            await deleteDoc(doc(db, "flashcards", id));
            alert("卡片已刪除！");
            loadFlashcards();
        } catch (error) {
            console.error("刪除失敗：", error);
            alert("刪除失敗：" + error.message);
        }
    }
}

// 預防 XSS 攻擊的安全函數
function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}
