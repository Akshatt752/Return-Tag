import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { getErrorMessage } from "../api/client";
import { formatDate, timeAgo } from "../utils/format";
import { ErrorNote } from "./ErrorNote";
import Spinner from "./Spinner";

const MAX = 1000;

// Shared by the owner inbox and the finder page. `me` is "owner" or "finder";
// the other side is shown by role only (or the finder's chosen nickname).
export default function ChatThread({ messages, me, otherName, onSend, closedNote, placeholder = "Write a message…" }) {
  const listRef = useRef(null);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const send = async (e) => {
    e?.preventDefault();
    const text = body.trim();
    if (!text || sending) return;
    setError("");
    setSending(true);
    try {
      await onSend(text);
      setBody("");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send(e);
  };

  return (
    <div className="sheet flex flex-col overflow-hidden">
      <ol
        ref={listRef}
        className="flex max-h-[60vh] min-h-48 flex-col gap-3 overflow-y-auto p-4 sm:p-5"
        aria-label="Conversation"
        aria-live="polite"
      >
        {messages.length === 0 && <li className="m-auto text-sm text-ink-3">No messages yet.</li>}
        {messages.map((m) => {
          if (m.sender === "system") {
            return (
              <li key={m.id} className="mx-auto max-w-md text-center text-xs leading-relaxed text-ink-3">
                {m.body}
                <span className="block font-mono text-[10px]">{formatDate(m.createdAt, true)}</span>
              </li>
            );
          }
          const mine = m.sender === me;
          return (
            <li key={m.id} className={`flex max-w-[85%] flex-col ${mine ? "self-end items-end" : "self-start items-start"}`}>
              <span className="mb-1 text-[11px] text-ink-3">
                {mine ? "You" : otherName} · <time dateTime={m.createdAt} title={formatDate(m.createdAt, true)}>{timeAgo(m.createdAt)}</time>
              </span>
              <p
                className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed break-words whitespace-pre-wrap ${
                  mine ? "rounded-br-sm bg-ink text-paper" : "rounded-bl-sm border border-line bg-muted text-ink"
                }`}
              >
                {m.body}
              </p>
            </li>
          );
        })}
      </ol>

      {closedNote ? (
        <p className="border-t border-line bg-muted/50 px-4 py-3 text-center text-sm text-ink-2">{closedNote}</p>
      ) : (
        <form onSubmit={send} className="border-t border-line p-3 sm:p-4">
          <ErrorNote className="mb-3">{error}</ErrorNote>
          <label htmlFor="chat-reply" className="sr-only">
            Reply
          </label>
          <div className="flex items-end gap-2">
            <textarea
              id="chat-reply"
              className="input min-h-11 resize-none"
              rows={2}
              maxLength={MAX}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={placeholder}
            />
            <button type="submit" className="btn-primary h-11 shrink-0 px-4" disabled={!body.trim() || sending} aria-label="Send message">
              {sending ? <Spinner className="size-4" /> : <Send className="size-4" aria-hidden="true" />}
            </button>
          </div>
          <p className="mt-1.5 flex justify-between font-mono text-[10px] text-ink-3">
            <span>Links are removed automatically. Ctrl/⌘ + Enter to send.</span>
            <span>
              {body.length}/{MAX}
            </span>
          </p>
        </form>
      )}
    </div>
  );
}
