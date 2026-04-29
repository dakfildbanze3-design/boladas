"use client";

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Loader2, ThumbsUp, ThumbsDown, MessageSquare, Share2, Bookmark, ShoppingBag, X, Send, MapPin, Phone, Tag, MoreVertical } from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { db, handleFirestoreError, OperationType, auth } from '../../../lib/firebase';
import { doc, getDoc, collection, query, limit, getDocs, addDoc, serverTimestamp, onSnapshot, orderBy, updateDoc, arrayUnion, arrayRemove, increment } from 'firebase/firestore';
import { checkIsFollowing, followUser, unfollowUser } from '../../../services/followService';
import { notificationService } from '../../../services/notificationService';
import { formatRelativeTime } from '../../../lib/dateUtils';
import { shareContent } from '../../../lib/shareUtils';
import { chatService } from '../../../services/chatService';

type CommentType = {
  id: string;
  username: string;
  avatar: string;
  time: string;
  text: string;
  likes: number;
  userLiked: boolean;
  userDisliked: boolean;
  replies: CommentType[];
};

export default function ProductDetail() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);
  const [relatedVideos, setRelatedVideos] = useState<any[]>([]);
  const [isTextExpanded, setIsTextExpanded] = useState(false);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  
  // Comments logic
  const [comments, setComments] = useState<CommentType[]>([]);
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<{id: string, username: string} | null>(null);
  const commentInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!id) return;
    const commentsRef = collection(db, 'products', id, 'comments');
    const q = query(commentsRef, orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const allComments: any[] = [];
        snapshot.forEach(docSnap => {
            allComments.push({ id: docSnap.id, ...docSnap.data() });
        });
        
        const topLevel = allComments.filter(c => !c.parentId);
        const rawReplies = allComments.filter(c => c.parentId).sort((a,b) => (a.createdAt?.toDate?.()?.getTime() || 0) - (b.createdAt?.toDate?.()?.getTime() || 0));

        const formatted: CommentType[] = topLevel.map(c => {
            const cReplies = rawReplies.filter(r => r.parentId === c.id);
            return {
                id: c.id,
                username: c.username,
                avatar: c.avatar,
                time: formatRelativeTime(c.createdAt),
                text: c.text,
                likes: c.likedBy?.length || 0,
                userLiked: auth.currentUser ? (c.likedBy || []).includes(auth.currentUser.uid) : false,
                userDisliked: auth.currentUser ? (c.dislikedBy || []).includes(auth.currentUser.uid) : false,
                replies: cReplies.map(r => ({
                    id: r.id,
                    username: r.username,
                    avatar: r.avatar,
                    time: formatRelativeTime(r.createdAt),
                    text: r.text,
                    likes: r.likedBy?.length || 0,
                    userLiked: auth.currentUser ? (r.likedBy || []).includes(auth.currentUser.uid) : false,
                    userDisliked: auth.currentUser ? (r.dislikedBy || []).includes(auth.currentUser.uid) : false,
                    replies: []
                }))
            };
        });
        setComments(formatted);
    });

    return () => unsubscribe();
  }, [id, auth.currentUser?.uid]);

  const toggleLike = async (commentId: string, parentId: string | null = null) => {
    if (!auth.currentUser) {
        alert("Faça login para curtir.");
        return;
    }
    if (!id) return;
    
    const uid = auth.currentUser.uid;
    let targetComment;
    if (parentId) {
        const p = comments.find(c => c.id === parentId);
        targetComment = p?.replies.find(r => r.id === commentId);
    } else {
        targetComment = comments.find(c => c.id === commentId);
    }
    if (!targetComment) return;

    const commentRef = doc(db, 'products', id, 'comments', commentId);
    if (targetComment.userLiked) {
        await updateDoc(commentRef, { likedBy: arrayRemove(uid) });
    } else {
        await updateDoc(commentRef, { likedBy: arrayUnion(uid), dislikedBy: arrayRemove(uid) });
    }
  };

  const toggleDislike = async (commentId: string, parentId: string | null = null) => {
    if (!auth.currentUser) {
        alert("Faça login para não curtir.");
        return;
    }
    if (!id) return;

    const uid = auth.currentUser.uid;
    let targetComment;
    if (parentId) {
        const p = comments.find(c => c.id === parentId);
        targetComment = p?.replies.find(r => r.id === commentId);
    } else {
        targetComment = comments.find(c => c.id === commentId);
    }
    if (!targetComment) return;

    const commentRef = doc(db, 'products', id, 'comments', commentId);
    if (targetComment.userDisliked) {
        await updateDoc(commentRef, { dislikedBy: arrayRemove(uid) });
    } else {
        await updateDoc(commentRef, { dislikedBy: arrayUnion(uid), likedBy: arrayRemove(uid) });
    }
  };

  const handleReplyClick = (commentId: string, username: string) => {
    setReplyingTo({ id: commentId, username });
    setTimeout(() => {
        commentInputRef.current?.focus();
    }, 100);
  };

  const handleSendComment = async () => {
    if (!commentText.trim()) return;
    if (!auth.currentUser) {
        alert("Faça login para comentar.");
        return;
    }
    if (!id) return;

    const textToSave = commentText.trim();
    setCommentText('');
    setReplyingTo(null);

    try {
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        const userData = userDoc.data() || {};
        const usernameStr = userData.displayName || auth.currentUser.displayName;
        const finalUsername = usernameStr ? `@${usernameStr.toLowerCase().replace(/\s+/g, '')}` : '@usuario';
        const finalAvatar = userData.avatarUrl || auth.currentUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${auth.currentUser.uid}`;

        await addDoc(collection(db, 'products', id, 'comments'), {
            text: textToSave,
            userId: auth.currentUser.uid,
            username: finalUsername,
            avatar: finalAvatar,
            parentId: replyingTo ? replyingTo.id : null,
            likedBy: [],
            dislikedBy: [],
            createdAt: serverTimestamp()
        });

        // Trigger Notification
        if (product?.sellerId) {
            notificationService.createNotification({
                type: 'comment',
                toUserId: product.sellerId,
                postId: id,
                text: `comentou no seu post: "${textToSave.substring(0, 30)}${textToSave.length > 30 ? '...' : ''}"`
            });
        }
    } catch (error) {
        console.error("Erro ao adicionar comentário:", error);
        alert("Erro ao adicionar comentário.");
    }
  };

  useEffect(() => {
    const incrementView = async () => {
      if (!id) return;
      try {
        const docRef = doc(db, 'products', id);
        await updateDoc(docRef, {
          views: increment(1)
        });
      } catch (e) {
        console.error("Erro ao incrementar visualizações:", e);
      }
    };
    
    const fetchVideoAndRelated = async () => {
      if (!id) return;
      try {
        // Fetch current video
        const docRef = doc(db, 'products', id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const productData = docSnap.data();
          setProduct({ id: docSnap.id, ...productData });
          
          if (auth.currentUser) {
            setIsLiked((productData.likedBy || []).includes(auth.currentUser.uid));
          }
          
          // Increment view count
          incrementView();
        }

        // Fetch related videos
        const q = query(collection(db, 'products'), limit(30));
        const relSnap = await getDocs(q);
        const related = relSnap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter((p: any) => p.id !== id && p.videoUrl && p.productType !== 'short');
        setRelatedVideos(related);
        
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `products/${id}`);
      } finally {
        setLoading(false);
      }
    };

    fetchVideoAndRelated();
  }, [id]);

  useEffect(() => {
    const fetchFollowStatus = async () => {
      if (product?.sellerId && auth.currentUser) {
        try {
          const status = await checkIsFollowing(auth.currentUser.uid, product.sellerId);
          setIsFollowing(status);
        } catch (e: any) {
          console.error(e?.message || String(e));
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
    if (product.sellerId === auth.currentUser.uid) return;

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
      console.error("Erro", error);
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
        // Trigger Notification
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
        product.sellerName,
        product.sellerAvatar
      );
      router.push(`/chat/${chatId}`);
    } catch (error: any) {
      alert(error.message);
    }
  };

  const formatViews = (views: number) => {
    if (views >= 1000000) return (views / 1000000).toFixed(1) + ' mi';
    if (views >= 1000) return (views / 1000).toFixed(1) + ' mil';
    return views.toString();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center text-on-surface">
        <p className="mb-4 font-medium">Vídeo não encontrado.</p>
        <button onClick={() => router.back()} className="bg-primary text-on-primary px-4 py-2 rounded-[3px] font-bold">
            Voltar
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-12 w-full max-w-md mx-auto">
      {/* Video Box (16:9 Standard Player) */}
      <div className="w-full aspect-video bg-black sticky top-0 z-40 relative group">
        {product.videoUrl ? (
            <video 
              src={product.videoUrl} 
              className="w-full h-full object-contain"
              controls
              autoPlay
              playsInline
            />
        ) : (
            <div className="w-full h-full flex items-center justify-center">
                <img src={product.image || product.images?.[0]} className="w-full h-full object-cover opacity-80" alt="Short" />
            </div>
        )}
        
        {/* Top Back/Minimize Button - appears overlaid like YouTube minimize video */}
        <button 
          onClick={() => router.back()}
          className="absolute top-3 left-3 p-1.5 bg-black/40 hover:bg-black/60 backdrop-blur-sm rounded-full text-white z-50 transition-colors shadow-lg"
        >
          <ChevronDown size={28} />
        </button>
      </div>

      <div className="h-[1px] w-full bg-outline-variant/10" />

      <div className="px-3 py-2 flex flex-col gap-[5px]">
         {/* Metadata Row */}
         <div className="flex flex-wrap items-center gap-[5px]">
            <div className="px-2 py-1 bg-white/10 rounded-[4px] text-[0.7rem] text-white font-medium border border-white/5 uppercase tracking-tight">
               {product.price} MT
            </div>
            {product.location && (
               <div className="px-2 py-1 bg-white/10 rounded-[4px] text-[0.7rem] text-white font-medium border border-white/5 flex items-center gap-1">
                  <MapPin size={10} className="text-white/60" />
                  {product.location}
               </div>
            )}
            {product.sellerPhone && (
               <div className="px-2 py-1 bg-white/10 rounded-[4px] text-[0.7rem] text-white font-medium border border-white/5 flex items-center gap-1">
                  <Phone size={10} className="text-white/60" />
                  {product.sellerPhone}
               </div>
            )}
            {product.category && (
               <div className="px-2 py-1 bg-white/10 rounded-[4px] text-[0.7rem] text-white font-medium border border-white/5 flex items-center gap-1">
                  <Tag size={10} className="text-white/60" />
                  {product.category}
               </div>
            )}
         </div>

         {/* Title area */}
         <div 
            className="flex flex-col cursor-pointer"
            onClick={() => setIsTextExpanded(!isTextExpanded)}
         >
            <h1 className={`text-[1.125rem] font-bold text-white leading-tight ${isTextExpanded ? '' : 'line-clamp-3'}`}>
               {product.name}
               {product.description && (
                  <span className="font-normal opacity-90 ml-1">
                     - {product.description}
                  </span>
               )}
            </h1>
            <div className="flex flex-wrap items-center gap-[5px] text-[0.75rem] text-white/60 mt-[2px]">
               <span>{product.sellerName || 'Vendedor'}</span>
               <span>{formatViews(product.views)} de visualizações</span>
               <span>há {formatRelativeTime(product.createdAt)}</span>
               {!isTextExpanded && <span className="font-bold text-white">...mais</span>}
               {isTextExpanded && <span className="font-bold text-white">mostrar menos</span>}
            </div>
         </div>

         {/* Channel Button Row */}
         <div className="flex items-center gap-[5px] mt-[5px]">
            <img 
               src={product.sellerAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${product.sellerId}`} 
               className="w-9 h-9 rounded-full object-cover shrink-0 cursor-pointer" 
               referrerPolicy="no-referrer"
               onClick={() => router.push(`/user/${product.sellerId}`)}
               alt="Seller"
            />
            <div className="flex flex-col min-w-0">
               <span 
                  onClick={() => router.push(`/user/${product.sellerId}`)}
                  className="text-[0.875rem] font-bold text-white truncate cursor-pointer hover:underline"
               >
                  {product.sellerName || 'Vendedor'}
               </span>
               <span className="text-[0.75rem] text-white/50 leading-none">1.2 mi de seguidores</span>
            </div>

            <div className="flex-1" />

            {/* Action Buttons Group */}
            <div className="flex gap-[5px] items-center">
               <div className="flex items-center bg-white/10 rounded-full overflow-hidden">
                  <button 
                    onClick={handleLikePost}
                    className="flex items-center gap-[5px] px-3 py-1.5 hover:bg-white/10"
                  >
                    <ThumbsUp size={18} className={isLiked ? 'fill-white' : ''} />
                    <span className="text-[0.75rem] font-bold">{product.likedBy?.length || 13} mil</span>
                  </button>
               </div>

               <button 
                  onClick={() => {
                     shareContent(
                        product.name,
                        `Olha este vídeo no Bazar: ${product.name}`,
                        `${window.location.origin}/short/${product.id}`
                     );
                  }}
                  className="flex items-center gap-[5px] bg-white/10 px-3 py-1.5 rounded-full hover:bg-white/20"
               >
                  <Share2 size={18} />
               </button>

               {auth.currentUser?.uid !== product.sellerId && (
                  <button 
                    onClick={handleFollowToggle}
                    disabled={followLoading}
                    className="bg-white text-black text-[0.8125rem] font-bold h-8 px-4 rounded-full active:scale-95 transition-all shrink-0"
                  >
                    {isFollowing ? 'Seguindo' : 'Seguir'}
                  </button>
               )}
            </div>
         </div>

         {/* Comments Box */}
         <div 
            onClick={() => setIsCommentsOpen(true)}
            className="bg-white/10 rounded-[12px] p-2.5 mt-[5px] w-full cursor-pointer hover:bg-white/15 transition-colors"
         >
            <div className="flex items-center gap-[5px] mb-[5px]">
                <span className="text-[0.875rem] font-bold text-white">Comentários</span>
                <span className="text-[0.75rem] text-white/60">{comments.length > 0 ? comments.length : '464'}</span>
            </div>
            <div className="flex gap-[5px] items-start">
               <img 
                 src={comments[0]?.avatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=comment"} 
                 alt="Avatar" 
                 className="w-6 h-6 rounded-full shrink-0 object-cover"
                 referrerPolicy="no-referrer"
               />
               <p className="text-[0.8125rem] text-white line-clamp-2 leading-tight">
                  {comments[0]?.text || '"Este vídeo é incrível! Adorei a explicação detalhada sobre como tudo funciona."'}
               </p>
            </div>
         </div>

         {/* Transaction Buttons Row */}
         <div className="flex gap-[5px] mt-[5px] mb-2">
            <button 
               onClick={() => {
                  const phoneStr = product?.sellerPhone || '';
                  const cleanPhone = phoneStr.replace(/\D/g, '');
                  if (cleanPhone) {
                     window.open(`https://wa.me/${cleanPhone}`, '_blank');
                  } else {
                     alert('O vendedor não disponibilizou número de WhatsApp.');
                  }
               }}
               className="flex-1 bg-white text-black font-bold h-10 rounded-[12px] flex items-center justify-center gap-2 active:scale-95 transition-all"
            >
               <ShoppingBag size={18} />
               <span className="text-[0.875rem]">Comprar agora</span>
            </button>
            <button 
               onClick={handleMessageClick}
               className="flex-1 bg-white/10 text-white font-bold h-10 rounded-[12px] flex items-center justify-center gap-2 active:scale-95 transition-all border border-white/10 hover:bg-white/20"
            >
               <MessageSquare size={18} />
               <span className="text-[0.875rem]">Contactar vendedor</span>
            </button>
         </div>
      </div>

      {/* Related Videos List */}
      <div className="mt-[5px] border-t border-white/5">
         <div className="flex flex-col gap-[5px]">
            {relatedVideos.map((item, index) => (
                <div 
                  key={`related-${item.id}-${index}`}
                  className="w-full bg-background"
                >
                  {/* Video Content FIRST */}
                  <div 
                     className="relative w-full aspect-video bg-black cursor-pointer"
                     onClick={() => {
                        router.push(`/product/${item.id}`);
                        window.scrollTo(0,0);
                     }}
                  >
                     <video 
                        src={item.videoUrl} 
                        className="w-full h-full object-cover"
                        muted
                        loop
                        playsInline
                     />
                     <div className="absolute bottom-2 right-2 bg-black/80 text-white text-[0.75rem] px-1 rounded font-medium">
                        11:45
                     </div>
                  </div>

                  {/* Details BELOW Video */}
                  <div className="px-3 py-2 flex gap-[5px] items-start">
                     <img 
                        src={item.sellerAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${item.sellerId}`} 
                        className="w-10 h-10 rounded-full object-cover shrink-0" 
                        referrerPolicy="no-referrer"
                        onClick={() => router.push(`/user/${item.sellerId}`)}
                        alt="Seller"
                     />
                     
                     <div className="flex flex-col flex-1 min-w-0">
                        <div className="flex flex-col gap-[5px]">
                           {/* Card Metadata Badges */}
                           <div className="flex flex-wrap items-center gap-[5px]">
                              <div className="px-1.5 py-0.5 bg-white/10 rounded-[2px] text-[0.625rem] text-white/80 font-medium">
                                 {item.price} MT
                              </div>
                              {item.category && (
                                 <div className="px-1.5 py-0.5 bg-white/10 rounded-[2px] text-[0.625rem] text-white/80 font-medium">
                                    {item.category}
                                 </div>
                              )}
                           </div>
                           
                           <h3 className="text-[0.9375rem] leading-snug text-white font-medium line-clamp-3 cursor-pointer">
                              {item.name}
                              {item.description && (
                                 <span className="font-normal opacity-90 ml-1">
                                    - {item.description}
                                 </span>
                              )}
                           </h3>
                           <div className="text-[0.75rem] text-white/60 flex items-center gap-1">
                              <span>{item.sellerName || 'Vendedor'}</span>
                              <span>•</span>
                              <span>{formatViews(item.views)} de visualizações</span>
                              <span>•</span>
                              <span>há {formatRelativeTime(item.createdAt)}</span>
                           </div>
                        </div>
                     </div>

                     <button className="text-white shrink-0">
                        <MoreVertical size={20} />
                     </button>
                  </div>
                </div>
               ))}
            </div>
         </div>

      {/* Comments Full Screen (Preta Brilhante) */}
      <AnimatePresence>
      {isCommentsOpen && (
          <motion.div 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-50 bg-gradient-to-br from-[#1a1a1a] via-[#0a0a0a] to-black flex flex-col pointer-events-auto h-screen w-full"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10 bg-black/40 backdrop-blur-md shrink-0">
              <h2 className="text-[1.125rem] font-bold text-white">Comentários</h2>
              <button 
                 onClick={() => setIsCommentsOpen(false)} 
                 className="p-2 hover:bg-white/10 rounded-full text-white transition-colors"
                 aria-label="Gravar e Sair"
              >
                <X size={24} />
              </button>
            </div>
            
            {/* Comments List */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">
               {comments.map((comment) => (
                  <div key={comment.id} className="flex flex-col gap-3">
                     <div className="flex gap-3">
                        <img src={comment.avatar} className="w-8 h-8 rounded-full border border-white/20 shrink-0 object-cover" alt="Avatar" />
                        <div className="flex-1 min-w-0">
                           <div className="mb-0.5">
                              <span className="text-[0.8125rem] font-bold text-white/60 mr-2">{comment.username}</span>
                              <span className="text-[0.75rem] text-white/40">{comment.time}</span>
                           </div>
                           <p className="text-[0.875rem] text-white/90 leading-snug break-words">{comment.text}</p>
                           {/* Action Line */}
                           <div className="flex items-center gap-4 mt-2 text-white/60">
                              <button onClick={() => toggleLike(comment.id)} className={`flex items-center gap-1.5 transition-colors ${comment.userLiked ? 'text-blue-900 font-bold' : 'hover:text-white'}`}>
                                 <ThumbsUp size={14} className={comment.userLiked ? 'fill-blue-900' : ''} />
                                 <span className="text-[0.75rem]">{comment.likes > 0 ? comment.likes : ''}</span>
                              </button>
                              <button onClick={() => toggleDislike(comment.id)} className={`flex items-center gap-1.5 transition-colors ${comment.userDisliked ? 'text-blue-900 font-bold' : 'hover:text-white'}`}>
                                 <ThumbsDown size={14} className={comment.userDisliked ? 'fill-blue-900' : ''} />
                              </button>
                              <button onClick={() => handleReplyClick(comment.id, comment.username)} className="text-[0.75rem] font-bold hover:text-white transition-colors">Responder</button>
                           </div>
                        </div>
                     </div>
                     
                     {/* Replies */}
                     {comment.replies.map(reply => (
                        <div key={reply.id} className="flex gap-3 ml-11 relative">
                           {/* Connecting Line */}
                           <div className="absolute -left-7 top-0 w-6 h-6 border-l-2 border-b-2 border-white/20 rounded-bl-[12px]"></div>
                           
                           <img src={reply.avatar} className="w-7 h-7 rounded-full border border-white/20 shrink-0 object-cover" alt="Avatar" />
                           <div className="flex-1 min-w-0">
                              <div className="mb-0.5">
                                <span className="text-[0.8125rem] font-bold text-white/60 mr-2">{reply.username}</span>
                                <span className="text-[0.75rem] text-white/40">{reply.time}</span>
                              </div>
                              <p className="text-[0.875rem] text-white/90 leading-snug break-words">{reply.text}</p>
                              {/* Action Line */}
                              <div className="flex items-center gap-4 mt-2 text-white/60">
                                 <button onClick={() => toggleLike(reply.id, comment.id)} className={`flex items-center gap-1.5 transition-colors ${reply.userLiked ? 'text-blue-900 font-bold' : 'hover:text-white'}`}>
                                    <ThumbsUp size={14} className={reply.userLiked ? 'fill-blue-900' : ''} />
                                    <span className="text-[0.75rem]">{reply.likes > 0 ? reply.likes : ''}</span>
                                 </button>
                                 <button onClick={() => toggleDislike(reply.id, comment.id)} className={`flex items-center gap-1.5 transition-colors ${reply.userDisliked ? 'text-blue-900 font-bold' : 'hover:text-white'}`}>
                                    <ThumbsDown size={14} className={reply.userDisliked ? 'fill-blue-900' : ''} />
                                 </button>
                                 {/* Only single level nesting for replies */}
                                 <button onClick={() => handleReplyClick(comment.id, reply.username)} className="text-[0.75rem] font-bold hover:text-white transition-colors">Responder</button>
                              </div>
                           </div>
                        </div>
                     ))}
                  </div>
               ))}
            </div>

            {/* Input area Footer */}
            <div className="flex flex-col bg-black shrink-0 border-t border-white/5">
               {replyingTo && (
                  <div className="px-4 py-2 bg-white/5 flex items-center justify-between">
                     <span className="text-[0.75rem] text-white/50">
                        A responder a <span className="font-bold text-white/80">{replyingTo.username}</span>
                     </span>
                     <button onClick={() => setReplyingTo(null)} className="text-white/40 hover:text-white p-1">
                        <X size={14} />
                     </button>
                  </div>
               )}
               <div className="p-3 flex items-center gap-3">
                 <img src={auth.currentUser?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${auth.currentUser?.uid || 'guest'}`} className="w-8 h-8 rounded-full bg-zinc-800 shrink-0 object-cover border border-white/10" alt="Me" />
                 <div className="flex-1 bg-zinc-900 rounded-full flex items-center px-4 h-10 border border-white/10">
                   <input 
                      ref={commentInputRef}
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendComment()}
                      type="text" 
                      placeholder="Adicione um comentário..." 
                      className="bg-transparent border-none outline-none w-full text-[0.875rem] text-white placeholder:text-white/30" 
                   />
                   <button 
                      onClick={handleSendComment}
                      disabled={!commentText.trim()}
                      className={`ml-2 w-7 h-7 flex items-center justify-center shrink-0 rounded-full transition-all ${commentText.trim() ? 'bg-blue-900 text-white' : 'opacity-20 text-white'}`}
                   >
                      <Send size={14} fill="currentColor" />
                   </button>
                 </div>
               </div>
               <div className="h-6" /> {/* Spacer for bottom area */}
            </div>
          </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}
