const firebaseConfig = {
  apiKey: "AIzaSyCCrsHE4maOWXu06ADT7W6wMXWXzK0wSMo",
  authDomain: "treebolito.firebaseapp.com",
  projectId: "treebolito",
  storageBucket: "treebolito.firebasestorage.app",
  messagingSenderId: "321841443031",
  appId: "1:321841443031:web:f8b97c0802150ecee04092"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore(app);
