"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { X, Send, MessageCircle, Loader2 } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply || "No response." }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Failed to connect. Try again." }]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading]);

  return (
    <>
      {/* Floating button — above action bar on mobile */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed z-50 w-14 h-14 rounded-full",
          "right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:bottom-6 md:right-6",
          "bg-gradient-to-br from-violet-600 to-blue-600",
          "shadow-2xl shadow-violet-500/30",
          "flex items-center justify-center",
          "hover:scale-110 active:scale-95 transition-transform"
        )}
        aria-label={isOpen ? "Close chat" : "Open chat assistant"}
      >
        {isOpen ? (
          <X className="w-6 h-6 text-white" />
        ) : (
          <MessageCircle className="w-6 h-6 text-white" />
        )}
      </button>

      {/* Chat window */}
      {isOpen && (
        <div className={cn(
          "fixed z-50 rounded-2xl bg-[#0f0f17] border border-white/[0.08] shadow-2xl flex flex-col overflow-hidden animate-fade-in-scale",
          // Mobile: full width bottom sheet style
          "inset-x-2 bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] top-20 md:inset-auto",
          // Desktop: floating panel
          "md:bottom-24 md:right-6 md:w-[360px] md:h-[480px] md:top-auto md:left-auto"
        )}>
          {/* Header */}
          <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center">
              <span className="text-sm text-white font-bold">G</span>
            </div>
            <div>
              <p className="text-sm font-medium text-white">Genesis Assistant</p>
              <p className="text-[10px] text-emerald-400">Powered by Claude AI</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
            {/* Welcome */}
            <div className="bg-white/[0.04] rounded-xl p-3 text-sm text-white/80 mr-6">
              Hey! I know everything about Genesis Studio. Ask me about features, pricing, prompts, or which model to use. How can I help?
            </div>

            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-xl p-3 text-sm leading-relaxed",
                  msg.role === "user"
                    ? "bg-violet-600/20 text-white ml-8"
                    : "bg-white/[0.04] text-white/80 mr-6"
                )}
              >
                {msg.content}
              </div>
            ))}

            {isLoading && (
              <div className="bg-white/[0.04] rounded-xl p-3 mr-6 flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />
                <span className="text-sm text-white/50">Thinking...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-3 border-t border-white/[0.06] shrink-0">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder="Ask anything..."
                className="flex-1 px-3 py-2 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm placeholder-white/30 focus:outline-none focus:border-violet-500/50"
                disabled={isLoading}
              />
              <button
                onClick={sendMessage}
                disabled={isLoading || !input.trim()}
                className="px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
