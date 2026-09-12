import { useEffect, useMemo, useState } from "react";
import { MessageCircle, Plus, Send, Users } from "lucide-react";
import { requireSupabase } from "../../lib/supabase";

type Conversation = { id: string; kind: "direct" | "group"; name?: string | null; created_by: string; created_at: string };
type Message = { id: string; conversation_id: string; sender_id: string; body: string; message_type: string; created_at: string };

type Props = { userId?: string; role?: string; setToast: (toast: { type: "success" | "error" | "warning"; message: string } | null) => void };

const messageTypes = [
  ["normal", "Normal message"],
  ["tournament_announcement", "Tournament announcement"],
  ["training_schedule", "Training schedule"],
  ["training_plan", "Training plan"],
  ["document", "Document"],
  ["team_announcement", "Team announcement"]
] as const;

export default function MessagingPage({ userId, role, setToast }: Props) {
  const supabase = requireSupabase();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [groupName, setGroupName] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [body, setBody] = useState("");
  const [messageType, setMessageType] = useState("normal");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const selected = useMemo(() => conversations.find((item) => item.id === selectedId), [conversations, selectedId]);
  const canCreateGroup = ["coach", "academy_admin", "admin", "super_admin"].includes(role || "");
  const selectedIsGroupCreator = Boolean(selected?.kind === "group" && selected.created_by === userId);

  async function loadConversations() {
    if (!userId) return;
    const { data, error: queryError } = await supabase
      .from("conversations")
      .select("id, kind, name, created_by, created_at")
      .order("created_at", { ascending: false });
    if (queryError) throw queryError;
    setConversations((data ?? []) as Conversation[]);
    if (!selectedId && data?.[0]?.id) setSelectedId(data[0].id);
  }

  async function loadMessages(conversationId: string) {
    const { data, error: queryError } = await supabase
      .from("messages")
      .select("id, conversation_id, sender_id, body, message_type, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    if (queryError) throw queryError;
    setMessages((data ?? []) as Message[]);
  }

  useEffect(() => {
    void loadConversations().catch((e) => setError(e instanceof Error ? e.message : "Messages could not be loaded."));
  }, [userId]);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    void loadMessages(selectedId).catch((e) => setError(e instanceof Error ? e.message : "Conversation could not be loaded."));
  }, [selectedId]);

  async function startDirect(event: React.FormEvent) {
    event.preventDefault();
    if (!recipientEmail.trim()) return;
    setBusy(true); setError("");
    try {
      const { data, error: rpcError } = await supabase.rpc("create_direct_conversation", { p_recipient_email: recipientEmail.trim() });
      if (rpcError) throw rpcError;
      setSelectedId(String(data));
      setRecipientEmail("");
      await loadConversations();
      setToast({ type: "success", message: "Direct conversation created. Only its two members can read it." });
    } catch (e) { setError(e instanceof Error ? e.message : "Direct conversation could not be created."); }
    finally { setBusy(false); }
  }

  async function createGroup(event: React.FormEvent) {
    event.preventDefault();
    if (!canCreateGroup || !groupName.trim()) return;
    setBusy(true); setError("");
    try {
      const { data, error: rpcError } = await supabase.rpc("create_group_conversation", { p_name: groupName.trim() });
      if (rpcError) throw rpcError;
      setSelectedId(String(data));
      setGroupName("");
      await loadConversations();
      setToast({ type: "success", message: "Group created. Messages will be delivered only to its members." });
    } catch (e) { setError(e instanceof Error ? e.message : "Group could not be created."); }
    finally { setBusy(false); }
  }

  async function addMember(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedId || !memberEmail.trim()) return;
    setBusy(true); setError("");
    try {
      const { error: rpcError } = await supabase.rpc("add_group_member_by_email", { p_conversation_id: selectedId, p_email: memberEmail.trim() });
      if (rpcError) throw rpcError;
      setMemberEmail("");
      setToast({ type: "success", message: "Member added to this group." });
    } catch (e) { setError(e instanceof Error ? e.message : "Member could not be added."); }
    finally { setBusy(false); }
  }

  async function sendMessage(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedId || !body.trim() || !userId) return;
    setBusy(true); setError("");
    try {
      const { error: insertError } = await supabase.from("messages").insert({
        conversation_id: selectedId,
        sender_id: userId,
        body: body.trim(),
        message_type: messageType
      });
      if (insertError) throw insertError;
      setBody("");
      await loadMessages(selectedId);
    } catch (e) { setError(e instanceof Error ? e.message : "Message could not be sent."); }
    finally { setBusy(false); }
  }

  return <FeaturePageLike title="Messages">
    <div className="messaging-layout">
      <aside className="card panel messaging-sidebar">
        <div className="section-heading"><h3><MessageCircle size={18} /> Conversations</h3></div>
        {conversations.length === 0 && <p className="empty-copy">No conversations yet.</p>}
        <div className="conversation-list">{conversations.map((conversation) => <button key={conversation.id} className={`conversation-item ${conversation.id === selectedId ? "active" : ""}`} onClick={() => setSelectedId(conversation.id)}><strong>{conversation.kind === "group" ? conversation.name || "Unnamed group" : "Direct message"}</strong><small>{conversation.kind === "group" ? "Group" : "Private 1:1"}</small></button>)}</div>
        <form className="messaging-create" onSubmit={startDirect}><strong>New direct message</strong><input type="email" placeholder="Recipient account email" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} required /><button className="btn" disabled={busy}><Plus size={15} /> Start</button></form>
        {canCreateGroup && <form className="messaging-create" onSubmit={createGroup}><strong>New coach group</strong><input placeholder="Group name" value={groupName} onChange={(e) => setGroupName(e.target.value)} required /><button className="btn" disabled={busy}><Users size={15} /> Create group</button></form>}
      </aside>
      <section className="card panel messaging-chat">
        {!selected && <div className="empty"><strong>Select or create a conversation</strong><p>Direct messages stay between the two members. Group messages stay inside the selected group.</p></div>}
        {selected && <>
          <div className="messaging-header"><div><p className="eyebrow">{selected.kind === "group" ? "Group" : "Private 1:1"}</p><h3>{selected.kind === "group" ? selected.name || "Unnamed group" : "Direct message"}</h3></div>{selectedIsGroupCreator && <form className="inline-form" onSubmit={addMember}><input type="email" placeholder="Member account email" value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)} required /><button className="btn" disabled={busy}>Add member</button></form>}</div>
          <div className="message-list">{messages.length === 0 && <p className="empty-copy">No messages yet. Send the first one.</p>}{messages.map((message) => <article key={message.id} className={`message-bubble ${message.sender_id === userId ? "mine" : "theirs"}`}><span>{message.message_type.replaceAll("_", " ")}</span><p>{message.body}</p><small>{new Date(message.created_at).toLocaleString()}</small></article>)}</div>
          <form className="message-compose" onSubmit={sendMessage}><select value={messageType} onChange={(e) => setMessageType(e.target.value)} aria-label="Message type">{messageTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><input value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write a secure sports message..." maxLength={4000} required /><button className="btn primary" disabled={busy || !body.trim()}><Send size={16} /> Send</button></form>
        </>}
      </section>
    </div>
    {error && <p className="notice" role="alert">{error}</p>}
  </FeaturePageLike>;
}

function FeaturePageLike({ title, children }: { title: string; children: React.ReactNode }) {
  return <><div className="page-head"><div><p className="eyebrow">AthleteOS V2</p><h2>{title}</h2></div></div>{children}</>;
}
