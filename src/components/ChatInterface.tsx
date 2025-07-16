import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, Send, Bot, User } from 'lucide-react';
import { bergetApi } from '@/services/bergetApi';
import { useToast } from '@/hooks/use-toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { securityService } from '@/lib/security';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatInterfaceProps {
  meetingContext?: string;
  meetingTitle?: string;
  className?: string;
  initialMessage?: string;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  meetingContext,
  meetingTitle,
  className = "",
  initialMessage
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Lägg till välkomstmeddelande när komponenten mountas
  useEffect(() => {
    const welcomeMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'assistant',
      content: meetingContext 
        ? `Hej! Jag kan hjälpa dig med frågor om ${meetingTitle || 'detta möte'}. Vad vill du veta?`
        : 'Hej! Jag kan hjälpa dig med frågor om dina möten, protokoll och mötesplanering. Vad kan jag hjälpa dig med?',
      timestamp: new Date()
    };
    setMessages([welcomeMessage]);

    // Skicka initialt meddelande om det finns
    if (initialMessage && initialMessage.trim()) {
      setTimeout(() => {
        setInputMessage(initialMessage);
        // Auto-skicka efter en kort delay
        setTimeout(() => {
          const userMessage: ChatMessage = {
            id: (Date.now() + 1).toString(),
            role: 'user',
            content: initialMessage.trim(),
            timestamp: new Date()
          };
          setMessages(prev => [...prev, userMessage]);
          setInputMessage('');
          setIsLoading(true);

          bergetApi.chatWithMeetings(initialMessage.trim(), meetingContext)
            .then(response => {
              const assistantMessage: ChatMessage = {
                id: (Date.now() + 2).toString(),
                role: 'assistant',
                content: securityService.sanitizeHtml(response),
                timestamp: new Date()
              };
              setMessages(prev => [...prev, assistantMessage]);
            })
            .catch(error => {
              console.error('Chat error:', error);
            })
            .finally(() => {
              setIsLoading(false);
            });
        }, 500);
      }, 100);
    }
  }, [meetingContext, meetingTitle, initialMessage]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    // Sanitize user input
    const sanitizedMessage = securityService.sanitizeInput(inputMessage.trim());
    
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: sanitizedMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await bergetApi.chatWithMeetings(userMessage.content, meetingContext);
      
      // Sanitize the AI response
      const sanitizedResponse = securityService.sanitizeHtml(response);
      
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: sanitizedResponse,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      toast({
        title: "Chat misslyckades",
        description: securityService.createSafeErrorMessage(error),
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <Card className={`apple-card border-0 h-[500px] flex flex-col ${className}`}>
      <CardHeader className="pb-3 px-4">
        <CardTitle className="flex items-center text-lg font-semibold">
          <MessageSquare className="w-5 h-5 mr-2 text-primary" />
          {meetingContext ? `Chat om ${meetingTitle || 'mötet'}` : 'AI-assistent'}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col p-0">
        <ScrollArea className="flex-1 h-full">
          <div className="space-y-3 pb-3 px-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex items-start space-x-3 ${
                  message.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                }`}
              >
                <div className={`p-2 rounded-full flex-shrink-0 ${
                  message.role === 'user' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {message.role === 'user' ? (
                    <User className="w-4 h-4" />
                  ) : (
                    <Bot className="w-4 h-4" />
                  )}
                </div>
                
                <div className={`flex-1 max-w-[80%] ${
                  message.role === 'user' ? 'text-right' : ''
                }`}>
                  <div className={`p-3 rounded-2xl ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground ml-auto'
                      : 'bg-muted/50 text-foreground'
                  }`}>
                    <div className="text-sm">
                      {message.role === 'assistant' ? (
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm]}
                          components={{
                            p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                            h1: ({ children }) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
                            h2: ({ children }) => <h2 className="text-base font-semibold mb-2">{children}</h2>,
                            h3: ({ children }) => <h3 className="text-sm font-medium mb-1">{children}</h3>,
                            ul: ({ children }) => <ul className="list-disc pl-4 mb-2">{children}</ul>,
                            ol: ({ children }) => <ol className="list-decimal pl-4 mb-2">{children}</ol>,
                            li: ({ children }) => <li className="mb-1">{children}</li>,
                            strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                            em: ({ children }) => <em className="italic">{children}</em>,
                            code: ({ children }) => <code className="bg-muted px-1 py-0.5 rounded text-xs">{children}</code>,
                            pre: ({ children }) => <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">{children}</pre>,
                            blockquote: ({ children }) => <blockquote className="border-l-2 border-muted-foreground pl-2 italic">{children}</blockquote>,
                          }}
                        >
                          {message.content}
                        </ReactMarkdown>
                      ) : (
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 px-1">
                    {message.timestamp.toLocaleTimeString('sv-SE', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </p>
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex items-start space-x-3">
                <div className="p-2 rounded-full bg-muted text-muted-foreground">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="p-3 rounded-2xl bg-muted/50">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div ref={messagesEndRef} />
        </ScrollArea>
        
        <div className="p-4 pt-3 border-t border-border/30">
          <div className="flex space-x-2">
            <Input
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Skriv din fråga här..."
              disabled={isLoading}
              className="flex-1 rounded-2xl border-border/40 bg-muted/30 focus:bg-background transition-colors"
            />
            <Button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isLoading}
              className="apple-button bg-primary hover:bg-primary/90 text-primary-foreground px-4"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};