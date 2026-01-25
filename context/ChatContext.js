import React, { createContext, useContext, useState, useEffect } from 'react';
import { collection, doc, getDoc, getDocs, query, where, orderBy, addDoc, setDoc, Timestamp, onSnapshot, limit } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from './AuthContext';

const ChatContext = createContext();

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};

export const ChatProvider = ({ children }) => {
  const { user } = useAuth();
  const [eventChats, setEventChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeMessages, setActiveMessages] = useState({});

  // Get user's completed events with matches
  const fetchEventChats = async () => {
    if (!user?.uid) {
      setEventChats([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

       // Get user's joined events
       const joinedEventsQuery = query(collection(db, 'users', user.uid, 'joinedEvents'));
       const joinedEventsSnap = await getDocs(joinedEventsQuery);
       const joinedEventIds = joinedEventsSnap.docs.map(doc => doc.id);

       // Also get events created by the user
       const createdEventsQuery = query(
         collection(db, 'events'), 
         where('createdBy', '==', user.uid),
         where('status', '==', 'done')
       );
       const createdEventsSnap = await getDocs(createdEventsQuery);
       const createdEventIds = createdEventsSnap.docs.map(doc => doc.id);

       // Combine joined and created event IDs (remove duplicates)
       const allEventIds = [...new Set([...joinedEventIds, ...createdEventIds])];

       if (allEventIds.length === 0) {
         setEventChats([]);
         setLoading(false);
         return;
       }

       // Get event details for all relevant events
       const eventPromises = allEventIds.map(eventId => getDoc(doc(db, 'events', eventId)));
       const eventDocs = await Promise.all(eventPromises);

      // Filter for completed events with matching data
      const completedEventsWithMatches = [];
      
      for (const eventDoc of eventDocs) {
        if (eventDoc.exists()) {
          const eventData = eventDoc.data();
          
          // Check if event is done and has matching results
          if (eventData.status === 'done' && eventData.matching?.resultJson) {
            try {
              const matchingResult = JSON.parse(eventData.matching.resultJson);
              
              // Check if current user is in the matched group
              const userInMatch = matchingResult.group?.some(participant => 
                participant.id === user.uid
              );

               if (userInMatch) {
                 // Fetch user profiles for all participants to get real names
                 const participantProfiles = [];
                 for (const participant of matchingResult.group) {
                   try {
                     const userDoc = await getDoc(doc(db, 'users', participant.id));
                     if (userDoc.exists()) {
                       const userData = userDoc.data();
                       const resolvedName = userData.displayName || userData.nickname || userData.firstName || 
                                        (userData.firstName && userData.lastName ? `${userData.firstName} ${userData.lastName}` : userData.firstName) ||
                                        userData.email || participant.id;
                       const profile = {
                         ...participant,
                         id: participant.id,
                         name: resolvedName,
                         email: userData.email,
                         photoURL: userData.photoURL || userData.avatarUrl
                       };
                       participantProfiles.push(profile);
                     } else {
                       // Fallback if user document doesn't exist
                       participantProfiles.push({
                         id: participant.id,
                         name: participant.id,
                         ...participant
                       });
                     }
                   } catch (error) {
                     console.error('Error fetching user profile for:', participant.id, error);
                     participantProfiles.push({
                       id: participant.id,
                       name: participant.id,
                       ...participant
                     });
                   }
                 }

                 completedEventsWithMatches.push({
                   id: eventDoc.id,
                   ...eventData,
                   matchingResult: {
                     ...matchingResult,
                     group: participantProfiles
                   }
                 });
               }
            } catch (e) {
              console.error('Error parsing matching result for event:', eventDoc.id, e);
            }
          }
        }
      }

      // Check if chat groups exist for these events, if not create them
      const chatGroups = [];
      
      for (const event of completedEventsWithMatches) {
        // Check if chat group exists
        const chatDoc = await getDoc(doc(db, 'eventChats', event.id));
        
         if (!chatDoc.exists()) {
           // Create chat group document with the event ID as the document ID
           try {
             const chatGroupData = {
               eventId: event.id,
               eventTitle: event.title || 'Event Chat',
               eventImage: event.imageUrl || event.iconUrl || null,
               participants: event.matchingResult.group.map(p => p.id),
               createdAt: Timestamp.now(),
               lastActivity: Timestamp.now(),
               createdBy: user.uid
             };
             
             await setDoc(doc(db, 'eventChats', event.id), chatGroupData);
           } catch (error) {
             console.error('Error creating chat group for event:', event.id, error);
             console.error('Error details:', error.message);
             // Continue even if creation fails
           }
         }

        // Get latest message for this chat
        let lastMessage = null;
        let unreadCount = 0;
        
        try {
          const messagesQuery = query(
            collection(db, 'eventChats', event.id, 'messages'),
            orderBy('createdAt', 'desc'),
            limit(1)
          );
          const messagesSnap = await getDocs(messagesQuery);
          
          if (!messagesSnap.empty) {
            const lastMessageDoc = messagesSnap.docs[0];
            lastMessage = {
              id: lastMessageDoc.id,
              ...lastMessageDoc.data()
            };
          }
        } catch (error) {
          console.error('Error fetching last message:', error);
        }

        chatGroups.push({
          id: event.id,
          eventTitle: event.title || 'Event Chat',
          eventImage: event.imageUrl || event.iconUrl || null,
          participants: event.matchingResult.group,
          lastMessage,
          unreadCount,
          lastActivity: lastMessage?.createdAt || Timestamp.now()
        });
      }

      // Sort by last activity
      chatGroups.sort((a, b) => {
        const aTime = a.lastActivity?.toMillis?.() || 0;
        const bTime = b.lastActivity?.toMillis?.() || 0;
        return bTime - aTime;
      });

      setEventChats(chatGroups);

    } catch (error) {
      console.error('Error fetching event chats:', error);
      setEventChats([]);
    } finally {
      setLoading(false);
    }
  };

  // Send a message to an event chat
  const sendMessage = async (eventId, messageText) => {
    if (!user?.uid || !messageText.trim()) return;

    try {
      // First ensure chat group exists
      const chatDoc = await getDoc(doc(db, 'eventChats', eventId));
      if (!chatDoc.exists()) {
        // Try to create the chat group first
        const eventDoc = await getDoc(doc(db, 'events', eventId));
        if (eventDoc.exists()) {
          const eventData = eventDoc.data();
          if (eventData.matching?.resultJson) {
            const matchingResult = JSON.parse(eventData.matching.resultJson);
            await setDoc(doc(db, 'eventChats', eventId), {
              eventId: eventId,
              eventTitle: eventData.title || 'Event Chat',
              eventImage: eventData.imageUrl || eventData.iconUrl || null,
              participants: matchingResult.group.map(p => p.id),
              createdAt: Timestamp.now(),
              lastActivity: Timestamp.now(),
              createdBy: user.uid
            });
          }
        }
      }

       // Get current user's profile for accurate name
       let senderName = 'Anonymous';
       try {
         const userDoc = await getDoc(doc(db, 'users', user.uid));
         if (userDoc.exists()) {
           const userData = userDoc.data();
           senderName = userData.displayName || userData.nickname || userData.firstName || 
                       (userData.firstName && userData.lastName ? `${userData.firstName} ${userData.lastName}` : userData.firstName) ||
                       userData.email || user.email || 'Anonymous';
         } else {
           senderName = user.displayName || user.email || 'Anonymous';
         }
       } catch (error) {
         console.error('Error fetching sender profile:', error);
         senderName = user.displayName || user.email || 'Anonymous';
       }

       const messageData = {
         senderId: user.uid,
         senderName: senderName,
         text: messageText.trim(),
         createdAt: Timestamp.now(),
         type: 'text'
       };

      await addDoc(collection(db, 'eventChats', eventId, 'messages'), messageData);
      
      // Refresh chat list to update last message
      fetchEventChats();
      
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  };

  // Subscribe to messages for a specific event chat
  const subscribeToMessages = (eventId, callback) => {
    if (!eventId) return () => {};

    
    const messagesQuery = query(
      collection(db, 'eventChats', eventId, 'messages'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      callback(messages);
    }, (error) => {
      console.error('Error subscribing to messages:', error);
      callback([]);
    });

    return unsubscribe;
  };

  // Load event chats on user change
  useEffect(() => {
    fetchEventChats();
  }, [user?.uid]);

  // Listen for events becoming 'done' to auto-refresh chat list
  useEffect(() => {
    if (!user?.uid) return;

    
    // Listen to events where user is a participant and status changes to 'done'
    const joinedEventsRef = collection(db, 'users', user.uid, 'joinedEvents');
    
    const unsubscribe = onSnapshot(joinedEventsRef, async (joinedSnapshot) => {
      const joinedEventIds = joinedSnapshot.docs.map(doc => doc.id);
      
      if (joinedEventIds.length === 0) return;

      // Check if any of the joined events have become 'done'
      const eventPromises = joinedEventIds.map(eventId => getDoc(doc(db, 'events', eventId)));
      const eventDocs = await Promise.all(eventPromises);
      
      let shouldRefresh = false;
      
      for (const eventDoc of eventDocs) {
        if (eventDoc.exists()) {
          const eventData = eventDoc.data();
          if (eventData.status === 'done' && eventData.matching?.resultJson) {
            try {
              const matchingResult = JSON.parse(eventData.matching.resultJson);
              const userInMatch = matchingResult.group?.some(participant => 
                participant.id === user.uid
              );
              
              if (userInMatch) {
                shouldRefresh = true;
              }
            } catch (e) {
              console.error('Error parsing matching result:', e);
            }
          }
        }
      }
      
      if (shouldRefresh) {
        setTimeout(() => fetchEventChats(), 1000);
      }
    });

    return () => unsubscribe();
  }, [user?.uid]);

  // Set up real-time listeners for chat list updates
  useEffect(() => {
    if (!user?.uid || eventChats.length === 0) return;

    const unsubscribers = [];

    // Listen to new messages in all event chats to update last message
    eventChats.forEach(chat => {
      const messagesQuery = query(
        collection(db, 'eventChats', chat.id, 'messages'),
        orderBy('createdAt', 'desc'),
        limit(1)
      );

      const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
        if (!snapshot.empty) {
          const latestMessage = {
            id: snapshot.docs[0].id,
            ...snapshot.docs[0].data()
          };

          // Update the chat list with new last message
          setEventChats(prevChats => 
            prevChats.map(prevChat => 
              prevChat.id === chat.id 
                ? { ...prevChat, lastMessage: latestMessage, lastActivity: latestMessage.createdAt }
                : prevChat
            ).sort((a, b) => {
              const aTime = a.lastActivity?.toMillis?.() || 0;
              const bTime = b.lastActivity?.toMillis?.() || 0;
              return bTime - aTime;
            })
          );
        }
      });

      unsubscribers.push(unsubscribe);
    });

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [eventChats.map(chat => chat.id).join(',')]);

  return (
    <ChatContext.Provider value={{
      eventChats,
      loading,
      sendMessage,
      subscribeToMessages,
      refreshChats: fetchEventChats
    }}>
      {children}
    </ChatContext.Provider>
  );
};
