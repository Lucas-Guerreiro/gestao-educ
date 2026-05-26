import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCbd8QE6mKwB0j_Eeb7AIqzJ7MqgfknV0U",
  authDomain: "gestao-escolar-59848.firebaseapp.com",
  projectId: "gestao-escolar-59848",
  storageBucket: "gestao-escolar-59848.firebasestorage.app",
  messagingSenderId: "538418225876",
  appId: "1:538418225876:web:f710773abcee665fad5141"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export default app;
