"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { PageTransition } from "@/components/ui/motion";
import { useToast } from "@/components/ui/toast";
import { MessageCircle, Send, Clock, CheckCircle, AlertTriangle, User } from "lucide-react";

interface Ticket {
  id: string;
  user_email: string | null;
  user_name: string | null;
  user_plan: string | null;
  message: string;
  ai_response: string | null;
  admin_reply: string | null;
  status: string;
  source: string;
  created_at: string;
  replied_at: string | null;
}

export default function SupportPage() {
  const { toast } = useToast();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetch("/api/admin/support")
      .then((r) => r.json())
      .then((d) => setTickets(d.tickets || []))
      .catch(() => toast("Failed to load tickets", "error"))
      .finally(() => setLoading(false));
  }, [toast]);

  const handleReply = async () => {
    if (!selectedTicket || !reply.trim()) return;
    setSending(true);
    try {
      const res = await fetch("/api/admin/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId: selectedTicket.id, reply: reply.trim() }),
      });
      if (!res.ok) throw new Error();
      toast("Reply sent to user!", "success");
      setTickets((prev) =>
        prev.map((t) =>
          t.id === selectedTicket.id
            ? { ...t, status: "replied", admin_reply: reply.trim(), replied_at: new Date().toISOString() }
            : t
        )
      );
      setSelectedTicket((prev) => prev ? { ...prev, status: "replied", admin_reply: reply.trim() } : null);
      setReply("");
    } catch {
      toast("Failed to send reply", "error");
    } finally {
      setSending(false);
    }
  };

  const openTickets = tickets.filter((t) => t.status === "open");
  const repliedTickets = tickets.filter((t) => t.status === "replied");

  return (
    <PageTransition className="max-w-5xl mx-auto py-6 px-4">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
          <MessageCircle className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-zinc-100">Support Inbox</h1>
          <p className="text-sm text-zinc-400">
            {openTickets.length} open {openTickets.length === 1 ? "ticket" : "tickets"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Ticket List */}
        <div className="space-y-2">
          {loading && <p className="text-zinc-400 text-sm">Loading...</p>}

          {openTickets.length > 0 && (
            <p className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-2">
              Open ({openTickets.length})
            </p>
          )}
          {openTickets.map((t) => (
            <Card
              key={t.id}
              hover
              className={`cursor-pointer transition-all ${selectedTicket?.id === t.id ? "ring-1 ring-amber-500/50" : ""}`}
              onClick={() => { setSelectedTicket(t); setReply(""); }}
            >
              <CardContent className="p-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-zinc-200 truncate">
                        {t.user_name || t.user_email || "Unknown user"}
                      </span>
                      <Badge variant="amber" className="text-[10px] shrink-0">{t.user_plan}</Badge>
                    </div>
                    <p className="text-xs text-zinc-400 truncate mt-0.5">{t.message}</p>
                    <p className="text-[10px] text-zinc-400 mt-1">
                      <Clock className="w-3 h-3 inline mr-1" />
                      {new Date(t.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {repliedTickets.length > 0 && (
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-400 mt-4 mb-2">
              Replied ({repliedTickets.length})
            </p>
          )}
          {repliedTickets.map((t) => (
            <Card
              key={t.id}
              hover
              className={`cursor-pointer opacity-60 hover:opacity-100 transition-all ${selectedTicket?.id === t.id ? "ring-1 ring-emerald-500/50 opacity-100" : ""}`}
              onClick={() => { setSelectedTicket(t); setReply(""); }}
            >
              <CardContent className="p-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-medium text-zinc-300 truncate block">
                      {t.user_name || t.user_email || "Unknown"}
                    </span>
                    <p className="text-xs text-zinc-400 truncate mt-0.5">{t.message}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {!loading && tickets.length === 0 && (
            <div className="text-center py-12 text-zinc-400">
              <CheckCircle className="w-8 h-8 mx-auto mb-3 text-emerald-400" />
              <p className="text-sm">No support tickets. All clear!</p>
            </div>
          )}
        </div>

        {/* Ticket Detail + Reply */}
        <div>
          {selectedTicket ? (
            <Card>
              <CardContent className="p-4 space-y-4">
                {/* User info */}
                <div className="flex items-center gap-3 pb-3 border-b border-white/[0.10]">
                  <div className="w-10 h-10 rounded-full bg-violet-500/20 flex items-center justify-center">
                    <User className="w-5 h-5 text-violet-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-zinc-200">{selectedTicket.user_name || "Unknown"}</p>
                    <p className="text-xs text-zinc-400">{selectedTicket.user_email || "No email"}</p>
                  </div>
                  <Badge variant={selectedTicket.status === "open" ? "amber" : "default"} className="ml-auto">
                    {selectedTicket.status}
                  </Badge>
                </div>

                {/* User's message */}
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-zinc-400 font-medium mb-1">Their message</p>
                  <div className="bg-amber-500/8 border border-amber-500/20 rounded-lg p-3 text-sm text-zinc-200">
                    {selectedTicket.message}
                  </div>
                </div>

                {/* AI response */}
                {selectedTicket.ai_response && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-zinc-400 font-medium mb-1">AI responded</p>
                    <div className="bg-white/[0.04] rounded-lg p-3 text-sm text-zinc-300">
                      {selectedTicket.ai_response}
                    </div>
                  </div>
                )}

                {/* Admin reply (if already replied) */}
                {selectedTicket.admin_reply && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-emerald-400 font-medium mb-1">Your reply</p>
                    <div className="bg-emerald-500/8 border border-emerald-500/20 rounded-lg p-3 text-sm text-zinc-200">
                      {selectedTicket.admin_reply}
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-1">
                      Sent {selectedTicket.replied_at ? new Date(selectedTicket.replied_at).toLocaleString() : ""}
                    </p>
                  </div>
                )}

                {/* Reply box */}
                {selectedTicket.status === "open" && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-zinc-400 font-medium mb-1">Your reply (sent via email)</p>
                    <Textarea
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      placeholder="Type your reply to the user..."
                      className="min-h-[100px] text-sm"
                    />
                    <Button
                      onClick={handleReply}
                      loading={sending}
                      disabled={!reply.trim()}
                      className="w-full mt-2"
                    >
                      <Send className="w-4 h-4" /> Send Reply
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="text-center py-20 text-zinc-400">
              <MessageCircle className="w-8 h-8 mx-auto mb-3" />
              <p className="text-sm">Select a ticket to view details and reply</p>
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
