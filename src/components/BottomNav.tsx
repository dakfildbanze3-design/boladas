"use client";

import React, { useState, useEffect } from 'react';
import { Home, MessageSquare, PlusSquare, Heart, User } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { notificationService } from '../services/notificationService';
import { auth } from '../lib/firebase';

export default function BottomNav() {
  const [unreadCount, setUnreadCount] = useState(0);
  const pathname = usePathname();

  useEffect(() => {
    if (!auth.currentUser) return;

    const unsubscribe = notificationService.subscribeToUnreadCount(
      auth.currentUser.uid,
      (count) => setUnreadCount(count)
    );

    return () => unsubscribe();
  }, [auth.currentUser?.uid]);

  const navItems = [
    { icon: Home, label: 'início', path: '/' },
    { icon: MessageSquare, label: 'chat', path: '/chat' },
    { icon: PlusSquare, label: 'vender', path: '/sell' },
    { icon: Heart, label: 'alertas', path: '/alerts', badge: unreadCount },
    { icon: User, label: 'perfil', path: '/profile' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 w-full flex justify-around items-center h-14 px-2 bg-black z-50 border-t border-outline-variant/10">
      {navItems.map((item) => {
        const isActive = pathname === item.path || (item.path !== '/' && pathname.startsWith(item.path));
        return (
          <Link
            key={item.path}
            href={item.path}
            className={`
              flex flex-col items-center justify-center pt-1 transition-all relative w-full
              ${isActive ? 'text-white border-t-2 border-white' : 'text-white/60 hover:text-white'}
            `}
          >
            <item.icon size={20} strokeWidth={3} fill={item.path === '/profile' ? 'currentColor' : 'none'} />
            <span className="text-[0.6875rem] font-medium mt-0.5">{item.label}</span>
            {item.badge !== undefined && item.badge > 0 && (
              <span className="absolute top-1 right-1/2 translate-x-4 bg-primary text-black text-[0.625rem] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-black">
                {item.badge > 9 ? '9+' : item.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
