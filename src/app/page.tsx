"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MoreVertical, Flag, Share2, Star, Link, X, Loader2, ShoppingBag, MessageSquare, Play } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { db, handleFirestoreError, OperationType, auth } from '../lib/firebase';
import { collection, getDocs, query, orderBy, limit, startAfter, QueryDocumentSnapshot, where } from 'firebase/firestore';
import { formatRelativeTime } from '../lib/dateUtils';
import { shareContent } from '../lib/shareUtils';
import { chatService } from '../services/chatService';
import AdBanner from '../components/AdBanner';

const categories = ['TUDO', 'SAPATILHAS', 'ACESSÓRIOS', 'ROUPAS', 'SERVIÇOS', 'ELETRÔNICOS'];

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
  const [activeCategory, setActiveCategory] = useState<string>('TUDO');
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
        } catch (error) {
          console.error(error);
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

      if (activeCategory !== 'TUDO') {
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
              className={`flex-shrink-0 px-4 py-2 rounded-[6px] text-[0.625rem] font-bold uppercase tracking-widest cursor-pointer transition-all active:scale-95 text-center
                ${activeCategory === cat ? 'bg-zinc-900 text-white shadow-sm' : 'bg-surface-container text-on-surface-variant'}
              `}
            >
              {cat}
            </div>
          ))}
        </div>
      </motion.section>

      {/* Destaques / Featured Cards */}
      {!loading && !hideShorts && products.length > 0 && products.some(p => p.productType === 'short' || p.videoUrl) && (
        <section className="px-[4px] pt-1 pb-2 bg-surface">
          <div className="flex items-center justify-between w-full px-2 py-3">
            <div className="flex items-center gap-2">
              <Play size={20} className="text-blue-500" fill="currentColor" />
              <h2 className="text-[20px] font-bold text-on-surface tracking-tight">Shorts</h2>
            </div>
            <div className="relative">
              <button 
                onClick={() => setShowHideShortsPopup(!showHideShortsPopup)} 
                className="text-white hover:text-gray-300 active:scale-95 transition-all outline-none"
              >
                <X size={20} strokeWidth={3} />
              </button>
              
              <AnimatePresence>
                {showHideShortsPopup && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 10 }}
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
          <div className="grid grid-cols-2 gap-[4px]">
            {products.filter((p: any) => p.productType === 'short' || p.videoUrl).slice(0, 2).map((product: any) => (
              <div 
                key={`featured-${product.id}`}
                onClick={() => router.push(`/short/${product.id}`)}
                className="relative w-full h-[300px] rounded-[10px] overflow-hidden cursor-pointer group bg-surface-container"
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
                  <img 
                    src={product.image || product.images?.[0]} 
                    alt={product.name} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    referrerPolicy="no-referrer"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                <div className="absolute bottom-0 left-0 w-full p-3">
                  <h3 className="text-white text-[0.875rem] leading-tight line-clamp-2 mb-1">
                    <span className="font-bold">{product.name}</span> - <span className="font-normal opacity-90">{product.description}</span>
                  </h3>
                  <p className="text-white/80 text-[0.6875rem] font-medium uppercase tracking-wider">{product.views || '0'} visualizações</p>
                </div>
                <div className="absolute top-2 right-2 bg-primary text-on-primary text-[0.625rem] font-black px-2 py-0.5 rounded-[2px] uppercase flex items-center gap-1">
                  🔥 VIDEO
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* AdBanner before Product Feed */}
      <AdBanner dataAdSlot="6870833164" />

      {/* Product Feed */}
      <div className="flex flex-col gap-[3px] bg-background">
        {loading ? (
          <div className="py-12 flex justify-center">
            <Loader2 size={32} className="animate-spin text-zinc-800" />
          </div>
        ) : products.filter((p: any) => !p.videoUrl && p.productType !== 'short').length === 0 ? (
          <div className="py-12 px-6 flex flex-col items-center text-center text-on-surface-variant">
            <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center mb-4">
              <ShoppingBag size={24} className="text-on-surface-variant/50" />
            </div>
            <h3 className="font-bold text-on-surface uppercase tracking-widest text-[0.875rem] mb-2">Nada por aqui!</h3>
            <p className="text-[0.75rem] max-w-[200px] leading-relaxed opacity-80">
              Não encontramos produtos para apresentar nesta categoria agora. Tente procurar outra categoria.
            </p>
          </div>
        ) : (
          <>
            {products.filter((p: any) => !p.videoUrl && p.productType !== 'short').map((product, index) => (
              <React.Fragment key={product.id}>
                <ProductItem 
                  product={product}
                  onClick={() => router.push(`/product/${product.id}`)}
                  onMoreClick={(id, e) => {
                    e.stopPropagation();
                    setActiveOptionsId(id);
                  }}
                />
                
                {/* Insert Ad every 8 items */}
                {(index + 1) % 8 === 0 && (
                  <div className="bg-surface py-2">
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

// Memoized Product Item to prevent unnecessary re-renders during scroll/state updates
const ProductItem = React.memo(({ product, onMoreClick, onClick }: { 
  product: any, 
  onMoreClick: (id: string, e: React.MouseEvent) => void,
  onClick: () => void 
}) => {
  return (
    <article 
      onClick={onClick}
      className="bg-surface pb-4 cursor-pointer"
    >
      {/* Image */}
      <div className="w-full aspect-square bg-surface-container-low relative">
        <img 
          src={product.image} 
          alt={product.name} 
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
        {product.discount && (
          <div className="absolute top-3 left-3 bg-error text-on-error text-[0.625rem] font-black px-2 py-1 rounded-[2px]">
            {product.discount}
          </div>
        )}
      </div>
      
      {/* Content */}
      <div className="px-4 mt-3 flex gap-3">
        <div className="flex-1">
          <p className="text-[0.9375rem] text-on-surface line-clamp-3 leading-snug mb-2">
            <span className="font-bold">{product.name}</span>
            {" - "}
            <span className="text-on-surface-variant/80">{product.description}</span>
          </p>
          
          <div className="flex items-center gap-3 mb-2 opacity-90">
             <span className="text-[0.875rem] font-black text-zinc-800">{product.price} MT</span>
             <div className="flex items-center gap-1 text-on-surface-variant text-[0.625rem] font-bold">
               <Star size={10} className="fill-on-surface-variant" /> {product.likesCount || 0}
             </div>
             <div className="flex items-center gap-1 text-on-surface-variant text-[0.625rem] font-bold">
               <MessageSquare size={10} className="fill-on-surface-variant"/> {product.commentsCount || 0}
             </div>
          </div>

          <div className="flex items-center gap-2">
            <img 
              src={product.avatar} 
              alt="Avatar" 
              className="w-5 h-5 rounded-full object-cover border border-outline-variant/10"
              referrerPolicy="no-referrer"
            />
            <span className="text-[0.75rem] font-medium text-on-surface-variant">
              {product.author} • {product.views || 0} visualizações • {product.time}
            </span>
          </div>
        </div>

        <div 
          className="flex-shrink-0 text-on-surface-variant p-1 -mr-1 cursor-pointer hover:bg-surface-container-highest rounded-full transition-colors active:scale-95 self-start"
          onClick={(e) => onMoreClick(product.id, e)}
        >
          <MoreVertical size={18} />
        </div>
      </div>
    </article>
  );
});

ProductItem.displayName = 'ProductItem';
