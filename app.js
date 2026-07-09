import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, query, where, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 請替換為您的 Firebase 設定
const firebaseConfig = {
  apiKey: "AIzaSyDnc_6lV2A0IBExuJrsH75pYPNY0D8U3zk",
  authDomain: "flashcard-787bc.firebaseapp.com",
  projectId: "flashcard-787bc",
  storageBucket: "flashcard-787bc.firebasestorage.app",
  messagingSenderId: "489419197911",
  appId: "1:489419197911:web:c268a2e499f3f392eecf92"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM 元素
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const mainContent = document.getElementById('main-content');
const addCardForm = document.getElementById('add-card-form');
const container = document.getElementById('flashcards-container');
const showMyCardsBtn = document.getElementById('show-my-cards');
const showPublicCardsBtn = document.getElementById('show-public-cards');

let currentUser = null;
let currentUnsubscribe = null;

// 身分驗證
const provider = new GoogleAuthProvider();
loginBtn.addEventListener('click', () => signInWithPopup(auth, provider));
logoutBtn.addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        loginBtn.classList.add('hidden');
        logoutBtn.classList.remove('hidden');
        mainContent.classList.remove('hidden');
        loadCards(false); // 預設載入自己的卡片
    } else {
        currentUser = null;
        loginBtn.classList.remove('hidden');
        logoutBtn.classList.add('hidden');
        mainContent.classList.add('hidden');
        if (currentUnsubscribe) currentUnsubscribe();
    }
});

// 新增卡片
addCardForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const front = document.getElementById('front-input').value;
    const back = document.getElementById('back-input').value;
    const isPublic = document.getElementById('public-checkbox').checked;

    try {
        await addDoc(collection(db, "flashcards"), {
            front: front,
            back: back,
            uid: currentUser.uid,
            isPublic: isPublic,
            createdAt: new Date()
        });
        addCardForm.reset();
    } catch (error) {
        console.error("Error adding document: ", error);
        alert("新增失敗！");
    }
});

// 切換卡片視角
showMyCardsBtn.addEventListener('click', () => loadCards(false));
showPublicCardsBtn.addEventListener('click', () => loadCards(true));

// 讀取並渲染卡片
function loadCards(showPublic) {
    if (currentUnsubscribe) currentUnsubscribe();

    const q = showPublic 
        ? query(collection(db, "flashcards"), where("isPublic", "==", true))
        : query(collection(db, "flashcards"), where("uid", "==", currentUser.uid));

    currentUnsubscribe = onSnapshot(q, (snapshot) => {
        container.innerHTML = '';
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const id = docSnap.id;
            renderCard(id, data);
        });
    });
}

function renderCard(id, data) {
    const cardDiv = document.createElement('div');
    cardDiv.className = 'flashcard';
    
    // 只有卡片擁有者可以刪除
    const deleteBtnHTML = data.uid === currentUser.uid 
        ? `<button class="delete-btn" data-id="${id}">X</button>` 
        : '';

    cardDiv.innerHTML = `
        <div class="flashcard-inner">
            <div class="flashcard-front">
                ${deleteBtnHTML}
                <h3>${data.front}</h3>
            </div>
            <div class="flashcard-back">
                ${deleteBtnHTML}
                <h3>${data.back}</h3>
            </div>
        </div>
    `;

    // 翻轉邏輯
    cardDiv.querySelector('.flashcard-inner').addEventListener('click', function(e) {
        if(e.target.classList.contains('delete-btn')) return; // 點擊刪除按鈕時不翻轉
        cardDiv.classList.toggle('flipped');
    });

    // 刪除邏輯
    const deleteBtns = cardDiv.querySelectorAll('.delete-btn');
    deleteBtns.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if(confirm("確定要刪除這張卡片嗎？")) {
                await deleteDoc(doc(db, "flashcards", id));
            }
        });
    });

    container.appendChild(cardDiv);
}