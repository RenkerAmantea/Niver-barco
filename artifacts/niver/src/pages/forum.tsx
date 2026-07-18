import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useSession } from "@/hooks/use-session";
import { 
  useListPosts, 
  useCreatePost, 
  useListReplies, 
  useCreateReply, 
  getListPostsQueryKey, 
  getListRepliesQueryKey,
  Post,
  Reply
} from "@workspace/api-client-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MessageSquare, Send, CornerDownRight } from "lucide-react";
import { cn } from "@/lib/utils";

function PostReplies({ postId }: { postId: number }) {
  const { session } = useSession();
  const [content, setContent] = useState("");
  const { data: replies, isLoading } = useListReplies(postId, { query: { enabled: !!postId, queryKey: getListRepliesQueryKey(postId) }});
  const createReply = useCreateReply();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !session?.id) return;

    createReply.mutate(
      { postId, data: { guestId: session.id, content: content.trim() } },
      {
        onSuccess: (newReply) => {
          setContent("");
          queryClient.setQueryData(getListRepliesQueryKey(postId), (old: Reply[] | undefined) => {
            return old ? [...old, newReply] : [newReply];
          });
          // Optimistically increment post reply count
          queryClient.setQueryData(getListPostsQueryKey(), (old: Post[] | undefined) => {
            if (!old) return old;
            return old.map(p => p.id === postId ? { ...p, replyCount: p.replyCount + 1 } : p);
          });
        }
      }
    );
  };

  if (isLoading) return <div className="text-sm text-muted-foreground pl-12 py-2">Carregando respostas...</div>;

  return (
    <div className="pl-6 md:pl-12 pt-4 space-y-4 border-l border-white/5 ml-6">
      {replies?.map((reply) => (
        <div key={reply.id} className="flex gap-3 relative">
          <CornerDownRight className="absolute -left-6 top-3 h-4 w-4 text-white/10" />
          <Avatar className="h-8 w-8 border-primary/20 shrink-0">
            {reply.guestAvatarUrl ? <AvatarImage src={reply.guestAvatarUrl} alt={reply.guestName} /> : null}
            <AvatarFallback className="text-xs bg-secondary text-primary">
              {reply.guestName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="bg-black/30 rounded-2xl rounded-tl-none px-4 py-2 border border-white/5 flex-1 max-w-[calc(100%-2rem)]">
            <div className="flex items-baseline justify-between mb-1">
              <span className="font-medium text-sm text-foreground">{reply.guestName}</span>
              <span className="text-[10px] text-muted-foreground ml-2 whitespace-nowrap">
                {formatDistanceToNow(new Date(reply.createdAt), { addSuffix: true, locale: ptBR })}
              </span>
            </div>
            <p className="text-sm text-foreground/90 whitespace-pre-wrap break-words">{reply.content}</p>
          </div>
        </div>
      ))}

      <form onSubmit={handleSubmit} className="flex gap-3 relative mt-4">
        <CornerDownRight className="absolute -left-6 top-3 h-4 w-4 text-white/10" />
        <Avatar className="h-8 w-8 border-primary/20 shrink-0">
          <AvatarFallback className="text-xs bg-secondary text-primary">
            {session?.name.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 flex gap-2">
          <Textarea
            ref={inputRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Escreva uma resposta..."
            className="min-h-[40px] h-[40px] py-2 resize-none rounded-xl text-sm bg-black/40 border-white/10 focus-visible:ring-primary/50"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
          <Button 
            type="submit" 
            size="icon" 
            disabled={!content.trim() || createReply.isPending}
            className="h-[40px] w-[40px] rounded-xl shrink-0 bg-primary/20 text-primary hover:bg-primary/30 hover:text-primary-foreground border border-primary/30"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}


export default function Forum() {
  const { session } = useSession();
  const [, setLocation] = useLocation();
  const [content, setContent] = useState("");
  const [expandedPostId, setExpandedPostId] = useState<number | null>(null);

  const { data: posts, isLoading: isLoadingPosts } = useListPosts();
  const createPost = useCreatePost();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!session) {
      setLocation("/");
    }
  }, [session, setLocation]);

  if (!session) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !session?.id) return;

    createPost.mutate(
      { data: { guestId: session.id, content: content.trim() } },
      {
        onSuccess: (newPost) => {
          setContent("");
          queryClient.setQueryData(getListPostsQueryKey(), (old: Post[] | undefined) => {
            return old ? [newPost, ...old] : [newPost];
          });
        }
      }
    );
  };

  const toggleReplies = (postId: number) => {
    setExpandedPostId(prev => prev === postId ? null : postId);
  };

  return (
    <div className="space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      <div className="mb-6">
        <h2 className="text-2xl font-display font-semibold">Mural do Evento</h2>
        <p className="text-muted-foreground text-sm mt-1">Deixe sua mensagem, combine caronas ou apenas comemore antecipadamente.</p>
      </div>

      {/* New Post Form */}
      <Card className="border-primary/20 bg-card shadow-[0_0_20px_rgba(201,168,76,0.05)]">
        <CardContent className="p-4 sm:p-6">
          <form onSubmit={handleSubmit} className="flex gap-4">
            <Avatar className="h-10 w-10 border-primary/20 hidden sm:flex shrink-0">
              {session.avatarUrl ? <AvatarImage src={session.avatarUrl} alt={session.name} /> : null}
              <AvatarFallback className="bg-secondary text-primary">
                {session.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-3">
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={`No que você está pensando, ${session.name.split(' ')[0]}?`}
                className="bg-black/20 border-white/10 text-base focus-visible:ring-primary/50 resize-y min-h-[100px]"
              />
              <div className="flex justify-end">
                <Button 
                  type="submit" 
                  disabled={!content.trim() || createPost.isPending}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 px-8"
                >
                  {createPost.isPending ? "Publicando..." : "Publicar"}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Posts Feed */}
      <div className="space-y-6">
        {isLoadingPosts ? (
          <div className="space-y-6">
            {[1, 2].map(i => (
              <Card key={i} className="bg-black/20 border-white/5 animate-pulse">
                <CardContent className="p-6">
                  <div className="flex gap-4 mb-4">
                    <div className="h-12 w-12 rounded-full bg-white/5" />
                    <div className="space-y-2 flex-1 pt-1">
                      <div className="h-4 w-32 bg-white/5 rounded" />
                      <div className="h-3 w-20 bg-white/5 rounded" />
                    </div>
                  </div>
                  <div className="h-16 w-full bg-white/5 rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : posts?.length === 0 ? (
          <div className="text-center py-16 px-4 bg-black/10 rounded-xl border border-white/5">
            <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-1">Nenhuma mensagem ainda</h3>
            <p className="text-muted-foreground text-sm">Seja o primeiro a escrever no mural!</p>
          </div>
        ) : (
          posts?.map((post) => (
            <Card key={post.id} className="bg-black/20 border-white/5 overflow-hidden transition-all hover:border-white/10">
              <CardContent className="p-4 sm:p-6 pb-4">
                <div className="flex gap-4">
                  <Avatar className="h-12 w-12 border-primary/20 shrink-0">
                    {post.guestAvatarUrl ? <AvatarImage src={post.guestAvatarUrl} alt={post.guestName} /> : null}
                    <AvatarFallback className="bg-secondary text-primary">
                      {post.guestName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between mb-2">
                      <h4 className="font-medium text-foreground text-base truncate pr-4">{post.guestName}</h4>
                      <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                        {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true, locale: ptBR })}
                      </span>
                    </div>
                    <p className="text-foreground/90 whitespace-pre-wrap break-words leading-relaxed text-[15px]">
                      {post.content}
                    </p>
                    
                    <div className="mt-4 pt-4 border-t border-white/5 flex">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => toggleReplies(post.id)}
                        className={cn(
                          "text-muted-foreground hover:text-primary hover:bg-primary/10 -ml-2",
                          expandedPostId === post.id && "text-primary bg-primary/10"
                        )}
                      >
                        <MessageSquare className="h-4 w-4 mr-2" />
                        {post.replyCount === 0 
                          ? "Responder" 
                          : `${post.replyCount} ${post.replyCount === 1 ? 'resposta' : 'respostas'}`
                        }
                      </Button>
                    </div>
                  </div>
                </div>

                {expandedPostId === post.id && (
                  <div className="mt-2 animate-in slide-in-from-top-2 duration-300">
                    <PostReplies postId={post.id} />
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

    </div>
  );
}
