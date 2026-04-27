"use client";

import React, { useState } from 'react';
import { Video, X, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { auth, db, supabase, STORAGE_BUCKETS, handleFirestoreError, OperationType } from '../../lib/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';

export default function SellVideo() {
  const router = useRouter();
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddVideo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !auth.currentUser) return;

    // Check if it's a video file type
    if (!file.type.startsWith('video/')) {
        alert('Por favor, selecione um arquivo de vídeo válido.');
        return;
    }

    // Optional: Max size. Let's do 50MB
    if (file.size > 50 * 1024 * 1024) {
        alert('O vídeo deve ter menos de 50MB.');
        return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `video-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

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
      alert('Por favor, selecione um vídeo para este anúncio.');
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
          videoUrl,           // Store video URL
          images: [],         // Empty images
          productType: 'short', // Mark as short/video
          sellerId: auth.currentUser.uid,
          sellerName: userData?.displayName || 'Usuário',
          sellerAvatar: userData?.avatarUrl || null,
          createdAt: serverTimestamp()
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

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="pt-12 pb-24 px-4"
    >
      <form id="sell-video-form" onSubmit={handleSubmit} className="mt-6 space-y-6">
        <div>
          <label className="text-[0.75rem] font-bold uppercase tracking-widest text-on-surface-variant mb-2 block">
            Nome do produto (Short)
          </label>
          <input 
            type="text" 
            placeholder="Ex: Tênis exclusivos em detalhe"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-surface-container-low border-none rounded-[3px] px-4 py-3 text-[0.875rem] focus:ring-2 focus:ring-primary outline-none transition-all"
            required
          />
        </div>

        <div>
          <label className="text-[0.75rem] font-bold uppercase tracking-widest text-on-surface-variant mb-2 block">
            Descrição
          </label>
          <textarea 
            placeholder="Descreva sobre o que é no vídeo..."
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-surface-container-low border-none rounded-[3px] px-4 py-3 text-[0.875rem] focus:ring-2 focus:ring-primary outline-none transition-all resize-none"
            required
          />
        </div>

        <div>
          <label className="text-[0.75rem] font-bold uppercase tracking-widest text-on-surface-variant mb-2 block">
            Preço (MT)
          </label>
          <input 
            type="number" 
            placeholder="0.00"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full bg-surface-container-low border-none rounded-[3px] px-4 py-3 text-[0.875rem] focus:ring-2 focus:ring-primary outline-none transition-all font-mono"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[0.75rem] font-bold uppercase tracking-widest text-on-surface-variant mb-2 block">
              Categoria
            </label>
            <select 
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-surface-container-low border-none rounded-[3px] px-4 py-3 text-[0.875rem] focus:ring-2 focus:ring-primary outline-none transition-all appearance-none"
              required
            >
              <option value="" disabled>Selecionar...</option>
              <option value="Sapatilhas">Sapatilhas</option>
              <option value="Acessórios">Acessórios</option>
              <option value="Roupas">Roupas</option>
              <option value="Serviços">Serviços</option>
              <option value="Eletrônicos">Eletrônicos</option>
            </select>
          </div>
          <div>
            <label className="text-[0.75rem] font-bold uppercase tracking-widest text-on-surface-variant mb-2 block">
              Localização
            </label>
            <input 
              type="text" 
              placeholder="Ex: Maputo"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full bg-surface-container-low border-none rounded-[3px] px-4 py-3 text-[0.875rem] focus:ring-2 focus:ring-primary outline-none transition-all"
              required
            />
          </div>
        </div>

        <div>
          <label className="text-[0.75rem] font-bold uppercase tracking-widest text-on-surface-variant mb-2 block">
            Vídeo do Produto (Short)
          </label>
          <div className="mt-2">
            {!videoUrl ? (
                <label className="w-[120px] h-[160px] flex flex-col items-center justify-center bg-surface-container-low border-2 border-dashed border-outline-variant/30 rounded-[3px] cursor-pointer hover:bg-surface-container-high transition-colors text-center p-2">
                <input 
                    type="file" 
                    accept="video/*" 
                    className="hidden" 
                    onChange={handleAddVideo}
                    disabled={isUploading}
                />
                {isUploading ? (
                    <Loader2 size={24} className="text-primary animate-spin" />
                ) : (
                    <>
                    <Video size={24} className="text-on-surface-variant/50 mb-2" />
                    <span className="text-[0.6875rem] text-on-surface-variant font-medium">Adicionar</span>
                    </>
                )}
                </label>
            ) : (
                <div className="relative w-[120px] h-[160px] rounded-[3px] overflow-hidden bg-black flex items-center justify-center shadow-sm">
                    <video 
                        src={videoUrl} 
                        className="w-full h-full object-cover"
                        controls
                    />
                    <button 
                        type="button"
                        onClick={removeVideo}
                        className="absolute top-1 right-1 bg-error text-white p-1 rounded-full hover:bg-error/80 transition-colors shadow-md z-10"
                    >
                        <X size={14} />
                    </button>
                </div>
            )}
          </div>
          <p className="text-[0.6875rem] text-on-surface-variant/70 mt-2">
            Recomendado: Vídeos na vertical (9:16), máx 50MB. (Ex: MP4, MOV)
          </p>
        </div>

        <div>
          <label className="text-[0.75rem] font-bold uppercase tracking-widest text-on-surface-variant mb-2 block">
            Telefone
          </label>
          <input 
            type="tel" 
            placeholder="+258 XX XXX XXXX"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full bg-surface-container-low border-none rounded-[3px] px-4 py-3 text-[0.875rem] focus:ring-2 focus:ring-primary outline-none transition-all font-mono"
            required
          />
        </div>

        {isSubmitting && (
          <div className="flex justify-center py-4">
            <Loader2 size={24} className="text-primary animate-spin" />
          </div>
        ) && (
          <button 
            type="submit"
            disabled={isSubmitting || !videoUrl}
            className="w-full bg-blue-900 text-white font-bold py-4 rounded-[3px] text-[0.875rem] uppercase tracking-widest active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:active:scale-100 shadow-md"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                <span>A PUBLICAR...</span>
              </>
            ) : (
              'PUBLICAR VÍDEO'
            )}
          </button>
        )}
        
        {/* Fixed button logic above */}
        {!isSubmitting && (
          <button 
            type="submit"
            disabled={!videoUrl}
            className="w-full bg-blue-900 text-white font-bold py-4 rounded-[3px] text-[0.875rem] uppercase tracking-widest active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:active:scale-100 shadow-md"
          >
            PUBLICAR VÍDEO
          </button>
        )}
      </form>
    </motion.div>
  );
}
