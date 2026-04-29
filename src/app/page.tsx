"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MoreVertical, Flag, Share2, Star, Link, X, Loader2, ShoppingBag, MessageSquare, Play, Video } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { db, handleFirestoreError, OperationType, auth } from '../lib/firebase';
import { collection, getDocs, query, orderBy, limit, startAfter, QueryDocumentSnapshot, where } from 'firebase/firestore';
import { formatRelativeTime } from '../lib/dateUtils';
import { shareContent } from '../lib/shareUtils';
import { chatService } from '../services/chatService';
import AdBanner from '../components/AdBanner';

const categories = ['Tudo', 'Sapatilhas', 'Acessórios', 'Roupas', 'Serviços', 'Eletrônicos', 'Automóveis'];

const formatViews = (views: number) => {
  if (!views) return '0';
  if (views >= 1000000) {
    return (views / 1000000).toFixed(1).replace('.', ',') + ' mi';
  }
  if (views >= 1000) {
    return (views / 1000).toFixed(0) + ' mil';
  }
  return views.toString();
};

export default function Home() {
  const router = useRouter();
  
  // UI States
  const [activeOptionsId, setActiveOptionsId] = useState<string | null>(null);
  const [showCategories, setShowCategories] = useState(true);
  const lastScrollY = useRef(0);

  // Scroll listener for categories reveal
  useEffect(() => {
    let ticking = false;
    const scrollThreshold = 10; // Minimum scroll delta to trigger change
    
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;
          const deltaY = currentScrollY - lastScrollY.current;
          
          if (currentScrollY < 10) {
            setShowCategories(true);
          } else if (Math.abs(deltaY) > scrollThreshold) {
            if (deltaY < 0) {
              // Scrolling UP
              setShowCategories(true);
            } else if (currentScrollY > 100 && deltaY > 0) {
              // Scrolling DOWN
              setShowCategories(false);
            }
          }
          
          lastScrollY.current = currentScrollY;
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  // Data States
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  
  // Filter & Pagination States
  const [activeCategory, setActiveCategory] = useState<string>('Tudo');
  const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  
  // Settings
  const [hideShorts, setHideShorts] = useState(false);
  const [showHideShortsPopup, setShowHideShortsPopup] = useState(false);

  useEffect(() => {
    const checkSettings = async () => {
      if (auth.currentUser) {
        try {
          const { getDoc, doc } = await import('firebase/firestore');
          const docSnap = await getDoc(doc(db, 'user_settings', auth.currentUser.uid));
          if (docSnap.exists() && docSnap.data().hideShorts) {
            setHideShorts(true);
          }
        } catch (error: any) {
          console.error(error?.message || String(error));
        }
      }
    };
    
    // Check when auth state changes
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) checkSettings();
    });
    return () => unsubscribe();
  }, []);

  const handleHideShorts = async () => {
    if (!auth.currentUser) {
      alert("Faça login para salvar suas preferências.");
      router.push('/login');
      return;
    }
    
    try {
      const { setDoc, doc } = await import('firebase/firestore');
      await setDoc(doc(db, 'user_settings', auth.currentUser.uid), { hideShorts: true }, { merge: true });
      setHideShorts(true);
      setShowHideShortsPopup(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `user_settings/${auth.currentUser?.uid}`);
    }
  };

  // Infinite Scroll Observer setup
  const observer = useRef<IntersectionObserver | null>(null);
  const lastElementRef = useCallback((node: HTMLDivElement | null) => {
    if (loading || loadingMore) return;
    if (observer.current) observer.current.disconnect();
    
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        fetchProducts(true);
      }
    });
    
    if (node) observer.current.observe(node);
  }, [loading, loadingMore, hasMore]);

  const fetchProducts = async (isLoadMore = false) => {
    if (isLoadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const constraints: any[] = [];

      if (activeCategory !== 'Tudo') {
        constraints.push(where('category', '==', activeCategory));
      }

      // Order By
      constraints.push(orderBy('createdAt', 'desc'));

      // Pagination
      if (isLoadMore && lastVisible) {
        constraints.push(startAfter(lastVisible));
      }
      
      constraints.push(limit(20));

      const q = query(collection(db, 'products'), ...constraints);
      const querySnapshot = await getDocs(q);
      
      const newProducts = querySnapshot.docs.map(doc => {
        const data = doc.data() as any;
        return {
          id: doc.id,
          ...data,
          author: data.sellerName || 'Usuário',
          avatar: data.sellerAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${data.sellerId}`,
          time: data.createdAt ? formatRelativeTime(data.createdAt) : 'Agora',
          views: data.views || 0,
          likesCount: data.likesCount || (data.likedBy?.length || 0),
          commentsCount: data.commentsCount || 0,
          image: data.images && data.images.length > 0 ? data.images[0] : 'https://picsum.photos/seed/placeholder/800/800'
        };
      });

      if (isLoadMore) {
        setProducts(prev => [...prev, ...newProducts]);
      } else {
        setProducts(newProducts);
      }

      // Setup for next page
      setLastVisible(querySnapshot.docs[querySnapshot.docs.length - 1] || null);
      setHasMore(querySnapshot.docs.length === 20);

    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'products');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Re-fetch automatically when filters change
  useEffect(() => {
    fetchProducts(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory]);

  const closeOptions = () => setActiveOptionsId(null);

  const handleMessageClick = async () => {
    if (!auth.currentUser) {
      alert("Faça login para enviar mensagens");
      router.push('/login');
      return;
    }
    const product = products.find(p => p.id === activeOptionsId);
    if (!product || !product.sellerId) return;

    try {
      const chatId = await chatService.getOrCreateChat(
        product.sellerId,
        product.sellerName || product.author,
        product.sellerAvatar || product.avatar
      );
      router.push(`/chat/${chatId}`);
      closeOptions();
    } catch (error: any) {
      alert(error.message);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="pt-12 pb-16"
    >
      {/* categories section */}
      <motion.section 
        initial={{ y: 0 }}
        animate={{ y: showCategories ? 0 : -100 }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        className="sticky top-12 w-full max-w-md bg-surface z-40 border-b border-outline-variant/5 shadow-sm"
      >
        <div className="flex gap-2 overflow-x-auto hide-scrollbar px-4 py-2 bg-surface">
          {categories.map((cat) => (
            <div 
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`flex-shrink-0 px-4 py-2 rounded-[6px] text-sm font-bold cursor-pointer transition-all active:scale-95 text-center
                ${activeCategory === cat ? 'bg-white text-zinc-900 shadow-sm' : 'bg-zinc-800 text-white hover:bg-zinc-700'}
              `}
            >
              {cat}
            </div>
          ))}
        </div>
      </motion.section>

      {/* Featured Shorts Shelf */}
      {!loading && !hideShorts && products.some(p => p.productType === 'short') && (
        <section className="bg-surface pb-4 border-b border-outline-variant/10">
          <div className="flex items-center justify-between w-full px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-[#007AFF] rounded-full flex items-center justify-center">
                <Play size={14} className="text-white fill-current" />
              </div>
              <h2 className="text-[20px] font-bold text-on-surface tracking-tight">Shorts</h2>
            </div>
            <div className="relative">
              <button 
                onClick={() => setHideShorts(true)} 
                className="text-white active:scale-95 transition-all outline-none"
              >
                <X size={20} strokeWidth={3} />
              </button>
              
              <AnimatePresence>
                {showHideShortsPopup && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 5 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 5 }}
                    className="absolute right-0 top-8 z-50 overflow-hidden"
                  >
                    <button 
                      onClick={handleHideShorts}
                      className="flex border border-outline-variant/30 items-center justify-center gap-2 px-4 py-2 bg-surface-container-high rounded-[8px] text-white font-bold tracking-tight shadow-md hover:bg-surface-container-highest whitespace-nowrap"
                    >
                      <X size={16} strokeWidth={3} className="text-white" />
                      ESCONDER
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-[5px] px-[5px]">
            {products.filter((p: any) => p.productType === 'short').map((product: any) => (
              <div 
                key={`short-${product.id}`}
                onClick={() => router.push(`/short/${product.id}`)}
                className="w-full h-[350px] rounded-[12px] overflow-hidden cursor-pointer relative bg-zinc-900 group"
              >
                {product.videoUrl ? (
                  <video 
                    src={product.videoUrl} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    muted
                    loop
                    playsInline
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-zinc-800">
                    <Play size={24} className="text-white/30" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
                <div className="absolute bottom-0 left-0 w-full p-2.5">
                  <h3 className="text-white text-[11px] font-bold leading-tight line-clamp-3">
                    {product.name}
                    {product.description && (
                      <span className="font-normal opacity-90 ml-1">
                        - {product.description}
                      </span>
                    )}
                  </h3>
                  <p className="text-white/60 text-[9px] mt-1 font-medium">{formatViews(product.views)} visualizações</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Main Video Feed */}
      <div className="flex flex-col bg-background gap-[5px]">
        {loading ? (
          <div className="py-12 flex justify-center">
            <Loader2 size={32} className="animate-spin text-zinc-800" />
          </div>
        ) : products.filter((p: any) => p.productType !== 'short').length === 0 ? (
          <div className="py-12 px-6 flex flex-col items-center text-center text-on-surface-variant">
            <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center mb-4">
              <Video size={24} className="text-on-surface-variant/50" />
            </div>
            <h3 className="font-bold text-on-surface uppercase tracking-widest text-[0.875rem] mb-2">Sem vídeos ainda</h3>
            <p className="text-[0.75rem] max-w-[200px] leading-relaxed opacity-80">
              Nenhum vídeo publicado nesta categoria até o momento.
            </p>
          </div>
        ) : (
          <>
            {products.filter((p: any) => p.productType !== 'short').map((product, index) => (
              <React.Fragment key={product.id}>
                <VideoCard 
                  product={product}
                  onClick={() => router.push(`/product/${product.id}`)}
                  onMoreClick={(id, e) => {
                    e.stopPropagation();
                    setActiveOptionsId(id);
                  }}
                />
                
                {/* Insert Ad every 6 items */}
                {(index + 1) % 6 === 0 && (
                  <div className="bg-surface py-2 border-b border-outline-variant/10">
                    <p className="text-center text-[0.625rem] text-on-surface-variant/50 uppercase tracking-widest mb-2">Publicidade</p>
                    <AdBanner dataAdSlot="6870833164" />
                  </div>
                )}
              </React.Fragment>
            ))}
            
            
            {/* Infinite Scroll Loader Target */}
            <div ref={lastElementRef} className="py-8 flex justify-center bg-background">
              {loadingMore ? (
                <Loader2 size={24} className="animate-spin text-zinc-800" />
              ) : !hasMore && products.length > 0 ? (
                <p className="text-[0.625rem] text-on-surface-variant uppercase font-bold tracking-widest">
                  FIM DA LISTA
                </p>
              ) : null}
            </div>
          </>
        )}
      </div>

      {/* Options Bottom Sheet for Products */}
      <AnimatePresence>
        {activeOptionsId && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeOptions}
              className="fixed inset-0 bg-black/60 z-[60] backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 w-full bg-surface-container-high rounded-t-xl z-[70] pb-safe flex flex-col overflow-hidden"
            >
              <div className="p-4 flex justify-between items-center border-b border-outline-variant/10">
                <h3 className="text-[0.875rem] font-bold text-on-surface uppercase tracking-tight">Opções</h3>
                <button onClick={closeOptions} className="p-1 text-on-surface-variant hover:text-zinc-800 transition-colors rounded-full">
                  <X size={20} />
                </button>
              </div>
              <div className="flex flex-col py-2">
                <button 
                  onClick={handleMessageClick}
                  className="flex items-center gap-4 px-6 py-4 hover:bg-surface-container-highest transition-colors text-left w-full"
                >
                  <MessageSquare size={20} className="text-on-surface-variant" />
                  <span className="text-[0.875rem] font-medium text-on-surface">Enviar Mensagem</span>
                </button>
                <button 
                  onClick={() => { /* Handle report */ closeOptions(); }}
                  className="flex items-center gap-4 px-6 py-4 hover:bg-surface-container-highest transition-colors text-left w-full"
                >
                  <Flag size={20} className="text-on-surface-variant" />
                  <span className="text-[0.875rem] font-medium text-on-surface">Denunciar</span>
                </button>
                <button 
                  onClick={() => { 
                    const p = products.find(prod => prod.id === activeOptionsId);
                    if (p) {
                      shareContent(
                        p.name,
                        `Olha este anúncio no Bazar: ${p.name} - ${p.price} MT`,
                        `${window.origin}/product/${p.id}`
                      );
                    }
                    closeOptions(); 
                  }}
                  className="flex items-center gap-4 px-6 py-4 hover:bg-surface-container-highest transition-colors text-left w-full"
                >
                  <Share2 size={20} className="text-on-surface-variant" />
                  <span className="text-[0.875rem] font-medium text-on-surface">Compartilhar</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Memoized Video Card Item (YouTube Style)
const VideoCard = React.memo(({ product, onMoreClick, onClick }: { 
  product: any, 
  onMoreClick: (id: string, e: React.MouseEvent) => void,
  onClick: () => void 
}) => {
  return (
    <article 
      onClick={onClick}
      className="bg-surface pb-3 cursor-pointer overflow-hidden border-b border-outline-variant/5"
    >
      {/* Thumbnail */}
      <div className="w-full aspect-video bg-zinc-900 relative">
        {product.videoUrl ? (
          <video 
            src={product.videoUrl} 
            className="w-full h-full object-cover"
            muted
            loop
            playsInline
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-zinc-800">
            <Play size={32} className="text-white/30" />
          </div>
        )}
        
        {/* Status Badges */}
        <div className="absolute top-2 left-2 flex gap-1">
          {product.discount && (
            <div className="bg-red-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded-[2px] uppercase">
              OFERTA
            </div>
          )}
        </div>

        {/* Video Duration Mock */}
        <div className="absolute bottom-2 right-2 bg-black/80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-[2px]">
          {product.duration || '5:33'}
        </div>
      </div>
      
      {/* Footer Info */}
      <div className="px-3 py-3 flex gap-3">
        <div 
          className="flex-shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            // Optional: navigate to profile
          }}
        >
          <img 
            src={product.avatar} 
            alt={product.author} 
            className="w-10 h-10 rounded-full object-cover border border-outline-variant/10 shadow-sm"
            referrerPolicy="no-referrer"
          />
        </div>
        
        <div className="mt-1 flex-1 flex flex-col min-w-0">
          <h3 className="text-[16px] font-bold text-on-surface line-clamp-3 leading-tight break-words">
            {product.name}
            {product.description && (
              <span className="text-on-surface-variant text-[14px] font-normal ml-1">
                - {product.description}
              </span>
            )}
          </h3>
          <p className="text-[12px] text-on-surface-variant font-medium mt-1 truncate">
            {product.author} • {formatViews(product.views)} visualizações • {product.time}
          </p>
        </div>
      </div>
    </article>
  );
});

VideoCard.displayName = 'VideoCard';
