import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth,onAuthStateChanged,signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { firebaseConfig } from './firebase-config.js';
const app=initializeApp(firebaseConfig);
const auth=getAuth(app);
window.logout=()=>signOut(auth).then(()=>location.href='login.html');
onAuthStateChanged(auth,u=>{ if(!u && !location.pathname.includes('login.html')) location.href='login.html';});
