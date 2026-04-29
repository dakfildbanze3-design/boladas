"use client";

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useRef } from 'react';
import { Heart, Share2, MessageSquare, ArrowLeft, MoreVertical, Play } from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';
import { auth, db, handleFirestoreError, OperationType } from '../../../lib/firebase';
import { doc, getDoc, collection, query, limit, getDocs, where } from 'firebase/firestore';
import { shareContent } from '../../../lib/shareUtils';
import { formatRelativeTime } from '../../../lib/dateUtils';
import { motion, AnimatePresence } from 'motion/react';

export default function ReelsFeed() {
  const router = useRouter();
  const params = useParams();
  const initialId = params.id as string;
  
  const [reels, setReels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  
  useEffect(() => {
    const fetchReels = async () => {
      try {
        setLoading(true);
        // Load the initial one
        let initialDoc = null;
        if (initialId) {
          const docRef = doc(db, 'products', initialId);
          const snap = await getDoc(docRef);
          if (snap.exists()) {
              initialDoc = { id: snap.id, ...snap.data() };
          }
        }
        
        // Load some more shorts
        const q = query(collection(db, 'products'), where('productType', '==', 'short'), limit(15));
        const relSnap = await getDocs(q);
        const fetchedReels = relSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        let finalReels = [];
        if (initialDoc) {
             finalReels = [initialDoc, ...fetchedReels.filter(r => r.id !== initialId)];
        } else {
             finalReels = fetchedReels;
        }
        setReels(finalReels);
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'products');
      } finally {
        setLoading(false);
      }
    };
    fetchReels();
  }, [initialId]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
     const height = e.currentTarget.clientHeight;
     const scrollTop = e.currentTarget.scrollTop;
     const index = Math.round(scrollTop / height);
     if (index !== activeIndex && index >= 0 && index < reels.length) {
         setActiveIndex(index);
     }
  };

  if (loading) {
    return (
      <div className="h-[100dvh] w-full bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  if (reels.length === 0) {
    return (
      <div className="h-[100dvh] w-full bg-black flex flex-col items-center justify-center text-white">
        <p className="mb-4 text-sm font-bold uppercase tracking-widest text-white/50">Nenhum short encontrado</p>
        <button onClick={() => router.back()} className="px-6 py-3 bg-white/10 rounded-full font-bold uppercase tracking-widest text-[0.75rem]">Voltar</button>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] w-full bg-black relative">
       {/* Top Header Floating */}
       <div className="absolute top-0 left-0 w-full z-50 p-4 pt-safe flex items-center justify-between pointer-events-none">
          <button 
             onClick={() => router.push('/')}
             className="w-10 h-10 flex items-center justify-center bg-black/30 backdrop-blur-md rounded-full text-white pointer-events-auto active:scale-95 transition-transform"
          >
             <ArrowLeft size={24} />
          </button>
       </div>

       {/* Feed Container */}
       <div 
          className="h-full w-full overflow-y-auto snap-y snap-mandatory hide-scrollbar"
          onScroll={handleScroll}
       >
         {reels.map((reel, index) => (
           <ReelItem key={reel.id} reel={reel} isActive={index === activeIndex} router={router} />
         ))}
       </div>
    </div>
  );
}

function ReelItem({ reel, isActive, router }: { reel: any, isActive: boolean, router: any }) {
   const videoRef = useRef<HTMLVideoElement>(null);
   const [isPlaying, setIsPlaying] = useState(false);
   
   useEffect(() => {
     if (isActive) {
        if (videoRef.current) {
          videoRef.current.currentTime = 0;
          videoRef.current.play().catch(e => console.log('Autoplay blocked', e));
          setIsPlaying(true);
        }
     } else {
        if (videoRef.current) {
          videoRef.current.pause();
          setIsPlaying(false);
        }
     }
   }, [isActive]);

   const togglePlay = () => {
       if (videoRef.current) {
           if (isPlaying) {
               videoRef.current.pause();
               setIsPlaying(false);
           } else {
               videoRef.current.play();
               setIsPlaying(true);
           }
       }
   };

   return (
      <div className="h-[100dvh] w-full snap-always snap-center relative bg-zinc-900 overflow-hidden flex items-center justify-center">
         {reel.videoUrl ? (
            <video 
               ref={videoRef}
               src={reel.videoUrl}
               className="w-full h-full object-cover"
               loop
               playsInline
            />
         ) : (
            <div className="w-full h-full flex items-center justify-center bg-zinc-800">
               <Play size={48} className="text-white/20" />
            </div>
         )}

         {/* Dim overlay for text readability */}
         <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />

         {/* Play/Pause invisible button covering the screen */}
         <button className="absolute inset-0 w-full h-full z-10 outline-none flex items-center justify-center" onClick={togglePlay}>
            {!isPlaying && (
               <div className="w-20 h-20 bg-black/40 backdrop-blur rounded-full flex items-center justify-center text-white transition-opacity">
                   <Play size={40} className="fill-current text-white ml-2" />
               </div>
            )}
         </button>

         {/* Floating Actions Right */}
         <div className="absolute right-4 bottom-28 flex flex-col items-center gap-6 z-20">
            <button className="flex flex-col items-center gap-1 active:scale-95 transition-transform group outline-none">
               <div className="w-12 h-12 rounded-full bg-black/20 backdrop-blur flex items-center justify-center text-white">
                 <Heart size={28} className="group-hover:fill-current" />
               </div>
               <span className="text-white font-bold text-[0.75rem] text-shadow">{reel.likedBy?.length || 0}</span>
            </button>

            <button 
                onClick={(e) => { e.stopPropagation(); router.push(`/product/${reel.id}`); }}
                className="flex flex-col items-center gap-1 active:scale-95 transition-transform outline-none"
            >
               <div className="w-12 h-12 rounded-full bg-black/20 backdrop-blur flex items-center justify-center text-white">
                 <MessageSquare size={26} />
               </div>
               <span className="text-white font-bold text-[0.75rem] text-shadow">Comentários</span>
            </button>

            <button 
                onClick={(e) => { e.stopPropagation(); shareContent(reel.name, reel.description, `${window.origin}/short/${reel.id}`); }}
                className="flex flex-col items-center gap-1 active:scale-95 transition-transform outline-none"
            >
               <div className="w-12 h-12 rounded-full bg-black/20 backdrop-blur flex items-center justify-center text-white">
                 <Share2 size={26} />
               </div>
               <span className="text-white font-bold text-[0.75rem] text-shadow">Partilhar</span>
            </button>
            <button className="flex flex-col items-center gap-1 active:scale-95 transition-transform outline-none">
               <div className="w-12 h-12 rounded-full bg-black/20 backdrop-blur flex items-center justify-center text-white">
                 <MoreVertical size={26} />
               </div>
            </button>
         </div>

         {/* Floating Info Bottom */}
         <div className="absolute left-4 bottom-6 right-20 flex flex-col gap-2 z-20 pointer-events-none">
            <div className="flex items-center gap-2 pointer-events-auto cursor-pointer" onClick={() => router.push(`/user/${reel.sellerId}`)}>
               <img src={reel.sellerAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${reel.sellerId}`} className="w-10 h-10 rounded-full border border-white/20 shadow-md object-cover" alt="Profile" />
               <span className="text-white font-bold text-[0.9375rem] text-shadow">{reel.sellerName || 'Vendedor'}</span>
               <button className="bg-transparent border border-white text-white px-2 py-0.5 rounded text-[0.625rem] font-bold uppercase tracking-widest ml-2">Seguir</button>
            </div>
            <h2 className="text-white font-bold text-[1rem] leading-tight text-shadow line-clamp-2 mt-1">{reel.name}</h2>
            {reel.description && <p className="text-white/90 text-[0.875rem] line-clamp-2 leading-snug">{reel.description}</p>}
            
            <div className="flex items-center gap-2 mt-2">
               <div className="px-2 py-1 bg-white/20 backdrop-blur rounded-[4px] text-[0.625rem] text-white font-bold uppercase tracking-widest">
                  {reel.price} MT
               </div>
               <p className="text-white/60 text-[0.75rem]">{reel.views || 0} visualizações</p>
            </div>
         </div>
      </div>
   );
}
