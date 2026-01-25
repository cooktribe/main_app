import { doc, getDoc, setDoc, deleteDoc, collection, query, where, getDocs, Timestamp, onSnapshot } from 'firebase/firestore';

const DEFAULT_DEADLINE_HOURS = 48;

export const getParticipationDeadlineHours = async (db) => {
  try {
    const snap = await getDoc(doc(db, 'settings', 'general'));
    if (snap.exists()) {
      const val = Number(snap.data()?.participationDeadlineHours);
      if (!Number.isNaN(val) && val > 0) return val;
    }
  } catch (_) {}
  return DEFAULT_DEADLINE_HOURS;
};

export const isPastParticipationDeadline = (startAt, deadlineHours) => {
  if (!startAt) return false;
  const startDate = startAt?.toDate ? startAt.toDate() : new Date(startAt);
  const nowPlusDeadline = new Date(Date.now() + deadlineHours * 60 * 60 * 1000);
  return nowPlusDeadline >= startDate;
};

const isSameLocalDay = (a, b) => {
  const d1 = a?.toDate ? a.toDate() : new Date(a);
  const d2 = b?.toDate ? b.toDate() : new Date(b);
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
};

export const joinEvent = async (db, userId, eventId) => {
  if (!userId) throw new Error('Not authenticated');
  const eventRef = doc(db, 'events', eventId);
  const joinedRef = doc(db, 'users', userId, 'joinedEvents', eventId);

  const [deadlineHours, eventSnap, existingJoin] = await Promise.all([
    getParticipationDeadlineHours(db),
    getDoc(eventRef),
    getDoc(joinedRef),
  ]);
  if (!eventSnap.exists()) throw new Error('Event not found');
  if (existingJoin.exists()) return { joined: true, already: true };
  const ev = eventSnap.data();

  if (ev?.createdBy && ev.createdBy === userId) {
    throw new Error('You cannot join your own event');
  }

  if (isPastParticipationDeadline(ev.startAt, deadlineHours)) {
    throw new Error('Participation deadline has passed for this event');
  }

  // One event per day constraint: check other joined events for this user on the same day
  const joinedQ = query(collection(db, 'users', userId, 'joinedEvents'));
  const joinedSnap = await getDocs(joinedQ);
  const conflict = joinedSnap.docs
    .filter(d => d.id !== eventId)
    .map(d => d.data())
    .some(j => j.startAt && ev.startAt && isSameLocalDay(j.startAt, ev.startAt));
  if (conflict) {
    throw new Error('You already joined another event on this date');
  }

  // Compute aggregated cap (non-blocking) and mark whether this join exceeds it
  let overCap = false;
  let aggregatedAllowed = null;
  let windowStart = null;
  try {
    const subsSnap = await getDocs(collection(db, 'users', userId, 'activeSubscriptions'));
    const subs = subsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    let legacy = null;
    const userSnap = await getDoc(doc(db, 'users', userId));
    if (userSnap.exists() && userSnap.data()?.subscription) legacy = userSnap.data().subscription;

    const merged = [
      ...subs,
      ...(legacy ? [{ id: 'legacy', planId: legacy.planId, activatedAt: legacy.activatedAt || legacy.giftedAt || legacy.createdAt || null }] : [])
    ];
    const plans = [];
    for (const s of merged) {
      if (!s.planId) continue;
      const p = await getDoc(doc(db, 'settings', s.planId));
      if (p.exists()) plans.push({ ...s, plan: p.data() });
    }
    aggregatedAllowed = plans.reduce((sum, s) => {
      const lim = Number(s.plan?.eventParticipationLimit || 0);
      return lim > 0 ? sum + lim : sum;
    }, 0);
    if (aggregatedAllowed > 0) {
      const actDates = plans
        .map(s => (s.activatedAt?.toDate ? s.activatedAt.toDate() : (s.activatedAt ? new Date(s.activatedAt) : null)))
        .filter(Boolean);
      const minAct = actDates.length ? new Date(Math.min(...actDates.map(d => d.getTime()))) : null;
      windowStart = minAct || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    }
  } catch (_) {
    aggregatedAllowed = null;
    windowStart = null;
  }

  // If aggregated cap is exactly zero (i.e., no valid subscriptions), block joining
  if (aggregatedAllowed === 0) {
    throw new Error('Your aggregated subscription limit is zero. Please activate or purchase a subscription to join events.');
  }
  
  // If we have a positive cap, compute current usage and check for warning
  if (typeof aggregatedAllowed === 'number' && aggregatedAllowed > 0) {
    const joinedItems = joinedSnap.docs.map(d => ({ id: d.id, data: d.data() }));
    
    // Get all event documents
    const eventDocs = await Promise.all(joinedItems.map(it => getDoc(doc(db, 'events', it.id))));

    // Count ALL joined events (not just completed ones) to check if we're exceeding the limit
    const totalJoined = eventDocs.filter(s => {
      if (!s.exists()) return false;
      const e = s.data() || {};
      const notOwner = e.createdBy !== userId;
      return notOwner; // Count all joined events regardless of status
    }).length;

    // Check if this join will exceed the subscription limit (warning only, not blocking)
    overCap = (totalJoined + 1) > aggregatedAllowed;
    
  }



  await setDoc(joinedRef, {
    eventId,
    startAt: ev.startAt || null,
    createdAt: Timestamp.now(),
  }, { merge: true });

  // The subscription context will automatically update via onSnapshot listener

  return { 
    joined: true, 
    overCap,
    warningMessage: overCap ? 'You have exceeded your subscription limit. You may be removed from future events due to subscription expiration.' : null
  };
};

export const leaveEvent = async (db, userId, eventId) => {
  if (!userId) throw new Error('Not authenticated');
  const eventRef = doc(db, 'events', eventId);
  const joinedRef = doc(db, 'users', userId, 'joinedEvents', eventId);

  const [deadlineHours, eventSnap, existingJoin] = await Promise.all([
    getParticipationDeadlineHours(db),
    getDoc(eventRef),
    getDoc(joinedRef),
  ]);
  if (!eventSnap.exists()) throw new Error('Event not found');
  if (!existingJoin.exists()) return { left: true, already: true };
  const ev = eventSnap.data();
  if (isPastParticipationDeadline(ev.startAt, deadlineHours)) {
    throw new Error('Participation deadline has passed for this event');
  }

  await deleteDoc(joinedRef);
  
  // The subscription context will automatically update via onSnapshot listener
  
  return { left: true };
};

export const subscribeJoinedEventIds = (db, userId, callback) => {
  if (!userId) return () => {};
  const q = collection(db, 'users', userId, 'joinedEvents');
  return onSnapshot(q, (snap) => {
    const ids = new Set(snap.docs.map(d => d.id));
    callback(ids);
  });
};


