// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyD5DVdin4xLlT86KIiXy2wetJ04fyEeWBA",
  authDomain: "faby-be0b9.firebaseapp.com",
  projectId: "faby-be0b9",
  storageBucket: "faby-be0b9.firebasestorage.app",
  messagingSenderId: "71671731623",
  appId: "1:71671731623:web:6df23b47797e12b9aad282",
  measurementId: "G-ZBZJKVWND9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
