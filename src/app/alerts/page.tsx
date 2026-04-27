"use client";

import React, { useState, useEffect } from 'react';
import { Heart, MessageSquare, UserPlus, Loader2, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import { auth } from '../../lib/firebase';
import { notificationService, AppNotification } from '../../services/notificationService';
import { useRouter } from 'next/navigation';
import { formatRelativeTime } from '../../lib/dateUtils';

export default function AlertsPage() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setLoading(false);
      return;
    }

    const unsubscribe = notificationService.subscribeToNotifications(
      uid,
      (notifs) => {
        setNotifications(notifs);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [auth.currentUser?.uid]);

  const handleMarkAsRead = async (id: string, postId?: string) => {
    await notificationService.markAsRead(id);
    if (postId) {
      router.push(`/short/${postId}`);
    }
  };

  const handleMarkAllRead = async () => {
    if (auth.currentUser) {
      await notificationService.markAllAsRead(auth.currentUser.uid);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'like': return <Heart size={18} className="text-red-500 fill-red-500" />;
      case 'comment': return <MessageSquare size={18} className="text-blue-500" />;
      case 'follow': return <UserPlus size={18} className="text-green-500" />;
      default: return <Heart size={18} />;
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="pt-12 pb-16 min-h-screen bg-black"
    >
      {/* Header */}
      <div className="bg-zinc-900/50 backdrop-blur-md px-4 py-4 flex justify-between items-center border-b border-white/5 sticky top-0 z-10">
        <h2 className="text-[1.25rem] font-bold text-white">Notificações</h2>
        <button 
          onClick={handleMarkAllRead}
          className="text-primary text-[0.75rem] font-bold flex items-center gap-1.5 hover:opacity-80 transition-opacity"
        >
          <CheckCircle2 size={14} />
          Lido
        </button>
      </div>

      {/* List */}
      <div className="flex flex-col">
        {loading ? (
          <div className="py-20 flex justify-center">
            <Loader2 size={32} className="animate-spin text-primary" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-20 text-center flex flex-col items-center gap-4 px-8">
            <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center text-zinc-700">
              <Heart size={32} />
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-[0.9375rem] font-bold text-white">Sem novidades por agora</p>
              <p className="text-[0.8125rem] text-zinc-500">Quando alguém interagir contigo, as notificações aparecerão aqui.</p>
            </div>
          </div>
        ) : (
          notifications.map((notif) => (
            <div 
              key={notif.id}
              onClick={() => handleMarkAsRead(notif.id, notif.postId)}
              className={`p-4 flex gap-3 items-center border-b border-white/5 transition-colors cursor-pointer ${notif.read ? 'bg-transparent opacity-60' : 'bg-primary/5 border-l-2 border-l-primary'}`}
            >
              <div className="relative">
                <img 
                  src={(notif as any).fromUserAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${notif.fromUserId}`} 
                  className="w-10 h-10 rounded-full object-cover border border-white/10"
                  referrerPolicy="no-referrer"
                  alt="Avatar"
                />
                <div className="absolute -bottom-1 -right-1 bg-black rounded-full p-1 border border-white/10">
                  {getIcon(notif.type)}
                </div>
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="text-[0.8125rem] text-white leading-snug">
                  <span className="font-bold">{(notif as any).fromUserName || 'Alguém'}</span> {notif.text}
                </p>
                <p className="text-[0.6875rem] text-zinc-500 mt-1">{formatRelativeTime(notif.createdAt)}</p>
              </div>

              {!notif.read && (
                <div className="w-2 h-2 bg-primary rounded-full shrink-0"></div>
              )}
            </div>
          ))
        )}
      </div>
    </motion.div>
  );
}
