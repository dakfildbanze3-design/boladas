"use client";

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Search as SearchIcon, X, MoreVertical, Heart, Play } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { db } from '../../lib/firebase';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';

const tabs = ["Vídeos", "Shorts"];

export default function SearchPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("Vídeos");
  const [allResults, setAllResults] = useState<any[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchResults = async (queryText: string) => {
    if (!queryText.trim()) return;

    setLoading(true);
    try {
      const q = query(
        collection(db, 'products'),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const allDocs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      const filteredBySearch = allDocs.filter((item: any) => 
        (item.name?.toLowerCase().includes(queryText.toLowerCase())) ||
        (item.description?.toLowerCase().includes(queryText.toLowerCase())) ||
        (item.category?.toLowerCase().includes(queryText.toLowerCase())) ||
        (item.location?.toLowerCase().includes(queryText.toLowerCase()))
      );
      
      setAllResults(filteredBySearch);
    } catch (error) {
      console.error("Error searching:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    fetchResults(searchQuery);
  };

  useEffect(() => {
    if (searchQuery.length > 2) {
      const timeoutId = setTimeout(() => fetchResults(searchQuery), 500);
      return () => clearTimeout(timeoutId);
    } else {
      setAllResults([]);
    }
  }, [searchQuery]);

  useEffect(() => {
    const filteredByTab = allResults.filter((item: any) => {
       if (activeTab === "Shorts") {
          return item.productType === 'short';
       } else {
          return item.productType !== 'short';
       }
    });
    setResults(filteredByTab);
  }, [allResults, activeTab]);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Search Header */}
      <div className="fixed top-0 left-0 right-0 max-w-md mx-auto z-50 bg-black border-b border-white/10 px-3 py-2 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-white relative top-[2px] active:scale-95 transition-transform">
          <ArrowLeft size={24} />
        </button>
        
        <div className="flex-1 bg-white/10 rounded-full flex items-center px-4 h-10 gap-2">
          <SearchIcon size={18} className="text-white/50" />
          <input 
            type="text"
            placeholder="Pesquisar no Bazar..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="flex-1 bg-transparent border-none outline-none text-[0.875rem] text-white placeholder-white/50"
            autoFocus
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="text-white/50 p-1 active:scale-95">
              <X size={16} />
            </button>
          )}
        </div>

        <button className="text-white active:scale-95">
          <MoreVertical size={24} />
        </button>
      </div>

      {/* Tabs */}
      <div className="fixed top-14 left-0 right-0 max-w-md mx-auto z-40 bg-black border-b border-white/10 flex overflow-x-auto hide-scrollbar px-3">
        {tabs.map((tab) => (
          <button 
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-shrink-0 px-4 py-3 text-[0.9375rem] font-medium transition-colors border-b-2 ${
              activeTab === tab ? "border-white text-white" : "border-transparent text-white/50"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Results Grid */}
      <div className="mt-28 px-[5px] pb-20">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
          </div>
        ) : results.length > 0 ? (
          <div className="grid grid-cols-2 gap-[5px]">
            {results.map((item) => (
              <div 
                key={item.id} 
                onClick={() => router.push(item.productType === 'short' ? `/short/${item.id}` : `/product/${item.id}`)}
                className="flex flex-col bg-black overflow-hidden cursor-pointer"
              >
                {/* Media Container */}
                <div className="relative aspect-[3/4] bg-white/5 rounded-sm">
                   {item.videoUrl ? (
                     <video 
                       src={item.videoUrl} 
                       className="w-full h-full object-cover"
                       muted
                       loop
                       playsInline
                     />
                   ) : (
                     <div className="w-full h-full flex items-center justify-center bg-zinc-800">
                       <Play size={24} className="text-white/30" />
                     </div>
                   )}
                   
                   {/* Top Left Overlays (Price/Phone) */}
                   <div className="absolute top-2 left-2 flex flex-col gap-1 items-start">
                      <div className="bg-black/60 border border-white/10 text-white text-[0.625rem] font-bold px-1.5 py-0.5 rounded backdrop-blur-sm shadow-sm">
                        {item.price} MT
                      </div>
                      {item.sellerPhone && (
                        <div className="bg-black/60 text-white text-[0.625rem] font-bold px-1.5 py-0.5 rounded backdrop-blur-sm border border-white/10">
                          {item.sellerPhone}
                        </div>
                      )}
                   </div>

                   {/* Middle Play Button for Videos */}
                   {item.productType === 'short' && (
                     <div className="absolute inset-0 flex items-center justify-center">
                        <div className="bg-black/20 rounded-full p-2 backdrop-blur-[2px]">
                          <Play size={20} className="text-white fill-white" />
                        </div>
                     </div>
                   )}

                   {/* Bottom Right Overlay */}
                   {item.productType === 'short' && (
                     <div className="absolute bottom-2 right-2 flex items-center gap-2">
                        <div className="bg-black/60 p-1 rounded-sm border border-white/10">
                           <Play size={12} className="text-white" />
                        </div>
                     </div>
                   )}
                </div>

                {/* Info Part */}
                <div className="py-2 px-1 flex flex-col gap-[3px]">
                   <h3 className="text-[0.8125rem] font-medium leading-tight line-clamp-3 text-white">
                     {item.name}
                     {item.description && (
                       <span className="font-normal opacity-90 ml-1">
                         - {item.description}
                       </span>
                     )}
                   </h3>
                   
                   <div className="flex items-center justify-between mt-1">
                      <div className="flex items-center gap-[5px] min-w-0">
                         <img 
                            src={item.sellerAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${item.sellerId}`} 
                            className="w-5 h-5 rounded-full shrink-0 border border-white/10 object-cover" 
                            alt="avatar" 
                            referrerPolicy="no-referrer"
                         />
                         <div className="flex flex-col min-w-0">
                            <span className="text-[0.6875rem] text-white/80 font-medium truncate">
                               {item.sellerName || 'Vendedor'}
                            </span>
                            <span className="text-[0.625rem] text-white/50">
                               {item.createdAt ? new Date(item.createdAt.seconds * 1000).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' }) : '26 de mar.'}
                            </span>
                         </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 text-white/50">
                         <Heart size={12} />
                         <span className="text-[0.6875rem] font-medium">{item.likesCount || (item.likedBy?.length || 0)}</span>
                      </div>
                   </div>
                </div>
              </div>
            ))}
          </div>
        ) : searchQuery ? (
          <div className="py-20 text-center text-white/50">
            Nenhum resultado encontrado para "{searchQuery}"
          </div>
        ) : (
          <div className="py-20 text-center text-white/50">
            Comece a pesquisar...
          </div>
        )}
      </div>
    </div>
  );
}
