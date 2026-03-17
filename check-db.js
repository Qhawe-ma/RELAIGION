const { ref, onValue } = require('firebase/database');
const { db } = require('./src/lib/firebase');

// Check current day's meta data
const metaRef = ref(db, '2025-03-17/meta');
onValue(metaRef, (snapshot) => {
  const data = snapshot.val();
  console.log('Meta data for 2025-03-17:', JSON.stringify(data, null, 2));
  process.exit(0);
}, { onlyOnce: true });
