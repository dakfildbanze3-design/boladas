"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Heart, MessageSquare, UserPlus, Loader2, CheckCircle2, ArrowLeft } from 'lucide-react';
import { motion } from 'motion/react';
import { auth } from '../../lib/firebase';
import { notificationService, AppNotification } from '../../services/notificationService';
import { useRouter } from 'next/navigation';

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

  const formatShortTime = (date: any) => {
    if (!date) return 'agora';
    const postDate = date.toDate ? date.toDate() : new Date(date);
    const now = new Date();
    const diffInMs = now.getTime() - postDate.getTime();
    const diffInSeconds = Math.floor(diffInMs / 1000);
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);
    const diffInWeeks = Math.floor(diffInDays / 7);

    if (diffInSeconds < 60) return 'agora';
    if (diffInMinutes < 60) return `${diffInMinutes} m`;
    if (diffInHours < 24) return `${diffInHours} h`;
    if (diffInDays < 7) return `${diffInDays} d`;
    if (diffInWeeks < 4) return `${diffInWeeks} sem`;
    return `${Math.floor(diffInDays / 30)} m`;
  };

  // Group notifications
  const groups = useMemo(() => {
    const now = new Date();
    const today: AppNotification[] = [];
    const thisWeek: AppNotification[] = [];
    const thisMonth: AppNotification[] = [];
    const older: AppNotification[] = [];

    notifications.forEach(n => {
      const date = n.createdAt?.toDate ? n.createdAt.toDate() : new Date(n.createdAt);
      const diffInMs = now.getTime() - date.getTime();
      const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

      if (diffInDays < 1) today.push(n);
      else if (diffInDays < 7) thisWeek.push(n);
      else if (diffInDays < 30) thisMonth.push(n);
      else older.push(n);
    });

    return { today, thisWeek, thisMonth, older };
  }, [notifications]);

  const renderNotificationItem = (notif: AppNotification) => {
    const fromUserName = (notif as any).fromUserName || 'Alguém';
    const fromUserAvatar = (notif as any).fromUserAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${notif.fromUserId}`;

    return (
      <div 
        key={notif.id}
        onClick={() => handleMarkAsRead(notif.id, notif.postId)}
        className={`px-4 py-3 flex gap-3 items-center transition-colors cursor-pointer active:bg-zinc-900 border-none relative`}
      >
        <div className="relative shrink-0">
          <img 
            src={fromUserAvatar} 
            className="w-12 h-12 rounded-full object-cover border border-white/5"
            referrerPolicy="no-referrer"
            alt="Avatar"
          />
        </div>
        
        <div className="flex-1 min-w-0 pr-2">
          <p className="text-[14px] text-white leading-tight">
            <span className="font-bold">{fromUserName}</span> {notif.text}{' '}
            <span className="text-zinc-500 text-[13px] whitespace-nowrap ml-1">{formatShortTime(notif.createdAt)}</span>
          </p>
        </div>

        {notif.type === 'follow' && (
          <button className="bg-blue-500 text-white font-bold text-[13px] px-5 py-1.5 rounded-[8px] shrink-0 active:scale-95 transition-transform">
            Seguir
          </button>
        )}

        {!notif.read && (
          <div className="absolute right-4 w-2 h-2 bg-blue-500 rounded-full"></div>
        )}
      </div>
    );
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-black pt-safe pb-20"
    >
      {/* Header */}
      <div className="px-4 py-4 flex items-center gap-6 sticky top-0 bg-black/95 backdrop-blur-md z-40">
        <button onClick={() => router.back()} className="text-white active:scale-90 transition-transform">
          <ArrowLeft size={28} />
        </button>
        <h2 className="text-[22px] font-bold text-white tracking-tight">Notificações</h2>
      </div>

      <div className="flex flex-col gap-[5px] py-1">
        {loading ? (
          <div className="py-20 flex justify-center">
            <Loader2 size={32} className="animate-spin text-zinc-500" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-20 text-center flex flex-col items-center gap-[5px] px-8">
            <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center text-zinc-700">
              <Heart size={32} />
            </div>
            <div className="flex flex-col gap-[2px]">
              <p className="text-[0.9375rem] font-bold text-white">Sem novidades por agora</p>
              <p className="text-[0.8125rem] text-zinc-400">As interações aparecerão aqui.</p>
            </div>
          </div>
        ) : (
          <>
            {groups.today.length > 0 && (
              <section className="flex flex-col gap-[2px]">
                <h3 className="px-4 text-[16px] font-bold text-white mb-1">Hoje</h3>
                <div className="flex flex-col gap-[2px]">
                  {groups.today.map(renderNotificationItem)}
                </div>
              </section>
            )}

            {groups.thisWeek.length > 0 && (
              <section className="flex flex-col gap-[2px] mt-4">
                <h3 className="px-4 text-[16px] font-bold text-white mb-1">Esta semana</h3>
                <div className="flex flex-col gap-[2px]">
                  {groups.thisWeek.map(renderNotificationItem)}
                </div>
              </section>
            )}

            {groups.thisMonth.length > 0 && (
              <section className="flex flex-col gap-[2px] mt-4">
                <h3 className="px-4 text-[16px] font-bold text-white mb-1">Este mês</h3>
                <div className="flex flex-col gap-[2px]">
                  {groups.thisMonth.map(renderNotificationItem)}
                </div>
              </section>
            )}

            {groups.older.length > 0 && (
              <section className="flex flex-col gap-[2px] mt-4">
                <h3 className="px-4 text-[16px] font-bold text-white mb-1">Anteriormente</h3>
                <div className="flex flex-col gap-[2px]">
                  {groups.older.map(renderNotificationItem)}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}
