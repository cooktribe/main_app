import React, { createContext, useContext, useState, useEffect } from 'react';
import { collection, doc, getDoc, getDocs, query, where, addDoc, Timestamp, updateDoc, deleteField, onSnapshot, deleteDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from './AuthContext';

const SubscriptionContext = createContext();

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};

export const SubscriptionProvider = ({ children }) => {
  const { user } = useAuth();
  const [subscriptionData, setSubscriptionData] = useState({
    userSubscription: null,
    activePlan: null,
    activeSubscriptions: [],
    aggregateAllowed: null,
    aggregateUsed: 0,
    aggregateRemaining: null,
    totalAllowedEvents: null,
    usedEventsCount: 0,
    remainingEvents: null,
    loading: true,
  });

  const computeExpiryDate = (activationDate, duration) => {
    if (!activationDate || !duration || !duration.value || !duration.unit) return null;
    const d = new Date(activationDate.getTime());
    const val = Number(duration.value) || 0;
    const unit = String(duration.unit || '').toLowerCase();
    if (val <= 0) return null;
    if (unit.startsWith('day')) d.setDate(d.getDate() + val);
    else if (unit.startsWith('month')) d.setMonth(d.getMonth() + val);
    else if (unit.startsWith('year')) d.setFullYear(d.getFullYear() + val);
    else return null;
    return d;
  };

  const leaveFutureEvents = async (userId) => {
    try {
      
      const joinedQ = query(collection(db, 'users', userId, 'joinedEvents'));
      const joinedSnap = await getDocs(joinedQ);
      const joinedItems = joinedSnap.docs.map(d => ({ id: d.id, data: d.data() }));
      
      if (joinedItems.length === 0) return;
      
      const eventDocs = await Promise.all(joinedItems.map(it => getDoc(doc(db, 'events', it.id))));
      const now = new Date();
      
      const futureEvents = eventDocs.filter(eventDoc => {
        if (!eventDoc.exists()) return false;
        const eventData = eventDoc.data();
        const startAt = eventData.startAt;
        
        if (!startAt) return false;
        const startDate = startAt.toDate ? startAt.toDate() : new Date(startAt);
        return startDate > now;
      });
      
      
      for (const eventDoc of futureEvents) {
        const eventId = eventDoc.id;
        const joinedRef = doc(db, 'users', userId, 'joinedEvents', eventId);
        
        try {
          await deleteDoc(joinedRef);
        } catch (err) {
          console.error(`Failed to leave event ${eventId}:`, err);
        }
      }
      
    } catch (error) {
      console.error('Error leaving future events:', error);
    }
  };

  const archiveSubscription = async (userId, subscription, plan, meta) => {
    try {
      
      const status = meta.expired ? 'expired' : (meta.limitReached ? 'limit_reached' : 'archived');
      const historyDoc = {
        userId,
        planId: subscription.planId || plan.id,
        planName: subscription.planName || plan.name || 'Unknown Plan',
        code: subscription.code || null,
        source: subscription.gifted ? 'gift' : 'purchase',
        status,
        createdAt: Timestamp.now(),
        activatedAt: meta.activationDate ? Timestamp.fromDate(meta.activationDate) : null,
        expiredAt: meta.expiryDate ? Timestamp.fromDate(meta.expiryDate) : null,
        eventLimit: meta.totalAllowed,
        eventsUsed: meta.usedCount,
      };
      
      await addDoc(collection(db, 'subscriptionHistory'), historyDoc);
      
      // Remove from active subscriptions
      if (subscription.id && subscription.id !== 'legacy') {
        await deleteDoc(doc(db, 'users', userId, 'activeSubscriptions', subscription.id));
      } else {
        // Legacy subscription - remove from user document
        await updateDoc(doc(db, 'users', userId), { subscription: deleteField() });
      }
      
      
      // Leave all future events when subscription is archived
      await leaveFutureEvents(userId);
      
    } catch (e) {
      console.error('Failed to archive subscription:', e);
    }
  };

  const refreshSubscriptionData = async () => {
    if (!user?.uid) {
      setSubscriptionData(prev => ({ ...prev, loading: false }));
      return;
    }

    try {
      setSubscriptionData(prev => ({ ...prev, loading: true }));
      
      // Get user subscription data
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      let userSubscription = null;
      let activePlan = null;
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.subscription) {
          userSubscription = userData.subscription;
          if (userData.subscription.planId) {
            const planDoc = await getDoc(doc(db, 'settings', userData.subscription.planId));
            if (planDoc.exists()) {
              activePlan = { id: planDoc.id, ...planDoc.data() };
            }
          }
        }
      }

      // Load active subscriptions
      const subsSnap = await getDocs(collection(db, 'users', user.uid, 'activeSubscriptions'));
      const subs = subsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // Merge legacy and new subscriptions
      const single = userSubscription ? [{
        id: 'legacy',
        planId: userSubscription.planId,
        planName: userSubscription.planName,
        code: userSubscription.code || null,
        gifted: !!userSubscription.gifted,
        giftedBy: userSubscription.giftedBy || null,
        activatedAt: userSubscription.activatedAt || userSubscription.giftedAt || userSubscription.createdAt || null,
        source: userSubscription.gifted ? 'gift' : 'purchase',
      }] : [];
      
      const merged = [...subs, ...single];
      
      // Attach plan docs and filter expired
      const withPlans = [];
      for (const s of merged) {
        if (!s.planId) continue;
        const pDoc = await getDoc(doc(db, 'settings', s.planId));
        if (pDoc.exists()) withPlans.push({ ...s, plan: { id: pDoc.id, ...pDoc.data() } });
      }
      
      // Filter out expired subscriptions
      const now = new Date();
      const stillActive = [];
      for (const s of withPlans) {
        const act = s.activatedAt?.toDate ? s.activatedAt.toDate() : (s.activatedAt ? new Date(s.activatedAt) : null);
        const exp = computeExpiryDate(act, s.plan?.duration);
        const expired = exp ? now > exp : false;
        
        if (!expired) {
          stillActive.push({ ...s, activatedAtDate: act, expiresAtDate: exp });
        }
      }

      // Compute aggregate metrics
      let aggregateAllowed = null;
      let aggregateUsed = 0;
      let aggregateRemaining = null;
      
      if (stillActive.length > 0) {
        const allowedSum = stillActive.reduce((sum, s) => {
          const lim = Number(s.plan?.eventParticipationLimit || 0);
          return lim > 0 ? sum + lim : sum;
        }, 0);
        
        aggregateAllowed = allowedSum || null;
        
        if (allowedSum > 0) {
          const joinedQ = query(collection(db, 'users', user.uid, 'joinedEvents'));
          const joinedSnap2 = await getDocs(joinedQ);
          const joinedItems2 = joinedSnap2.docs.map(d => ({ id: d.id, data: d.data() }));
          
          const eventDocs2 = await Promise.all(joinedItems2.map(it => getDoc(doc(db, 'events', it.id))));
          
          const usedAgg = eventDocs2.filter(s => {
            if (!s.exists()) return false;
            const ev = s.data() || {};
            const statusOk = ev.status === 'completed' || ev.status === 'done';
            const notOwner = ev.createdBy !== user.uid;
            return statusOk && notOwner;
          }).length;
          
          aggregateUsed = usedAgg;
          aggregateRemaining = Math.max(allowedSum - usedAgg, 0);
          
          // If subscription is exhausted, archive subscriptions and leave future events
          if (aggregateRemaining === 0) {
            
            // Archive each exhausted subscription
            for (const subscription of stillActive) {
              const plan = subscription.plan;
              const activationDate = subscription.activatedAtDate;
              const expiryDate = subscription.expiresAtDate;
              const totalAllowed = Number(plan?.eventParticipationLimit || 0);
              
              // Calculate used events for this specific subscription
              const usedForThisSub = Math.min(usedAgg, totalAllowed);
              
              await archiveSubscription(user.uid, subscription, plan, {
                expired: false,
                limitReached: true,
                usedCount: usedForThisSub,
                activationDate,
                expiryDate,
                totalAllowed,
              });
            }
            
            // Refresh data after archiving
            setTimeout(() => refreshSubscriptionData(), 1000);
          }
        }
      }

      // Compute single subscription metrics
      let totalAllowedEvents = null;
      let usedEventsCount = 0;
      let remainingEvents = null;
      
      if (userSubscription && activePlan) {
        const plan = activePlan || {};
        const activationTs = userSubscription.activatedAt || userSubscription.giftedAt || userSubscription.createdAt || null;
        const activationDate = activationTs?.toDate ? activationTs.toDate() : (activationTs ? new Date(activationTs) : null);
        
        totalAllowedEvents = Number(plan?.eventParticipationLimit || 0) > 0 ? Number(plan.eventParticipationLimit) : null;
        
        if (totalAllowedEvents) {
          const joinedQ = query(collection(db, 'users', user.uid, 'joinedEvents'));
          const joinedSnap = await getDocs(joinedQ);
          const joinedItems = joinedSnap.docs.map(d => ({ id: d.id, data: d.data() }));
          
          const eventDocs = await Promise.all(joinedItems.map(it => getDoc(doc(db, 'events', it.id))));
          
          const used = eventDocs.filter(s => {
            if (!s.exists()) return false;
            const ev = s.data() || {};
            const statusOk = ev.status === 'completed' || ev.status === 'done';
            const notOwner = ev.createdBy !== user.uid;
            return statusOk && notOwner;
          }).length;
          
          usedEventsCount = used;
          remainingEvents = Math.max(totalAllowedEvents - used, 0);
          
          // If single subscription is exhausted, archive it
          if (remainingEvents === 0) {
            
            const activationTs = userSubscription.activatedAt || userSubscription.giftedAt || userSubscription.createdAt || null;
            const activationDate = activationTs?.toDate ? activationTs.toDate() : (activationTs ? new Date(activationTs) : null);
            const exp = computeExpiryDate(activationDate, activePlan?.duration);
            
            await archiveSubscription(user.uid, userSubscription, activePlan, {
              expired: false,
              limitReached: true,
              usedCount: used,
              activationDate,
              expiryDate: exp,
              totalAllowed: totalAllowedEvents,
            });
            
            // Refresh data after archiving
            setTimeout(() => refreshSubscriptionData(), 1000);
          }
        }
      }

      setSubscriptionData({
        userSubscription,
        activePlan,
        activeSubscriptions: stillActive,
        aggregateAllowed,
        aggregateUsed,
        aggregateRemaining,
        totalAllowedEvents,
        usedEventsCount,
        remainingEvents,
        loading: false,
      });

    } catch (error) {
      console.error('Error refreshing subscription data:', error);
      setSubscriptionData(prev => ({ ...prev, loading: false }));
    }
  };

  // Listen to user's joinedEvents and setup event status listeners
  useEffect(() => {
    if (!user?.uid) return;

    let eventUnsubscribers = [];

    const joinedEventsRef = collection(db, 'users', user.uid, 'joinedEvents');
    const unsubscribeJoined = onSnapshot(joinedEventsRef, (snapshot) => {
      console.log('JoinedEvents changed, refreshing subscription data...');
      refreshSubscriptionData();

      // Clean up previous event listeners
      eventUnsubscribers.forEach(unsub => unsub());
      eventUnsubscribers = [];

      // Setup new event listeners for current joined events
      const joinedEventIds = snapshot.docs.map(d => d.id);
      
      if (joinedEventIds.length > 0) {
        console.log(`Setting up listeners for ${joinedEventIds.length} joined events`);
        
        joinedEventIds.forEach(eventId => {
          const eventRef = doc(db, 'events', eventId);
          const unsubEvent = onSnapshot(eventRef, (eventDoc) => {
            if (eventDoc.exists()) {
              const eventData = eventDoc.data();
              if (eventData.status === 'done' || eventData.status === 'completed') {
                console.log(`Joined event ${eventId} status changed to ${eventData.status}, refreshing subscription...`);
                refreshSubscriptionData();
              }
            }
          });
          eventUnsubscribers.push(unsubEvent);
        });
      }
    });

    return () => {
      unsubscribeJoined();
      eventUnsubscribers.forEach(unsub => unsub());
    };
  }, [user?.uid]);

  // Initial load
  useEffect(() => {
    refreshSubscriptionData();
  }, [user?.uid]);

  return (
    <SubscriptionContext.Provider value={{
      ...subscriptionData,
      refreshSubscriptionData,
    }}>
      {children}
    </SubscriptionContext.Provider>
  );
};
