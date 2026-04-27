"use client";

import React, { useState, useEffect } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { auth, db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { formatRelativeTime } from '../../lib/dateUtils';

const filterChips = ['Todas', 'Não Lidas', 'Vendas', 'Suporte'];

export default function ChatPage() {
  const router = useRouter();
  const [chats, setChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setLoading(false);
      return;
    }

    const path = 'chats';
    try {
      const q = query(
        collection(db, path),
        where('participants', 'array-contains', uid),
        orderBy('updatedAt', 'desc')
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const chatsData = snapshot.docs.map(doc => {
          const data = doc.data();
          const otherUserId = data.participants.find((p: string) => p !== uid);
          
          return {
            id: doc.id,
            user: data[`userName_${otherUserId}`] || 'Usuário',
            lastMessage: data.lastMessage || 'Nova mensagem...',
            time: formatRelativeTime(data.updatedAt),
            unread: !!data.unread && data.lastSenderId !== uid,
            unreadCount: data.unreadCount || 0,
            online: !!data.online,
            avatar: data[`userAvatar_${otherUserId}`] || `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherUserId}`
          };
        });
        setChats(chatsData);
        setLoading(false);
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, path);
        setLoading(false);
      });

      return () => unsubscribe();
    } catch (error) {
      console.warn("Firestore index error:", error);
      setLoading(false);
    }
  }, [auth.currentUser?.uid]);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="pt-12 pb-16"
    >
      {/* Search & Filter Bar */}
      <section className="bg-surface-container px-4 py-3 sticky top-12 z-40">
        <div className="flex gap-2 mb-3 overflow-x-auto hide-scrollbar">
          {filterChips.map((chip, i) => (
            <button 
              key={chip}
              className={`px-3 py-1.5 rounded-[3px] text-[0.6875rem] font-medium uppercase tracking-wider whitespace-nowrap
                ${i === 0 ? 'bg-primary-container text-on-primary-container' : 'bg-surface-container-highest text-primary'}
              `}
            >
              {chip}
            </button>
          ))}
        </div>
        <div className="relative">
          <input 
            className="w-full bg-surface-container-low border-none rounded-[3px] py-2 pl-9 pr-4 text-[0.75rem] focus:ring-1 focus:ring-primary/30 transition-all placeholder:text-on-surface-variant/40" 
            placeholder="Buscar conversas..." 
            type="text"
          />
          <Search size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant/60" />
        </div>
      </section>

      {/* Chat List */}
      <section className="flex flex-col">
        {loading ? (
          <div className="py-12 flex justify-center">
            <Loader2 size={32} className="animate-spin text-primary" />
          </div>
        ) : chats.length === 0 ? (
          <div className="py-12 text-center text-on-surface-variant flex flex-col items-center gap-2">
            <p className="text-[0.875rem] font-medium">Nenhuma mensagem encontrada.</p>
            <p className="text-[0.75rem]">As suas conversas ativas aparecerão aqui.</p>
          </div>
        ) : (
          chats.map((chat) => (
            <div key={chat.id}>
              <div 
                onClick={() => router.push(`/chat/${chat.id}`)}
                className={`px-4 py-4 flex items-center gap-3 cursor-pointer transition-colors active:opacity-80
                ${chat.unread ? 'bg-surface-container-high' : 'bg-surface-container hover:bg-surface-container-high'}
              `}>
              <div className="relative flex-shrink-0">
                <img 
                  src={chat.avatar} 
                  alt={chat.user} 
                  className="w-12 h-12 rounded-[3px] object-cover"
                  referrerPolicy="no-referrer"
                />
                {chat.online && (
                  <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-green-500 border-2 border-surface-container-high rounded-full"></div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-0.5">
                  <h3 className="text-[0.75rem] font-bold text-on-surface truncate">{chat.user}</h3>
                  <span className={`text-[0.6rem] uppercase ${chat.unread ? 'text-primary font-bold' : 'text-on-surface-variant'}`}>{chat.time}</span>
                </div>
                <p className={`text-[0.6875rem] truncate ${chat.unread ? 'text-on-surface font-medium' : 'text-on-surface-variant'}`}>
                  {chat.lastMessage}
                </p>
              </div>
              {chat.unread && !chat.unreadCount && (
                <div className="w-2.5 h-2.5 bg-primary-container rounded-full"></div>
              )}
              {chat.unreadCount && (
                <div className="bg-primary-container text-on-primary-container text-[0.6rem] font-bold px-1.5 py-0.5 rounded-full">
                  {chat.unreadCount}
                </div>
              )}
            </div>
            <div className="h-[5px] bg-background"></div>
          </div>
          ))
        )}
      </section>
    </motion.div>
  );
}
