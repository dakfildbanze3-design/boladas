"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Camera, X, ChevronRight, Info, Loader2, Video, ArrowLeft, RefreshCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { auth, db, supabase, STORAGE_BUCKETS, handleFirestoreError, OperationType } from '../../lib/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';

export default function Sell() {
  const router = useRouter();
  const [step, setStep] = useState<'camera' | 'form'>('camera');
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [productType, setProductType] = useState<'video' | 'short'>('video');
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let activeStream: MediaStream | null = null;
    
    const startCamera = async () => {
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode },
          audio: true
        });
        activeStream = newStream;
        if (videoRef.current) {
          videoRef.current.srcObject = newStream;
          videoRef.current.onloadedmetadata = () => {
            setIsCameraReady(true);
          };
        }
      } catch (err) {
        console.error("Camera error:", err);
      }
    };

    if (step === 'camera') {
      startCamera();
    }

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [facingMode, step]);

  const flipCamera = () => {
    setFacingMode(prev => prev === "user" ? "environment" : "user");
  };

  const handleAddVideo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !auth.currentUser) return;

    if (!file.type.startsWith('video/')) {
      alert('Por favor, selecione um arquivo de vídeo válido.');
      return;
    }

    setIsUploading(true);
    setStep('form');
    try {
      const fileExt = file.name.split('.').pop() || 'webm';
      const fileName = `media-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKETS.PRODUCTS)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from(STORAGE_BUCKETS.PRODUCTS)
        .getPublicUrl(fileName);

      if (data?.publicUrl) {
        setVideoUrl(data.publicUrl);
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      alert('Erro no upload: ' + error.message);
      setStep('camera');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const removeVideo = () => {
    setVideoUrl(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) {
      alert('Deves estar logado para publicar.');
      return;
    }
    if (!videoUrl) {
      alert('Por favor, carregue um vídeo/foto.');
      return;
    }

    setIsSubmitting(true);
    try {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      const userSnap = await getDoc(userRef);
      const userData = userSnap.data() as any;

      const path = 'products';
      try {
        await addDoc(collection(db, path), {
          name,
          description,
          price: parseFloat(price),
          category,
          sellerPhone: phone,
          location,
          videoUrl,
          productType,
          images: [],
          sellerId: auth.currentUser.uid,
          sellerName: userData?.displayName || 'Usuário',
          sellerAvatar: userData?.avatarUrl || null,
          createdAt: serverTimestamp(),
          views: 0
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }
      
      router.push('/');
    } catch (error: any) {
      console.error('Submit error:', error);
      alert('Erro ao publicar: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (step === 'camera') {
    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-between overflow-hidden">
        {/* Top Banner */}
        <div className="absolute top-0 w-full z-10 flex items-center justify-between p-4 pt-12 bg-gradient-to-b from-black/50 to-transparent">
          <button onClick={() => router.back()} className="text-white font-bold p-1">
            <ArrowLeft size={32} strokeWidth={3} />
          </button>
          <span className="text-white font-bold text-[1.125rem]">Nova publicação</span>
          <button onClick={flipCamera} className="text-white">
             <RefreshCcw size={28} />
          </button>
        </div>

        {/* Video Feed */}
        <div className="w-full h-full relative flex items-center justify-center">
          {!isCameraReady && (
             <div className="text-white/50 text-sm absolute z-0">A carregar câmera...</div>
          )}
          <video 
            ref={videoRef}
            autoPlay 
            playsInline 
            muted 
            className="w-full h-full object-cover relative z-10"
          />
        </div>

        {/* Bottom Section */}
        <div className="absolute bottom-0 w-full flex flex-col items-center pb-8 pt-20 bg-gradient-to-t from-black via-black/60 to-transparent z-20">
          
          {/* Capture Row */}
          <div className="flex w-full items-center justify-center gap-10 mb-8">
             <span className="text-white font-bold text-shadow">Vídeo</span>
             
             {/* Capture Button (triggers file upload for now as mock capture) */}
             <label className="w-[84px] h-[84px] rounded-full border-[4px] border-white/50 flex items-center justify-center cursor-pointer active:scale-95 transition-transform">
               <div className="w-[64px] h-[64px] bg-white rounded-full"></div>
               <input 
                 type="file" 
                 accept="video/*" 
                 capture="environment"
                 className="hidden" 
                 onChange={handleAddVideo}
               />
             </label>
             
             <label className="text-white font-bold text-shadow cursor-pointer">
               Galeria
               <input 
                 type="file" 
                 accept="video/*" 
                 className="hidden" 
                 onChange={handleAddVideo}
               />
             </label>
          </div>

          {/* Mode Selector Row */}
          <div className="flex gap-8 mt-2 px-6">
             <button 
               onClick={() => setProductType('video')}
               className={`font-bold uppercase tracking-wider text-[0.875rem] transition-colors pb-1 ${productType === 'video' ? 'text-white border-b-2 border-white' : 'text-white/50 border-b-2 border-transparent'}`}
             >
               Vídeo
             </button>
             <button 
               onClick={() => setProductType('short')}
               className={`font-bold uppercase tracking-wider text-[0.875rem] transition-colors pb-1 ${productType === 'short' ? 'text-white border-b-2 border-white' : 'text-white/50 border-b-2 border-transparent'}`}
             >
               Shorts
             </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="pt-12 pb-24 px-4 min-h-screen bg-background relative z-50"
    >
      <div className="flex items-center gap-4 py-4">
        <button onClick={() => setStep('camera')} className="text-on-surface">
          <ArrowLeft size={24} />
        </button>
        <span className="font-bold text-[1.125rem]">Detalhes da Publicação</span>
      </div>

      <form id="sell-form" onSubmit={handleSubmit} className="mt-4 space-y-6">
        {/* 1. Tipo de Vídeo (Hidden now because it's selected in camera step, but keep for fallback) */}
        
        {/* Adicionado Video preview */}
        <div className="w-full aspect-video bg-black rounded-[3px] overflow-hidden relative">
          {videoUrl ? (
            <video src={videoUrl} className="w-full h-full object-cover" controls playsInline />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-white gap-2">
              <Loader2 size={32} className="animate-spin text-white/50" />
              <span className="text-white/50 text-[0.875rem] font-bold">A carregar media...</span>
            </div>
          )}
        </div>

        {/* 2. Nome do vídeo */}
        <div>
          <label className="text-[0.75rem] font-bold uppercase tracking-widest text-on-surface-variant mb-2 block">
            Título do Vídeo
          </label>
          <input 
            type="text" 
            placeholder="Ex: Review das novas Sapatilhas"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-surface-container-low border-none rounded-[3px] px-4 py-3 text-[0.875rem] focus:ring-2 focus:ring-primary outline-none transition-all"
            required
          />
        </div>

        {/* 3. Descrição */}
        <div>
          <label className="text-[0.75rem] font-bold uppercase tracking-widest text-on-surface-variant mb-2 block">
            Descrição
          </label>
          <textarea 
            placeholder="Descreve o teu vídeo..."
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-surface-container-low border-none rounded-[3px] px-4 py-3 text-[0.875rem] focus:ring-2 focus:ring-primary outline-none transition-all resize-none"
            required
          />
        </div>

        {/* 4. Número e Localização */}
        <div className="grid grid-cols-1 gap-6">
          <div>
            <label className="text-[0.75rem] font-bold uppercase tracking-widest text-on-surface-variant mb-2 block">
              Número de Telefone
            </label>
            <input 
              type="tel" 
              placeholder="+258 ..."
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-surface-container-low border-none rounded-[3px] px-4 py-3 text-[0.875rem] focus:ring-2 focus:ring-primary outline-none transition-all"
              required
            />
          </div>
          <div>
            <label className="text-[0.75rem] font-bold uppercase tracking-widest text-on-surface-variant mb-2 block">
              Localização
            </label>
            <input 
              type="text" 
              placeholder="Ex: Maputo, Matola..."
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full bg-surface-container-low border-none rounded-[3px] px-4 py-3 text-[0.875rem] focus:ring-2 focus:ring-primary outline-none transition-all"
              required
            />
          </div>
        </div>

        {/* 5. Preço e Categoria */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[0.75rem] font-bold uppercase tracking-widest text-on-surface-variant mb-2 block">
              Preço (MT)
            </label>
            <input 
              type="number" 
              placeholder="0.00"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full bg-surface-container-low border-none rounded-[3px] px-4 py-3 text-[0.875rem] focus:ring-2 focus:ring-primary outline-none transition-all"
              required
            />
          </div>
          <div>
            <label className="text-[0.75rem] font-bold uppercase tracking-widest text-on-surface-variant mb-2 block">
              Categoria
            </label>
            <div className="relative">
              <select 
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-surface-container-low border-none rounded-[3px] px-4 py-3 text-[0.875rem] focus:ring-2 focus:ring-primary outline-none transition-all appearance-none"
                required
              >
                <option value="">Selecionar</option>
                <option value="Sapatilhas">Sapatilhas</option>
                <option value="Acessórios">Acessórios</option>
                <option value="Roupas">Roupas</option>
                <option value="Serviços">Serviços</option>
                <option value="Eletrônicos">Eletrônicos</option>
                <option value="Automóveis">Automóveis</option>
              </select>
              <ChevronRight size={18} className="absolute right-3 top-1/2 -translate-y-1/2 rotate-90 text-on-surface-variant pointer-events-none" />
            </div>
          </div>
        </div>

        <button 
          type="submit"
          disabled={isSubmitting || (!videoUrl && !isUploading)}
          className="w-full bg-blue-900 text-white font-bold py-4 rounded-[3px] text-[0.875rem] uppercase tracking-widest active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:active:scale-100 shadow-md"
        >
          {isSubmitting || isUploading ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              <span>{isUploading ? 'A CARREGAR VIDEO...' : 'A PUBLICAR...'}</span>
            </>
          ) : (
            'PUBLICAR VÍDEO'
          )}
        </button>
      </form>
    </motion.div>
  );
}
