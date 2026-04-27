"use client";

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import TopBar from '../../components/TopBar';
import BottomNav from '../../components/BottomNav';
import { auth } from '../../lib/firebase';
import { notificationService } from '../../services/notificationService';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Register Service Worker
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then((registration) => {
          console.log('SW registered: ', registration);
        }).catch((registrationError) => {
          console.log('SW registration failed: ', registrationError);
        });
      });
    }

    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUser(user);
      setLoading(false);
      
      if (user) {
        // Register FCM Token
        notificationService.saveFCMToken(user.uid);
      }

      const isAuthPage = ['/login', '/register', '/profile-setup'].includes(pathname);
      if (!user && !isAuthPage) {
        router.push('/login');
      }
    });
    return () => unsubscribe();
  }, [pathname, router]);

  const isProductDetail = pathname.startsWith('/product/');
  const isPublicProfile = pathname.startsWith('/user/');
  const isSettings = pathname === '/settings';
  const isSell = pathname === '/sell';
  const isSellVideo = pathname === '/sell-video';
  const isShortPlayer = pathname.startsWith('/short/');
  const isAuthPage = ['/login', '/register', '/profile-setup'].includes(pathname);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-on-surface">
      {!isAuthPage && !isShortPlayer && (
        <TopBar 
          showBack={isProductDetail || isPublicProfile || isSettings || isSell || isSellVideo} 
          title={isProductDetail ? "PRODUTO" : isPublicProfile ? "PERFIL" : isSettings ? "DEFINIÇÕES" : isSell ? "VENDER" : isSellVideo ? "VENDER VIDEO" : "BOLADAS"}
          rightElement={(isSell || isSellVideo) ? (
            <button 
              onClick={() => {
                const form = document.getElementById(isSell ? 'sell-form' : 'sell-video-form') as HTMLFormElement;
                if (form) form.requestSubmit();
              }}
              className="text-[#007AFF] font-bold text-[0.875rem] px-2 py-1 active:opacity-50 transition-opacity"
            >
              PUBLICAR
            </button>
          ) : undefined}
        />
      )}
      
      <main className={`max-w-md mx-auto relative`}>
        {children}
      </main>

      {!isProductDetail && !isAuthPage && !isShortPlayer && <BottomNav />}
    </div>
  );
}
