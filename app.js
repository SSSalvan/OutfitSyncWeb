// File: app.js (RECODE DENGAN PERSISTENCE 'SESSION')

// --- Impor Service Firebase ---
import { auth, db, storage } from './firebase-init.js';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  sendEmailVerification,
  GoogleAuthProvider,
  signInWithPopup,
  // --- PERUBAHAN DI SINI ---
  setPersistence,
  browserSessionPersistence // <-- Impor mode 'session'
  // --- AKHIR PERUBAHAN ---
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
  doc, 
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  getDocs 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { 
  ref, 
  getDownloadURL,
  uploadBytes
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
// Impor fungsi 'loadUserData' dari folder utilitas kita
import { loadUserData } from './utils/firestore.js';

// --- Ambil "Slot" dari index.html ---
const appRoot = document.getElementById('app-root');
const sidebarContainer = document.getElementById('sidebar-container');

// Variabel Global
let currentPageStyle = null;
let currentLayoutStyle = null;
let currentPageScript = null;
let currentCleanupFunction = () => {}; 

// ===============================================
// FUNGSI LOADER (HTML, CSS, JS)
// ===============================================

async function loadHtml(path, targetElement) {
  try {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`File ${path} tidak ditemukan`);
    targetElement.innerHTML = await response.text();
  } catch (error) {
    console.error(`Gagal memuat ${path}:`, error);
    targetElement.innerHTML = `<p>Error memuat konten: ${path}</p>`;
  }
}

function loadScript(path, isModule = true) {
  if (currentPageScript) currentPageScript.remove();
  const script = document.createElement('script');
  script.src = path;
  if (isModule) script.type = 'module';
  script.id = 'page-script';
  document.body.appendChild(script);
  currentPageScript = script;
}

function removePageScript() {
  if (currentPageScript) {
    currentPageScript.remove();
    currentPageScript = null;
  }
}

function loadPersistentStyle(path) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = path;
  document.head.appendChild(link);
}

function loadLayoutStyle(layoutName) {
  if (currentLayoutStyle) currentLayoutStyle.remove();
  if (layoutName) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `page-style/${layoutName}.css`;
    document.head.appendChild(link);
    currentLayoutStyle = link;
  } else {
    currentLayoutStyle = null;
  }
}

function loadPageStyle(pageName) {
  if (currentPageStyle) currentPageStyle.remove();
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `page-style/${pageName}.css`;
  document.head.appendChild(link);
  currentPageStyle = link;
}

// ===============================================
// FUNGSI INTI APLIKASI
// ===============================================

window.loadPage = async (pageName) => {
  currentCleanupFunction();
  removePageScript(); 

  const authPages = ['login', 'signup', 'verify', 'verified'];
  if (authPages.includes(pageName)) {
    loadLayoutStyle('auth-layout');
    sidebarContainer.style.display = 'none';
  } else {
    loadLayoutStyle(null);
    sidebarContainer.style.display = 'block';
  }
  loadPageStyle(pageName); 
  
  await loadHtml(`pages/${pageName}.html`, appRoot);
  
  const pagesNeedingData = ['home', 'profile'];
  if (pagesNeedingData.includes(pageName)) {
    const currentUser = auth.currentUser;
    if (currentUser) {
      await loadUserData(currentUser);
    }
  }

  initializePageEvents(pageName);
}

async function initializePageEvents(pageName) {
  try {
    switch (pageName) {
      case 'landing':
        setTimeout(() => { window.loadPage('login'); }, 2000);
        currentCleanupFunction = () => {};
        break;

      case 'login':
        const loginModule = await import('./page-logic/logic-login.js');
        loginModule.initLoginPage();
        currentCleanupFunction = loginModule.cleanupLoginPage;
        break;
        
      case 'signup':
        const signupModule = await import('./page-logic/logic-signup.js');
        signupModule.initSignupPage();
        currentCleanupFunction = signupModule.cleanupSignupPage;
        break;

      case 'verify':
        const verifyModule = await import('./page-logic/logic-verify.js');
        verifyModule.initVerifyPage();
        currentCleanupFunction = verifyModule.cleanupVerifyPage;
        break;

      case 'verified':
        const verifiedModule = await import('./page-logic/logic-verified.js');
        verifiedModule.initVerifiedPage();
        currentCleanupFunction = verifiedModule.cleanupVerifiedPage;
        break;
      
      case 'home':
        const homeModule = await import('./page-logic/logic-home.js');
        homeModule.initHomePage();
        currentCleanupFunction = homeModule.cleanupHomePage;
        break;
      
      case 'profile':
        const profileModule = await import('./page-logic/logic-profile.js');
        profileModule.initProfilePage();
        currentCleanupFunction = profileModule.cleanupProfilePage;
        break;
      
      case 'edit-profile':
        const editProfileModule = await import('./page-logic/logic-edit-profile.js');
        editProfileModule.initEditProfilePage();
        currentCleanupFunction = editProfileModule.cleanupEditProfilePage;
        break;
        
      case 'wardrobe':
        const wardrobeModule = await import('./page-logic/logic-wardrobe.js');
        wardrobeModule.initWardrobePage();
        currentCleanupFunction = wardrobeModule.cleanupWardrobePage;
        break;

      case 'shuffle':
        const shuffleModule = await import('./page-logic/logic-shuffle.js');
        shuffleModule.initShufflePage();
        currentCleanupFunction = shuffleModule.cleanupShufflePage;
        break;
      
      default:
        currentCleanupFunction = () => {};
    }
  } catch (error) {
    console.error(`Gagal mengimpor atau menjalankan modul untuk ${pageName}:`, error);
  }
}

// --- TITIK MULAI APLIKASI (GATEKEEPER) ---
async function initializeApp() {
  await loadHtml('components/sidebar.html', sidebarContainer);
  loadPersistentStyle('page-style/sidebar.css');
  loadScript('components/sidebar.js'); 

  window.addEventListener('navigate', (event) => {
    const pageName = event.detail.page;
    if (pageName) {
      window.loadPage(pageName);
    }
  });

  // --- PERUBAHAN DI SINI ---
  // Atur mode persistensi SEBELUM onAuthStateChanged dipanggil
  try {
    await setPersistence(auth, browserSessionPersistence);
    console.log("Firebase persistence set to 'session'.");
  } catch (error) {
    console.error("Gagal mengatur Firebase persistence:", error);
  }
  // --- AKHIR PERUBAHAN ---

  onAuthStateChanged(auth, async (user) => {
    currentCleanupFunction(); 

    if (user) {
      await user.reload(); 
      if (user.emailVerified) {
        console.log('User verified and logged in:', user.uid);
        const currentPage = appRoot.firstChild?.id;
        const authPages = ['login-page', 'signup-page', 'verify-page', 'verified-page', 'landing'];
        
        if (!currentPage || authPages.includes(currentPage)) {
          await window.loadPage('home'); 
        } else {
          const simplePageName = currentPage.replace('-page', '');
          await window.loadPage(simplePageName);
        }
      } else {
        console.log('User logged in but NOT verified:', user.uid);
        const currentPage = appRoot.firstChild?.id;
        if (currentPage !== 'verify-page') {
          window.loadPage('verify');
        } else {
          const verifyEmailText = document.getElementById('verify-email-text');
          if (verifyEmailText && user) verifyEmailText.textContent = user.email;
        }
      }
    } else {
      console.log('User logged out');
      window.loadPage('landing');
      sidebarContainer.style.display = 'none';
    }
  });
}

// Jalankan aplikasi!
initializeApp();