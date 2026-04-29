"use client";

import React, { useState, useEffect } from 'react';
import { Search, Loader2, Edit, Camera, Facebook, Plus, ArrowLeft } from 'lucide-react';
import { motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { auth, db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { formatRelativeTime } from '../../lib/dateUtils';

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
      className="min-h-screen bg-black text-white pt-4 pb-20"
    >
      {/* Header */}
      <header className="px-4 flex items-center gap-4 mb-4 mt-1">
        <button onClick={() => router.back()} className="text-white active:scale-90 transition-transform">
          <ArrowLeft size={28} strokeWidth={3} />
        </button>
        <h1 className="text-[28px] font-bold tracking-tight text-white" id="header-title">
          messenger
        </h1>
      </header>

      {/* Search Bar */}
      <section className="px-4 mb-5" id="search-section">
        <div className="relative">
          <input 
            className="w-full bg-zinc-800/60 border-none rounded-xl py-2.5 pl-12 pr-4 text-[16px] text-white placeholder:text-zinc-500 focus:outline-none" 
            placeholder="Pesquisar mensagens" 
            type="text"
            id="search-input"
          />
          <Search size={22} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
        </div>
      </section>

      {/* Chat List */}
      <section className="flex flex-col" id="chats-container">
        {loading ? (
          <div className="py-12 flex justify-center">
            <Loader2 size={32} className="animate-spin text-zinc-500" />
          </div>
        ) : chats.length === 0 ? (
          <div className="py-12 text-center text-zinc-500 flex flex-col items-center gap-2">
            <p className="text-[15px] font-medium">Nenhuma mensagem encontrada.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-[5px]">
            {chats.map((chat) => (
              <div 
                key={chat.id}
                id={`chat-item-${chat.id}`}
                onClick={() => router.push(`/chat/${chat.id}`)}
                className="px-4 py-2.5 flex items-center gap-4 cursor-pointer active:bg-zinc-900 transition-colors"
              >
                <div className="relative flex-shrink-0">
                  <img 
                    src={chat.avatar} 
                    alt={chat.user} 
                    className={`w-[60px] h-[60px] rounded-full object-cover ${chat.unread ? 'border-2 border-blue-500 p-0.5' : ''}`}
                    referrerPolicy="no-referrer"
                  />
                  {!chat.unread && chat.online && (
                    <div className="absolute bottom-1 right-1 w-4 h-4 bg-green-500 border-[3px] border-black rounded-full"></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className={`text-[17px] truncate ${chat.unread ? 'font-bold text-white' : 'font-semibold text-zinc-100'}`}>{chat.user}</h3>
                  <div className="flex items-center gap-1.5 overflow-hidden">
                    <p className={`text-[14px] truncate leading-tight ${chat.unread ? 'text-white font-bold' : 'text-zinc-500 font-medium'}`}>
                      {chat.lastMessage}
                    </p>
                    <span className="text-[14px] text-zinc-500">•</span>
                    <span className="text-[14px] text-zinc-500 whitespace-nowrap">{chat.time}</span>
                  </div>
                </div>
                {chat.unread && (
                  <div className="w-3.5 h-3.5 bg-blue-500 rounded-full flex-shrink-0"></div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </motion.div>
  );
}
