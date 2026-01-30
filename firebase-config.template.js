// Firebase Configuration TEMPLATE
// 1. Rename this file to "firebase-config.js" (or copy content to it)
// 2. Replace placeholders with your actual Firebase project config
// 3. Make sure "firebase-config.js" is in your .gitignore!

const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT_ID.firebaseio.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase (will be enabled once SDK is included in HTML)
// firebase.initializeApp(firebaseConfig);
// const db = firebase.database();

console.log('Firebase Config Loaded');
