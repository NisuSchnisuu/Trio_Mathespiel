// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyCb6-mHXH5GNheharHjp9BDKUN8zXU6dmbw",
    authDomain: "trio-mathespiel.firebaseapp.com",
    projectId: "trio-mathespiel",
    // FÜGE HIER DEINEN DATENBANK-LINK EIN:
    databaseURL: "https://trio-mathespiel-default-rtdb.europe-west1.firebasedatabase.app/",
    storageBucket: "trio-mathespiel.firebasestorage.app",
    messagingSenderId: "125078001499",
    appId: "1:125078001499:web:1570515918416a34086c7e"
};

// Initialize Firebase
// (Using the global 'firebase' object from the compat scripts in index.html)
firebase.initializeApp(firebaseConfig);

// Initialize Realtime Database and Make available globally
const db = firebase.database();

console.log('Firebase Connected & Initialized');
