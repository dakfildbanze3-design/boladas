import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  addDoc, 
  serverTimestamp, 
  doc, 
  updateDoc, 
  getDoc,
  setDoc,
  getDocs,
  limit
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

export interface Message {
  id: string;
  text: string;
  senderId: string;
  createdAt: any;
  image?: string;
}

export interface ChatRoom {
  id: string;
  participants: string[];
  lastMessage?: string;
  updatedAt?: any;
  otherUser?: {
    id: string;
    displayName: string;
    avatarUrl: string;
  };
}

export const chatService = {
  /**
   * Obtém ou cria uma sala de chat entre dois usuários
   */
  async getOrCreateChat(otherUserId: string, otherUserName?: string, otherUserAvatar?: string) {
    const currentUserId = auth.currentUser?.uid;
    if (!currentUserId || !otherUserId) throw new Error("Usuários não identificados");
    if (currentUserId === otherUserId) throw new Error("Não podes iniciar um chat contigo mesmo");

    // Tentar encontrar chat existente
    const chatsRef = collection(db, 'chats');
    const q = query(
      chatsRef, 
      where('participants', 'array-contains', currentUserId)
    );
    
    const snapshot = await getDocs(q);
    let commonChat = snapshot.docs.find(doc => {
      const parts = doc.data().participants as string[];
      return parts.includes(otherUserId);
    });

    if (commonChat) {
      return commonChat.id;
    }

    // Se não existir, criar novo
    const newChatRef = await addDoc(chatsRef, {
      participants: [currentUserId, otherUserId],
      updatedAt: serverTimestamp(),
      lastMessage: '',
      // Guardar nomes denormalizados para facilitar a lista
      [`userName_${currentUserId}`]: auth.currentUser?.displayName || 'Usuário',
      [`userAvatar_${currentUserId}`]: auth.currentUser?.photoURL || '',
      [`userName_${otherUserId}`]: otherUserName || 'Vendedor',
      [`userAvatar_${otherUserId}`]: otherUserAvatar || '',
    });

    return newChatRef.id;
  },

  /**
   * Envia uma mensagem
   */
  async sendMessage(chatId: string, text: string) {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    await addDoc(collection(db, 'chats', chatId, 'messages'), {
      text,
      senderId: userId,
      createdAt: serverTimestamp()
    });

    await updateDoc(doc(db, 'chats', chatId), {
      lastMessage: text,
      updatedAt: serverTimestamp(),
      lastSenderId: userId,
      unread: true // Simplificado
    });
  },

  /**
   * Subscreve às mensagens de um chat
   */
  subscribeToMessages(chatId: string, callback: (messages: Message[]) => void) {
    const q = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(100)
    );

    return onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      callback(messages);
    });
  },

  /**
   * Obtém detalhes da sala de chat
   */
  subscribeToChatRoom(chatId: string, callback: (room: ChatRoom) => void) {
    return onSnapshot(doc(db, 'chats', chatId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const currentUserId = auth.currentUser?.uid;
        const otherUserId = data.participants.find((p: string) => p !== currentUserId);

        callback({
          id: docSnap.id,
          participants: data.participants,
          lastMessage: data.lastMessage,
          updatedAt: data.updatedAt,
          otherUser: {
            id: otherUserId,
            displayName: data[`userName_${otherUserId}`] || 'Usuário',
            avatarUrl: data[`userAvatar_${otherUserId}`] || `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherUserId}`
          }
        });
      }
    });
  }
};
