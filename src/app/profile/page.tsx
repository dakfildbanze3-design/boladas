"use client";

import React, { useState, useEffect } from 'react';
import { Verified, Grid, PlusCircle, Loader2, LogOut } from 'lucide-react';
import { motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { auth, db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';

export default function ProfilePage() {
  const router = useRouter();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [myProducts, setMyProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfileData = async () => {
      if (!auth.currentUser) {
        router.push('/login');
        return;
      }

      try {
        // Fetch user profile
        const userPath = `users/${auth.currentUser.uid}`;
        try {
          const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
          if (userDoc.exists()) {
            setUserProfile(userDoc.data());
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, userPath);
        }

        // Fetch user's products
        const productsPath = 'products';
        try {
          const q = query(collection(db, 'products'), where('sellerId', '==', auth.currentUser.uid));
          const querySnapshot = await getDocs(q);
          const productsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
          setMyProducts(productsData);
        } catch (err) {
          handleFirestoreError(err, OperationType.LIST, productsPath);
        }
      } catch (error) {
        console.error("Erro no ProfilePage:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, [router]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/login');
    } catch (error) {
      console.error("Erro ao sair:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-12 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="pt-12 pb-20"
    >
      {/* Profile Header */}
      <section className="bg-surface-container-low pt-8 pb-6 px-4 relative">
        <button 
          onClick={handleLogout}
          className="absolute top-4 right-4 p-2 text-on-surface-variant hover:text-error transition-colors"
        >
          <LogOut size={20} />
        </button>
        <div className="flex flex-col items-center">
          <div className="relative mb-4">
            <img 
              className="w-24 h-24 rounded-[3px] object-cover border-2 border-primary-container" 
              src={userProfile?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${auth.currentUser?.uid}`} 
              referrerPolicy="no-referrer"
              alt="Avatar"
            />
            <div className="absolute bottom-0 right-0 bg-primary-container p-1 rounded-[3px] translate-x-1 translate-y-1">
              <Verified size={16} className="text-white" fill="currentColor" />
            </div>
          </div>
          <h2 className="text-[1.5rem] font-bold tracking-tight text-on-surface">{userProfile?.displayName || 'Usuário'}</h2>
          <p className="text-[0.75rem] text-on-surface-variant mb-4 uppercase tracking-wider">{userProfile?.location || 'Moçambique'}</p>
          <div className="flex gap-2 justify-center">
            <button 
              onClick={() => router.push('/profile-setup')}
              className="bg-blue-900 text-white text-[0.6875rem] uppercase font-medium px-4 h-8 rounded-[3px] active:scale-95 transition-colors hover:brightness-110 shadow-sm"
            >
              Editar Perfil
            </button>
            <button 
              onClick={() => router.push('/sell-video')}
              className="bg-blue-900 text-white text-[0.6875rem] uppercase font-bold px-4 h-8 rounded-[3px] active:scale-95 transition-colors hover:brightness-110 shadow-sm"
            >
              Anunciar por Vídeo
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-[1px] bg-outline-variant/10 mt-8 -mx-4 border-y border-outline-variant/10">
          <div className="bg-surface py-4 flex flex-col items-center">
            <span className="text-[1.25rem] font-bold text-primary">{myProducts.length}</span>
            <span className="text-[0.625rem] uppercase tracking-wider text-on-surface-variant">Anúncios</span>
          </div>
          <div className="bg-surface py-4 flex flex-col items-center">
            <span className="text-[1.25rem] font-bold text-primary">3.4k</span>
            <span className="text-[0.625rem] uppercase tracking-wider text-on-surface-variant">Seguidores</span>
          </div>
          <div className="bg-surface py-4 flex flex-col items-center">
            <span className="text-[1.25rem] font-bold text-primary">89</span>
            <span className="text-[0.625rem] uppercase tracking-wider text-on-surface-variant">Seguindo</span>
          </div>
        </div>
      </section>

      {/* Novidades 24h - Horizontal Cards */}
      {(() => {
        const recentProducts = myProducts.filter(p => {
          if (!p.createdAt) return false;
          const itemDate = typeof p.createdAt.toDate === 'function' ? p.createdAt.toDate() : new Date(p.createdAt);
          const timeDiff = new Date().getTime() - itemDate.getTime();
          return timeDiff <= 24 * 60 * 60 * 1000;
        });

        if (recentProducts.length === 0) return null;

        return (
          <div className="px-4 py-6 bg-surface border-b border-outline-variant/10">
            <h3 className="text-[0.6875rem] uppercase font-bold tracking-[0.1em] text-on-surface-variant mb-4">Recentes (Últimas 24h)</h3>
            <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-2">
              {recentProducts.map((product) => (
                <div 
                  key={product.id}
                  onClick={() => router.push(`/product/${product.id}`)}
                  className="w-[120px] flex-shrink-0 cursor-pointer group"
                >
                  <div className="aspect-[3/4] rounded-[3px] overflow-hidden bg-surface-container mb-2 relative">
                    <img 
                      src={product.images?.[0] || 'https://picsum.photos/seed/placeholder/800/800'} 
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-2 left-2 bg-primary/90 text-on-primary text-[0.6rem] font-bold px-1.5 py-0.5 rounded-[2px] uppercase">
                      Novo
                    </div>
                  </div>
                  <h4 className="text-[0.75rem] font-medium text-on-surface truncate">{product.name}</h4>
                  <p className="text-[0.6875rem] text-primary mt-0.5">{product.price} MT</p>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Product Grid Header */}
      <div className="flex justify-between items-center px-4 py-4 bg-surface">
        <h3 className="text-[0.6875rem] uppercase font-bold tracking-[0.1em] text-on-surface-variant">Meus Produtos</h3>
        <Grid size={20} className="text-primary" />
      </div>

      {/* Full-Bleed Product Grid */}
      <section className="grid grid-cols-2 gap-[1px] bg-outline-variant/10">
        {myProducts.map((product) => (
          <div 
            key={product.id}
            onClick={() => router.push(`/product/${product.id}`)}
            className="bg-surface aspect-square relative group cursor-pointer"
          >
            <img 
              className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" 
              src={product.images?.[0] || 'https://picsum.photos/seed/placeholder/800/800'} 
              alt={product.name}
              referrerPolicy="no-referrer"
            />
            <div className="absolute bottom-0 left-0 w-full p-3 bg-gradient-to-t from-black/80 to-transparent">
              <div className="text-[0.625rem] uppercase text-primary mb-1">{product.price} MT</div>
              <div className="text-[0.75rem] font-medium text-on-surface truncate">{product.name}</div>
            </div>
          </div>
        ))}
        
        {/* Add New Product Card */}
        <div 
          onClick={() => router.push('/sell')}
          className="bg-surface aspect-square relative group cursor-pointer"
        >
          <div className="w-full h-full bg-surface-container flex flex-col items-center justify-center border-2 border-dashed border-outline-variant/30 hover:bg-surface-container-high transition-colors">
            <PlusCircle size={32} className="text-primary" />
            <span className="text-[0.625rem] uppercase text-on-surface-variant mt-2 font-bold">Novo Item</span>
          </div>
        </div>
      </section>
    </motion.div>
  );
}
