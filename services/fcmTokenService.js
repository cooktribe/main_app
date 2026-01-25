import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export async function saveFcmToken({ userId, token, platform }) {
  if (!userId || !token) return { success: false, error: 'Missing userId or token' };
  try {
    const ref = doc(db, 'pushTokens', token);
    await setDoc(
      ref,
      {
        userId,
        token,
        platform,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return { success: true };
  } catch (e) {
    return { success: false, error: e?.message || String(e) };
  }
}


