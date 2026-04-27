"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Send, Loader2, Phone, MoreVertical } from 'lucide-react';
import { motion } from 'motion/react';
import { auth } from '../../../lib/firebase';
import { chatService, Message, ChatRoom } from '../../../services/chatService';
import { formatRelativeTime } from '../../../lib/dateUtils';

export default function ChatDetail() {
  const params = useParams();
  const chatId = params.chatId as string;
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [room, setRoom] = useState<ChatRoom | null>(null);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chatId || !auth.currentUser) return;

    setLoading(true);
    
    // Subscribe to messages
    const unsubMessages = chatService.subscribeToMessages(chatId, (msgs) => {
      setMessages(msgs);
      setLoading(false);
    });

    // Subscribe to room info
    const unsubRoom = chatService.subscribeToChatRoom(chatId, (roomData) => {
      setRoom(roomData);
    });

    return () => {
      unsubMessages();
      unsubRoom();
    };
  }, [chatId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !chatId) return;

    const text = inputText.trim();
    setInputText('');
    
    try {
      await chatService.sendMessage(chatId, text);
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
    }
  };

  if (loading && !messages.length) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="bg-surface-container/80 backdrop-blur-md px-4 py-3 flex items-center justify-between sticky top-0 z-50 border-b border-outline-variant/10">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1 -ml-1 text-on-surface hover:bg-surface-container-highest rounded-full transition-colors active:scale-95">
            <ArrowLeft size={24} />
          </button>
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => room?.otherUser && router.push(`/user/${room.otherUser.id}`)}>
            <img 
              src={room?.otherUser?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${chatId}`}
              className="w-9 h-9 rounded-full object-cover border border-outline-variant/30"
              alt="Avatar"
              referrerPolicy="no-referrer"
            />
            <div className="flex flex-col">
              <span className="text-[0.875rem] font-bold text-on-surface leading-none mb-0.5">{room?.otherUser?.displayName || 'Carregando...'}</span>
              <span className="text-[0.625rem] text-primary font-bold uppercase tracking-widest leading-none">Online</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button className="p-2 text-on-surface-variant hover:bg-surface-container-highest rounded-full active:scale-95 transition-all">
            <Phone size={20} />
          </button>
          <button className="p-2 text-on-surface-variant hover:bg-surface-container-highest rounded-full active:scale-95 transition-all">
            <MoreVertical size={20} />
          </button>
        </div>
      </header>

      {/* Messages Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-4 scroll-smooth hide-scrollbar"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-10 opacity-40">
            <p className="text-[0.875rem] font-medium">Inicia uma conversa segura.</p>
            <p className="text-[0.75rem]">As tuas mensagens são privadas.</p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isMe = msg.senderId === auth.currentUser?.uid;
            return (
              <motion.div 
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                key={msg.id}
                className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[75%] px-4 py-2.5 rounded-[12px] shadow-sm relative ${
                  isMe ? 'bg-blue-900 text-white rounded-tr-none' : 'bg-surface-container-high text-on-surface rounded-tl-none border border-outline-variant/10'
                }`}>
                  <p className="text-[0.875rem] leading-relaxed break-words">{msg.text}</p>
                  <div className={`text-[0.6rem] mt-1 flex items-center gap-1.5 ${isMe ? 'text-white/60 justify-end' : 'text-on-surface-variant'}`}>
                    {formatRelativeTime(msg.createdAt)}
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-surface-container/60 backdrop-blur-sm border-t border-outline-variant/10">
        <form onSubmit={handleSend} className="flex items-center gap-2">
          <div className="flex-1 relative">
            <input 
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Escreve uma mensagem..."
              className="w-full bg-surface-container-low border-none rounded-[3px] py-3 pl-4 pr-10 text-[0.875rem] focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-on-surface-variant/30"
            />
          </div>
          <button 
            type="submit"
            disabled={!inputText.trim()}
            className="w-11 h-11 bg-blue-900 text-white rounded-[3px] flex items-center justify-center active:scale-90 transition-transform disabled:opacity-50 disabled:active:scale-100 shadow-md shadow-blue-900/20"
          >
            <Send size={20} className={inputText.trim() ? "translate-x-0.5" : ""} />
          </button>
        </form>
      </div>
    </div>
  );
}
