import { useEffect, useMemo, useRef, useState } from "react";
import { MessageCircle, Send, X } from "lucide-react";
import avatar from "@/assets/carehop-avatar.png";
import { cn } from "@/lib/utils";
import {
  GREETING,
  SUGGESTED_QUESTIONS,
  answerQuestion,
} from "@/lib/clinicFaq";

type ChatMessage = {
  id: string;
  role: "bot" | "user";
  text: string;
  showChips?: boolean;
};

const uid = () => Math.random().toString(36).slice(2);

function Avatar({ className }: { className?: string }) {
  return (
    <img
      src={avatar}
      alt="CareHop assistant"
      loading="lazy"
      width={816}
      height={816}
      className={cn("rounded-full object-cover", className)}
    />
  );
}

export function CareHopWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    { id: uid(), role: "bot", text: GREETING, showChips: true },
  ]);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, typing, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const lastChips = useMemo(() => {
    const last = messages[messages.length - 1];
    return !typing && last?.role === "bot" && last.showChips;
  }, [messages, typing]);

  function ask(question: string) {
    const clean = question.replace(/^[^\p{L}\p{N}]+/u, "").trim();
    if (!clean) return;
    setInput("");
    setMessages((prev) => [
      ...prev.map((m) => ({ ...m, showChips: false })),
      { id: uid(), role: "user", text: clean },
    ]);
    setTyping(true);
    const delay = 400 + Math.random() * 200;
    const t = setTimeout(() => {
      const { response, matched } = answerQuestion(clean);
      setTyping(false);
      setMessages((prev) => [
        ...prev,
        { id: uid(), role: "bot", text: response, showChips: !matched },
      ]);
    }, delay);
    timers.current.push(t);
  }

  return (
    <>
      {/* Floating launcher */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close CareHop assistant" : "Open CareHop assistant"}
        className={cn(
          "fixed right-4 z-50 flex items-center gap-2 rounded-full border border-primary/20 bg-card/90 p-1.5 pr-1.5 shadow-[var(--shadow-elevated)] backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_40px_-12px_oklch(0.6_0.1_195_/_0.5)] sm:pr-4",
          "bottom-20 sm:bottom-6",
        )}
        style={{ paddingBottom: undefined }}
      >
        <span className="relative">
          <Avatar className="h-11 w-11 ring-2 ring-primary/25" />
          <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-card bg-success" />
        </span>
        <span className="hidden text-left sm:block">
          <span className="block text-sm font-semibold leading-tight text-foreground">CareHop</span>
          <span className="block text-[11px] leading-tight text-muted-foreground">Ask me anything</span>
        </span>
        {open ? (
          <X className="mr-1 hidden h-4 w-4 text-muted-foreground sm:block" aria-hidden />
        ) : (
          <MessageCircle className="mr-1 hidden h-4 w-4 text-primary sm:block" aria-hidden />
        )}
      </button>

      {/* Panel */}
      <div
        role="dialog"
        aria-label="CareHop — Your Smart Clinic Companion"
        aria-hidden={!open}
        className={cn(
          "fixed right-3 z-50 flex w-[min(23rem,calc(100vw-1.5rem))] origin-bottom-right flex-col overflow-hidden rounded-3xl border border-border/60 bg-card/85 shadow-[var(--shadow-elevated)] backdrop-blur-xl transition-all duration-300 sm:right-6",
          "bottom-36 max-h-[min(34rem,calc(100dvh-11rem))] sm:bottom-24 sm:max-h-[min(36rem,calc(100dvh-8rem))]",
          open
            ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
            : "pointer-events-none translate-y-3 scale-95 opacity-0",
        )}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 border-b border-border/50 px-4 py-3"
          style={{ background: "var(--gradient-hero)" }}
        >
          <Avatar className="h-11 w-11 ring-2 ring-background/70" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold text-foreground">🐰 CareHop</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-background/70 px-2 py-0.5 text-[10px] font-medium text-foreground/80">
                <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden />
                Online
              </span>
            </div>
            <p className="truncate text-xs text-muted-foreground">Your Smart Clinic Companion</p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close assistant"
            className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {/* Transcript */}
        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {messages.map((m) => (
            <div key={m.id} className={cn("flex gap-2", m.role === "user" ? "justify-end" : "justify-start")}>
              {m.role === "bot" && <Avatar className="mt-0.5 h-7 w-7 shrink-0" />}
              <div
                className={cn(
                  "max-w-[80%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                  m.role === "user"
                    ? "rounded-br-md bg-primary text-primary-foreground"
                    : "rounded-bl-md bg-muted text-foreground",
                )}
              >
                {m.text}
              </div>
            </div>
          ))}

          {typing && (
            <div className="flex items-center gap-2">
              <Avatar className="h-7 w-7 shrink-0" />
              <div className="flex items-center gap-2 rounded-2xl rounded-bl-md bg-muted px-3.5 py-2.5">
                <span className="text-xs text-muted-foreground">CareHop is thinking</span>
                <span className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/70"
                      style={{ animationDelay: `${i * 120}ms` }}
                    />
                  ))}
                </span>
              </div>
            </div>
          )}

          {lastChips && (
            <div className="flex flex-wrap gap-2 pt-1">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => ask(q)}
                  className="rounded-full border border-primary/25 bg-primary-soft/60 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-primary-soft"
                >
                  {q}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Composer */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
          className="flex items-center gap-2 border-t border-border/50 bg-background/60 px-3 py-3"
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about appointments, payments…"
            aria-label="Message CareHop"
            className="h-10 flex-1 rounded-full border border-border bg-card px-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
          />
          <button
            type="submit"
            disabled={!input.trim() || typing}
            aria-label="Send message"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
          >
            <Send className="h-4 w-4" aria-hidden />
          </button>
        </form>
      </div>
    </>
  );
}
