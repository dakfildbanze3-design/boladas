"use client";

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { 
  ArrowLeft, 
  MoreVertical, 
  ChevronDown, 
  Image as ImageIcon, 
  Camera, 
  Plus, 
  Smile, 
  Mic,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth } from '../../../lib/firebase';
import { chatService, Message, ChatRoom } from '../../../services/chatService';

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

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !chatId) return;

    const text = inputText.trim();
    setInputText('');
    
    try {
      await chatService.sendMessage(chatId, text);
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
    }
  };

  const formatTime = (date: any) => {
    if (!date) return '';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading && !messages.length) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-white/40" size={32} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-black text-white overflow-hidden font-sans">
      {/* Header */}
      <header className="px-3 py-4 flex items-center justify-between border-b border-white/5 bg-black z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1 active:scale-90 transition-transform">
            <ArrowLeft size={24} strokeWidth={1.5} />
          </button>
          <div 
            className="flex items-center gap-2.5 cursor-pointer active:opacity-70 transition-opacity"
            onClick={() => room?.otherUser && router.push(`/user/${room.otherUser.id}`)}
          >
            <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center overflow-hidden border border-white/5 shadow-inner">
               {room?.otherUser?.avatarUrl ? (
                 <img 
                   src={room.otherUser.avatarUrl} 
                   className="w-full h-full object-cover" 
                   alt="Avatar"
                   referrerPolicy="no-referrer"
                 />
               ) : (
                 <span className="text-white font-bold text-lg">
                   {room?.otherUser?.displayName?.charAt(0).toUpperCase() || 'M'}
                 </span>
               )}
            </div>
            <div className="flex flex-col">
              <span className="text-[17px] font-bold tracking-tight leading-tight">
                {room?.otherUser?.displayName || 'Messenger'}
              </span>
              <span className="text-[12px] text-zinc-500 font-medium leading-tight">Ativo agora</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 px-2">
          <Camera size={22} className="text-blue-500" />
          <MoreVertical size={22} className="text-blue-500" />
        </div>
      </header>

      {/* Messages Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 flex flex-col gap-2 pt-8 pb-4 scroll-smooth hide-scrollbar bg-black"
      >
        {/* Warning Section (Matching Screenshot) */}
        <div className="flex flex-col items-center text-center px-10 mb-8 animate-in fade-in slide-in-from-top-4 duration-700">
          <p className="text-[13px] leading-snug text-white/40 mb-4 max-w-xs font-light">
            Esta mensagem é de um número não guardado. Tenha cuidado com smishing e phishing.
          </p>
          <button className="border border-white/20 rounded-full px-7 py-2.5 text-[14px] font-medium active:scale-95 transition-all hover:bg-white/5">
            Bloquear número
          </button>
        </div>

        {/* Date Placeholder */}
        <div className="flex justify-center mb-6">
          <span className="text-[13px] text-white/30 font-light italic">
            segunda-feira, 27 de abril
          </span>
        </div>

        {/* Message Rendering */}
        <AnimatePresence initial={false}>
          {messages.map((msg, idx) => {
            const isMe = msg.senderId === auth.currentUser?.uid;
            
            return (
              <motion.div 
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                key={msg.id}
                className={`flex mb-1 ${isMe ? 'justify-end' : 'justify-start items-end gap-2'}`}
              >
                {!isMe && (
                  <div className="flex flex-col gap-1 max-w-[85%]">
                    <div className="flex items-end gap-2">
                      <div className="bg-[#3D2C28] text-white px-4 py-2.5 rounded-[22px] rounded-bl-[4px] text-[15.5px] shadow-sm leading-tight">
                        {msg.text}
                      </div>
                      <span className="text-[11px] text-white/30 mb-1 shrink-0">
                        {formatTime(msg.createdAt)}
                      </span>
                    </div>
                  </div>
                )}
                
                {isMe && (
                  <div className="flex items-end gap-2 max-w-[85%]">
                    <span className="text-[11px] text-white/30 mb-1 shrink-0">
                      {formatTime(msg.createdAt)}
                    </span>
                    <div className="bg-[#262626] text-white px-4 py-2.5 rounded-[22px] rounded-br-[4px] text-[15.5px] shadow-sm leading-tight border border-white/5">
                      {msg.text}
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Modern Bottom Input Area */}
      <div className="px-2 pb-6 pt-1 bg-black border-t border-white/5">
        <div className="flex items-center gap-2">
           <div className="flex items-center gap-3 text-blue-500 px-1">
             <button className="active:scale-90 transition-transform"><Plus size={22} strokeWidth={2.5} /></button>
             <button className="active:scale-90 transition-transform"><Camera size={22} strokeWidth={2} /></button>
             <button className="active:scale-90 transition-transform"><ImageIcon size={22} strokeWidth={2} /></button>
             <button className="active:scale-90 transition-transform"><Mic size={22} strokeWidth={2} /></button>
           </div>
           
           <div className="flex-1 bg-zinc-900/80 rounded-full flex items-center px-4 py-0.5 border border-white/5 shadow-inner transition-all">
             <input 
               type="text"
               value={inputText}
               onChange={(e) => setInputText(e.target.value)}
               onKeyDown={(e) => e.key === 'Enter' && handleSend()}
               placeholder="Mensagem"
               className="flex-1 bg-transparent border-none outline-none text-white py-1.5 text-[15px] placeholder:text-zinc-600"
             />
             <button className="text-blue-500/80 hover:text-blue-500 transition-colors ml-1">
               <Smile size={20} strokeWidth={2} />
             </button>
           </div>
           
           {inputText.trim() && (
             <button 
               className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-500 text-white transition-all active:scale-90"
               onClick={() => handleSend()}
             >
               <Plus className="rotate-45" size={18} strokeWidth={3} />
             </button>
           )}
        </div>
      </div>
    </div>
  );
}

