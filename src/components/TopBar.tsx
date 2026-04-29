"use client";

import React, { useState } from 'react';
import { Menu, Search, ArrowLeft, Share2, MoreVertical, Settings, LifeBuoy, HelpCircle, MessageSquare, X } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';

interface TopBarProps {
  showBack?: boolean;
  title?: string;
  rightElement?: React.ReactNode;
}

export default function TopBar({ showBack, title = "Boladas", rightElement }: TopBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const handleMenuClick = () => {
    setIsDrawerOpen(true);
  };

  const closeDrawer = () => {
    setIsDrawerOpen(false);
  };

  const handleBack = () => {
    router.back();
  };

  return (
    <>
      <header className="fixed top-0 w-full z-50 bg-black flex justify-between items-center px-4 h-12">
        <div className="flex items-center gap-4">
          {showBack && (
            <button 
              onClick={handleBack}
              className="text-white hover:bg-surface-container-highest transition-colors p-1 rounded active:scale-95"
            >
              <ArrowLeft size={24} strokeWidth={2.5} />
            </button>
          )}
          <h1 
            className="text-2xl font-bold text-white tracking-tight cursor-pointer"
            onClick={() => router.push('/')}
          >
            {title}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {rightElement ? (
            rightElement
          ) : (
            <>
              {pathname === '/' && (
                <button 
                  onClick={() => router.push('/search')}
                  className="text-white hover:bg-surface-container-highest transition-colors p-1 rounded active:scale-95"
                >
                  <Search size={24} strokeWidth={2.5} />
                </button>
              )}
              {showBack && (
                <>
                  <button className="text-white hover:bg-surface-container-highest transition-colors p-1 rounded active:scale-95">
                    <Share2 size={24} strokeWidth={2.5} />
                  </button>
                  <button className="text-white hover:bg-surface-container-highest transition-colors p-1 rounded active:scale-95">
                    <MoreVertical size={24} strokeWidth={2.5} />
                  </button>
                </>
              )}
              {!showBack && (
                <button 
                  onClick={handleMenuClick}
                  className="text-white hover:bg-surface-container-highest transition-colors p-1 rounded active:scale-95"
                >
                  <Menu size={24} strokeWidth={2.5} />
                </button>
              )}
            </>
          )}
        </div>
      </header>

      <AnimatePresence>
        {isDrawerOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeDrawer}
              className="fixed inset-0 bg-black/60 z-[60] backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 h-full w-max max-w-[85vw] bg-surface z-[70] shadow-2xl flex flex-col pt-safe-top"
            >
              <div className="p-4 flex justify-between items-center border-b border-outline-variant/10">
                <h2 className="text-2xl font-bold text-white tracking-tight">Boladas</h2>
                <button onClick={closeDrawer} className="p-1 text-on-surface-variant hover:text-white transition-colors ml-8">
                  <X size={20} />
                </button>
              </div>
              <nav className="flex flex-col py-4">
                <button onClick={() => { closeDrawer(); router.push('/settings'); }} className="flex items-center gap-4 px-6 py-4 hover:bg-surface-container-high transition-colors text-left">
                  <Settings size={20} strokeWidth={2.5} className="text-white shrink-0" />
                  <span className="text-[0.875rem] font-medium text-on-surface">Definições</span>
                </button>
                <button className="flex items-center gap-4 px-6 py-4 hover:bg-surface-container-high transition-colors text-left">
                  <LifeBuoy size={20} strokeWidth={2.5} className="text-white shrink-0" />
                  <span className="text-[0.875rem] font-medium text-on-surface">Suporte</span>
                </button>
                <button className="flex items-center gap-4 px-6 py-4 hover:bg-surface-container-high transition-colors text-left">
                  <HelpCircle size={20} strokeWidth={2.5} className="text-white shrink-0" />
                  <span className="text-[0.875rem] font-medium text-on-surface">Ajuda</span>
                </button>
                <button className="flex items-center gap-4 px-6 py-4 hover:bg-surface-container-high transition-colors text-left">
                  <MessageSquare size={20} strokeWidth={2.5} className="text-white shrink-0" />
                  <span className="text-[0.875rem] font-medium text-on-surface">Dar a sua opinião sobre o app</span>
                </button>
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
