
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";
const app=initializeApp(firebaseConfig);
const auth=getAuth(app);
window.protegerPagina=function(){
 onAuthStateChanged(auth,(u)=>{
   if(!u){ window.location.href='login.html'; }
 });
}
