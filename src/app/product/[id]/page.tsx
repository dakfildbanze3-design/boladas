"use client";

import React, { useState, useEffect, use } from 'react';
import { Heart, Share2, ShoppingBag, Star, Loader2, ArrowLeft, X, Send, ThumbsUp, ThumbsDown } from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { db, handleFirestoreError, OperationType, auth } from '../../../lib/firebase';
import { doc, getDoc, updateDoc, increment, arrayUnion, arrayRemove, onSnapshot, collection, query, orderBy, limit, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { checkIsFollowing, followUser, unfollowUser } from '../../../services/followService';
import { formatRelativeTime } from '../../../lib/dateUtils';
import { shareContent } from '../../../lib/shareUtils';
import { notificationService } from '../../../services/notificationService';
import { chatService } from '../../../services/chatService';

export default function ProductDetail() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  
  const [product, setProduct] = useState<any>(null);
  const [seller, setSeller] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);
  const [isDescExpanded, setIsDescExpanded] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    const path = `products/${id}`;
    
    // Initial view increment
    const docRef = doc(db, 'products', id);
    updateDoc(docRef, { views: increment(1) }).catch(e => console.error("Error updating views:", e));

    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const productData = docSnap.data();
        setProduct({ id: docSnap.id, ...productData });
        
        if (auth.currentUser) {
          setIsLiked((productData.likedBy || []).includes(auth.currentUser.uid));
        }

        // Fetch seller info
        if (productData.sellerId) {
          getDoc(doc(db, 'users', productData.sellerId)).then(sellerDoc => {
            if (sellerDoc.exists()) {
              setSeller(sellerDoc.data());
            }
          }).catch(err => console.warn("Could not fetch seller info:", err));
        }
      } else {
        setProduct(null);
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
      setLoading(false);
    });

    // Fetch comments
    const qComments = query(collection(db, 'products', id, 'comments'), orderBy('createdAt', 'desc'));
    const unsubscribeComments = onSnapshot(qComments, (snap) => {
      const msgs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setComments(msgs);
    });

    return () => {
      unsubscribe();
      unsubscribeComments();
    };
  }, [id]);

  useEffect(() => {
    const fetchFollowStatus = async () => {
      if (product?.sellerId && auth.currentUser) {
        try {
          const status = await checkIsFollowing(auth.currentUser.uid, product.sellerId);
          setIsFollowing(status);
        } catch (e) {
          console.error(e);
        }
      }
    };
    fetchFollowStatus();
  }, [product?.sellerId]);

  const handleFollowToggle = async () => {
    if (!auth.currentUser) {
      alert("Faça login para seguir usuários");
      router.push('/login');
      return;
    }
    if (product.sellerId === auth.currentUser.uid) {
       return;
    }

    setFollowLoading(true);
    const previousState = isFollowing;
    setIsFollowing(!isFollowing);

    try {
      if (previousState) {
        await unfollowUser(product.sellerId);
      } else {
        await followUser(product.sellerId);
      }
    } catch (error) {
      setIsFollowing(previousState);
      console.error("Erro ao seguir", error);
    } finally {
      setFollowLoading(false);
    }
  };

  const handleLikePost = async () => {
    if (!auth.currentUser || !id || !product) {
      if (!auth.currentUser) alert("Faça login para curtir.");
      return;
    }

    setLikeLoading(true);
    const previousState = isLiked;
    const uid = auth.currentUser.uid;
    setIsLiked(!isLiked);

    try {
      const docRef = doc(db, 'products', id);
      if (previousState) {
        await updateDoc(docRef, { likedBy: arrayRemove(uid) });
      } else {
        await updateDoc(docRef, { likedBy: arrayUnion(uid) });
        notificationService.createNotification({
          type: 'like',
          toUserId: product.sellerId,
          postId: id,
          text: 'curtiu seu post'
        });
      }
    } catch (error) {
      setIsLiked(previousState);
      console.error("Erro ao curtir:", error);
    } finally {
      setLikeLoading(false);
    }
  };

  const handleMessageClick = async () => {
    if (!auth.currentUser) {
      alert("Faça login para enviar mensagens");
      router.push('/login');
      return;
    }
    if (!product?.sellerId) return;

    try {
      const chatId = await chatService.getOrCreateChat(
        product.sellerId,
        seller?.displayName,
        seller?.avatarUrl
      );
      router.push(`/chat/${chatId}`);
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleSendComment = async () => {
    if (!commentText.trim() || !id || !auth.currentUser) return;
    setCommentLoading(true);
    try {
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      const userData = userDoc.data() || {};
      const finalUsername = userData.displayName || auth.currentUser.displayName || 'Usuário';
      const finalAvatar = userData.avatarUrl || auth.currentUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${auth.currentUser.uid}`;

      await addDoc(collection(db, 'products', id, 'comments'), {
        text: commentText.trim(),
        userId: auth.currentUser.uid,
        username: finalUsername,
        avatar: finalAvatar,
        createdAt: serverTimestamp(),
        likedBy: [],
        dislikedBy: []
      });
      setCommentText('');
    } catch (e) {
      console.error("Error sending comment:", e);
    } finally {
      setCommentLoading(false);
    }
  };

  const toggleCommentLike = async (commentId: string) => {
    if (!auth.currentUser || !id) return;
    const uid = auth.currentUser.uid;
    const commentRef = doc(db, 'products', id, 'comments', commentId);
    const comment = comments.find(c => c.id === commentId);
    if (!comment) return;

    try {
      if (comment.likedBy?.includes(uid)) {
        await updateDoc(commentRef, { likedBy: arrayRemove(uid) });
      } else {
        await updateDoc(commentRef, { 
          likedBy: arrayUnion(uid),
          dislikedBy: arrayRemove(uid)
        });
      }
    } catch (e) {
      console.error("Error toggling like:", e);
    }
  };

  const toggleCommentDislike = async (commentId: string) => {
    if (!auth.currentUser || !id) return;
    const uid = auth.currentUser.uid;
    const commentRef = doc(db, 'products', id, 'comments', commentId);
    const comment = comments.find(c => c.id === commentId);
    if (!comment) return;

    try {
      if (comment.dislikedBy?.includes(uid)) {
        await updateDoc(commentRef, { dislikedBy: arrayRemove(uid) });
      } else {
        await updateDoc(commentRef, { 
          dislikedBy: arrayUnion(uid),
          likedBy: arrayRemove(uid)
        });
      }
    } catch (e) {
      console.error("Error toggling dislike:", e);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-12 flex items-center justify-center font-sans">
        <Loader2 size={32} className="animate-spin text-blue-900" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen pt-12 flex flex-col items-center justify-center font-sans">
        <p className="text-on-surface-variant mb-4 font-black uppercase text-[0.875rem]">Produto não encontrado.</p>
        <button onClick={() => router.push('/')} className="text-blue-900 font-bold uppercase text-[0.75rem] tracking-widest">Voltar ao início</button>
      </div>
    );
  }

  return (
    <div className="bg-background min-h-screen font-sans">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="pb-8"
      >
        <header className="fixed top-0 left-0 w-full z-50 flex items-center justify-between p-4 pointer-events-none">
          <button 
            onClick={() => router.back()}
            className="w-10 h-10 flex items-center justify-center bg-black/30 backdrop-blur-md rounded-full text-white pointer-events-auto active:scale-95 transition-transform"
          >
            <ArrowLeft size={24} />
          </button>
          <button 
            onClick={() => shareContent(product.name, `Veja no Bazar: ${product.name} - ${product.price} MT`, window.location.href)}
            className="w-10 h-10 flex items-center justify-center bg-black/30 backdrop-blur-md rounded-full text-white pointer-events-auto active:scale-95 transition-transform"
          >
            <Share2 size={24} />
          </button>
        </header>

        <section className="relative w-full h-[530px] overflow-hidden">
          <img 
            className="w-full h-full object-cover" 
            src={product.images?.[0] || 'https://picsum.photos/seed/placeholder/800/800'} 
            alt={product.name}
            referrerPolicy="no-referrer"
          />
          <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-background to-transparent"></div>
        </section>

        <section className="px-0 mt-[-20px] relative z-10">
          <div className="bg-surface p-4">
            <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar mb-4 pb-1">
              <div className="bg-blue-900/5 px-2 py-1 rounded-[3px] border border-blue-900/10 flex flex-col items-center min-w-[80px]">
                <span className="text-[0.625rem] text-blue-900/60 uppercase font-black leading-none mb-1 tracking-tight">Preço</span>
                <span className="text-[0.875rem] font-black text-blue-900 leading-none">{product.price} MT</span>
              </div>
              <div className="bg-surface-container-highest px-3 py-1 rounded-[3px] flex flex-col min-w-[90px]">
                <span className="text-[0.625rem] text-on-surface-variant/60 uppercase font-black leading-none mb-1 tracking-tight">Telefone</span>
                <span className="text-[0.75rem] font-bold text-on-surface leading-none truncate">{product.sellerPhone || 'Indisp.'}</span>
              </div>
              <div className="bg-surface-container-highest px-3 py-1 rounded-[3px] flex flex-col min-w-[90px]">
                <span className="text-[0.625rem] text-on-surface-variant/60 uppercase font-black leading-none mb-1 tracking-tight">Localização</span>
                <span className="text-[0.75rem] font-bold text-on-surface leading-none truncate">{product.location || 'Maputo'}</span>
              </div>
              <div className="bg-surface-container-highest px-3 py-1 rounded-[3px] flex flex-col min-w-[90px]">
                <span className="text-[0.625rem] text-on-surface-variant/60 uppercase font-black leading-none mb-1 tracking-tight">Categoria</span>
                <span className="text-[0.75rem] font-bold text-on-surface leading-none truncate">{product.category || 'Geral'}</span>
              </div>
            </div>

            <div 
              onClick={() => setIsDescExpanded(!isDescExpanded)}
              className="mb-4 cursor-pointer"
            >
              <p className={`text-[0.9375rem] text-on-surface leading-snug ${isDescExpanded ? '' : 'line-clamp-3'}`}>
                <span className="font-bold uppercase italic">{product.name}</span>
                {" - "}
                <span className="text-on-surface-variant/90 font-medium">{product.description}</span>
              </p>
              {!isDescExpanded && product.description?.length > 100 && (
                 <span className="text-[0.75rem] font-bold text-blue-900 mt-1 block uppercase tracking-widest">Ler mais...</span>
              )}
            </div>

            {seller && (
               <div className="flex flex-col gap-4">
                 <div className="flex items-center justify-between">
                   <div className="flex items-center gap-2">
                     <img 
                       src={seller.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${product.sellerId}`} 
                       alt="Seller Avatar" 
                       className="w-10 h-10 rounded-full object-cover border border-outline-variant/20 shadow-sm"
                     />
                     <div className="flex flex-col">
                       <h3 className="text-[0.875rem] font-bold text-on-surface leading-none mb-1 tracking-tight">
                         {seller.displayName || 'Usuário'}
                         <span className="text-[0.6875rem] text-on-surface-variant font-medium ml-1.5 opacity-60"> • {formatRelativeTime(product.createdAt)}</span>
                       </h3>
                       <div className="flex items-center gap-1.5 text-[0.6875rem] text-on-surface-variant font-medium whitespace-nowrap overflow-x-auto hide-scrollbar max-w-full">
                         <span>{product.views || 0} visualizações</span>
                          <span className="opacity-30">•</span>
                          <span className="flex items-center gap-0.5"><Heart size={10} className="fill-on-surface-variant" /> {product.likedBy?.length || 0} curtidas</span>
                       </div>
                     </div>
                   </div>
                   
                   <div className="flex items-center gap-1">
                     <button 
                       onClick={handleLikePost}
                       disabled={likeLoading}
                       className={`w-8 h-8 flex items-center justify-center rounded-full transition-all active:scale-95 ${isLiked ? 'text-blue-900' : 'text-on-surface-variant'}`}
                     >
                       <Heart size={20} className={isLiked ? 'fill-blue-900' : ''} />
                     </button>
                     <button 
                       onClick={() => shareContent(product.name, `Veja este post no Bazar: ${product.name}`, window.location.href)}
                       className="w-8 h-8 flex items-center justify-center rounded-full text-on-surface-variant active:scale-95 transition-transform"
                     >
                       <Share2 size={20} />
                     </button>
                     {(!auth.currentUser || product?.sellerId !== auth.currentUser.uid) && (
                       <button 
                         onClick={handleFollowToggle}
                         disabled={followLoading}
                         className={`${isFollowing ? 'bg-surface-container-highest text-on-surface' : 'bg-blue-900 text-white'} h-[28px] flex items-center justify-center text-[0.6875rem] px-4 font-bold rounded-[3px] whitespace-nowrap active:scale-95 transition-all shadow-md ml-1`}
                       >
                         {isFollowing ? 'SEGUINDO' : 'SEGUIR'}
                       </button>
                     )}
                   </div>
                 </div>

                 <div className="h-[2px] bg-outline-variant/5 my-1"></div>

                 {/* Comments Preview */}
                 <div 
                   onClick={() => setShowComments(true)}
                   className="bg-surface-container-low p-3 rounded-[3px] border border-outline-variant/10 cursor-pointer active:opacity-80 transition-all my-2 group"
                 >
                   <div className="flex justify-between items-center mb-2">
                     <span className="text-[0.75rem] font-bold text-on-surface uppercase tracking-tight group-hover:text-blue-900 transition-colors">Comentários</span>
                     <span className="text-[0.625rem] font-bold text-blue-900 tracking-widest uppercase">VER TUDO ({comments.length})</span>
                   </div>
                   {comments.length > 0 ? (
                     <div className="flex gap-2 items-start">
                       <img 
                         src={comments[0].avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${comments[0].userId}`} 
                         className="w-6 h-6 rounded-full bg-zinc-800 flex-shrink-0 object-cover border border-outline-variant/10"
                         referrerPolicy="no-referrer"
                       />
                       <p className="text-[0.8125rem] text-on-surface line-clamp-2 leading-snug">
                         <span className="font-bold opacity-80 text-on-surface">{comments[0].username || 'Usuário'}</span>
                         <span className="opacity-40 text-on-surface-variant text-[0.75rem] mx-1">• {formatRelativeTime(comments[0].createdAt)}</span>
                         <span className="text-on-surface-variant/90">{comments[0].text}</span>
                       </p>
                     </div>
                   ) : (
                     <p className="text-[0.8125rem] text-on-surface-variant/40 italic">Sê o primeiro a comentar...</p>
                   )}
                 </div>

                 {auth.currentUser?.uid !== product.sellerId && (
                   <div className="flex gap-2 mt-2">
                     <button 
                       onClick={handleMessageClick}
                       className="flex-1 bg-zinc-600 h-[38px] flex items-center justify-center text-[0.75rem] font-black tracking-widest rounded-[3px] text-white active:scale-95 transition-transform shadow-md uppercase"
                     >
                       MENSAGEM
                     </button>
                     <button 
                       onClick={() => window.open(`https://wa.me/${product.sellerPhone?.replace(/\D/g, '')}`, '_blank')}
                       className="flex-1 bg-blue-900 h-[38px] flex items-center justify-center text-[0.75rem] font-black tracking-widest rounded-[3px] text-white active:scale-95 transition-transform shadow-md uppercase"
                     >
                       CONTACTAR VENDEDOR
                     </button>
                   </div>
                 )}
               </div>
            )}
          </div>
        </section>
      </motion.div>

      {/* Comments Drawer */}
      <AnimatePresence>
        {showComments && (
          <motion.div 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-[100] bg-background flex flex-col h-screen overflow-hidden font-sans"
          >
            <div className="flex items-center justify-between p-4 border-b border-outline-variant/10 bg-surface">
              <h2 className="text-[1.125rem] font-black tracking-tight text-on-surface uppercase leading-none">Comentários ({comments.length})</h2>
              <button 
                onClick={() => setShowComments(false)} 
                className="p-2 hover:bg-surface-container-highest rounded-full text-on-surface transition-colors active:scale-95"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6 hide-scrollbar">
              {comments.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center opacity-30 text-center py-10">
                  <p className="text-[0.875rem] font-black uppercase tracking-widest leading-none mb-1">Nenhum comentário</p>
                  <p className="text-[0.75rem]">Inicia a conversa!</p>
                </div>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="flex gap-3">
                    <img 
                      src={comment.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${comment.userId}`} 
                      className="w-8 h-8 rounded-full border border-outline-variant/20 shrink-0 object-cover shadow-sm" 
                      alt="Avatar"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="mb-0.5 flex flex-wrap items-center">
                        <span className="text-[0.8125rem] font-bold text-on-surface/80 leading-none">{comment.username}</span>
                        <span className="text-[0.75rem] text-on-surface-variant/40 leading-none mx-1">• {formatRelativeTime(comment.createdAt)}</span>
                      </div>
                      <p className="text-[0.875rem] text-on-surface-variant/90 leading-snug break-words font-medium">{comment.text}</p>
                      
                      <div className="flex items-center gap-4 mt-2 text-on-surface-variant/60">
                        <button 
                          onClick={() => toggleCommentLike(comment.id)} 
                          className={`flex items-center gap-1.5 transition-colors ${comment.likedBy?.includes(auth.currentUser?.uid || '') ? 'text-blue-900 font-bold' : 'hover:text-on-surface'}`}
                        >
                          <ThumbsUp size={14} className={comment.likedBy?.includes(auth.currentUser?.uid || '') ? 'fill-blue-900' : ''} />
                          <span className="text-[0.75rem]">{comment.likedBy?.length > 0 ? comment.likedBy.length : ''}</span>
                        </button>
                        <button 
                          onClick={() => toggleCommentDislike(comment.id)} 
                          className={`flex items-center gap-1.5 transition-colors ${comment.dislikedBy?.includes(auth.currentUser?.uid || '') ? 'text-blue-900 font-bold' : 'hover:text-on-surface'}`}
                        >
                          <ThumbsDown size={14} className={comment.dislikedBy?.includes(auth.currentUser?.uid || '') ? 'fill-blue-900' : ''} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 bg-surface border-t border-outline-variant/10 pb-10 transition-all">
              <div className="flex items-center gap-3">
                <img 
                  src={auth.currentUser?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${auth.currentUser?.uid || 'guest'}`} 
                  className="w-9 h-9 rounded-full bg-surface-container-highest shrink-0 object-cover border border-outline-variant/20 shadow-sm" 
                  alt="My Avatar"
                />
                <div className="flex-1 bg-surface-container-low border border-outline-variant/20 rounded-[3px] flex items-center px-4 h-12">
                  <input 
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendComment()}
                    type="text" 
                    placeholder="Adicione um comentário..." 
                    className="bg-transparent border-none outline-none w-full text-[0.875rem] text-on-surface placeholder:text-on-surface-variant/40" 
                  />
                  <button 
                    onClick={handleSendComment}
                    disabled={!commentText.trim() || commentLoading}
                    className={`ml-2 w-8 h-8 flex items-center justify-center shrink-0 rounded-[3px] transition-all shadow-md ${commentText.trim() ? 'bg-blue-900 text-white shadow-blue-900/20' : 'opacity-20 text-on-surface bg-surface-container-highest'}`}
                  >
                    {commentLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
