import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyDNMnb01cPrfJQkP-M44LE6bgwJMYq2Cq8',
  authDomain: 'portal-ciop.firebaseapp.com',
  projectId: 'portal-ciop',
  storageBucket: 'portal-ciop.firebasestorage.app',
  messagingSenderId: '455189133437',
  appId: '1:455189133437:web:34dae49eb1fdaf65191914',
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
