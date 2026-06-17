import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDNMnb01cPrfJQkP-M44LE6bgwJMYq2Cq8",
  authDomain: "portal-ciop.firebaseapp.com",
  projectId: "portal-ciop",
  storageBucket: "portal-ciop.firebasestorage.app",
  messagingSenderId: "455189133437",
  appId: "1:455189133437:web:34dae49eb1fdaf65191914"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

window.logout = function () {
  signOut(auth).then(() => {
    window.location.href = "login.html";
  });
};

window.recuperarSenha = function(email){
  return sendPasswordResetEmail(auth,email);
};

onAuthStateChanged(auth, (user) => {

  if (!user) {
    const pagina = window.location.pathname.toLowerCase();

    if (!pagina.includes("login.html")) {
      window.location.href = "login.html";
    }
    return;
  }

  const nome = document.getElementById("usuarioLogado");

  if(nome){
    nome.innerHTML = "👤 " + user.email;
  }

});
