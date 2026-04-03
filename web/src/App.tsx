import AddIcon from "@mui/icons-material/Add";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import MenuIcon from "@mui/icons-material/Menu";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import SendIcon from "@mui/icons-material/Send";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import StopCircleIcon from "@mui/icons-material/StopCircle";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Drawer,
  IconButton,
  ListItemButton,
  Paper,
  Stack,
  TextField,
  Toolbar,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollContainer } from "./components/ScrollContainer";
import { WelcomeScreen } from "./components/WelcomeScreen";

const DRAWER_W = 270;
const API = import.meta.env.VITE_API_BASE || "";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
type Source = { source: string; idx: number };
type ChatMsg = { role: "user" | "assistant"; content: string; sources?: Source[] };
type Conv = { id: string; title: string; created_at?: string; updated_at?: string };
type ConvFull = Conv & { messages: { role: string; content: string; created_at: string }[] };

/* ------------------------------------------------------------------ */
/*  Markdown-ish text parser → rich chunks                             */
/* ------------------------------------------------------------------ */
type MDC = { type: "code"; lang?: string; code: string } | { type: "text"; text: string };
/** Simple fence-aware splitter so inline text vs code blocks are
 *  rendered separately instead of as a raw wall of text. */
function parseMdChunks(text: string): MDC[] {
  const parts: MDC[] = [];
  const re = /^```(\w*)\n([\s\S]*?)^```$/gm;
  let prev = 0, m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > prev) parts.push({ type: "text", text: text.slice(prev, m.index).replace(/\n+$/, "") });
    parts.push({ type: "code", lang: m[1] || undefined, code: m[2].trimEnd() });
    prev = m.index + m[0].length;
  }
  if (prev < text.length) parts.push({ type: "text", text: text.slice(prev) });
  return parts;
}

function InlineMd({ text }: { text: string }) {
  // split on `code` spans and render each piece
  const segs = text.split(/(`[^`]+`)/g);
  return (
    <>
      {segs.map((s, i) => {
        if (s.startsWith("`") && s.endsWith("`")) {
          return (
            <Box
              key={i}
              component="code"
              sx={{
                px: 0.6, py: 0.15, borderRadius: 1, fontSize: ".82em",
                bgcolor: "rgba(102,126,234,.12)", color: "#c4b5fd",
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              }}
            >
              {s.slice(1, -1)}
            </Box>
          );
        }
        // bold **text**
        const bSegs = s.split(/(\*\*[^*]+\*\*)/g);
        return (
          <span key={i}>
            {bSegs.map((b, j) => {
              if (b.startsWith("**") && b.endsWith("**")) {
                return <strong key={j}>{b.slice(2, -2)}</strong>;
              }
              return b;
            })}
          </span>
        );
      })}
    </>
  );
}

function CodeBlock({ lang, code }: { lang?: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  return (
    <Box
      sx={{
        my: 1.5, borderRadius: 2, overflow: "hidden",
        border: "1px solid rgba(255,255,255,.08)",
        bgcolor: "#13141b",
      }}
    >
      {/* header */}
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{
          px: 2, py: 0.75,
          borderBottom: "1px solid rgba(255,255,255,.06)",
          bgcolor: "rgba(255,255,255,.03)",
        }}
      >
        <Typography variant="caption" sx={{ color: "text.disabled", fontWeight: 600, fontSize: ".7rem", letterSpacing: ".04em", textTransform: "uppercase" }}>
          {lang || "code"}
        </Typography>
        <Button
          size="small"
          startIcon={copied ? null : <ContentCopyIcon sx={{ fontSize: 14 }} />}
          onClick={handleCopy}
          sx={{
            fontSize: ".7rem", fontWeight: 600, textTransform: "none", color: copied ? "#4ade80" : "text.secondary",
            px: 1, py: 0.3, borderRadius: 1, minWidth: 0,
            bgcolor: "transparent",
            "&:hover": { bgcolor: "rgba(255,255,255,.06)" },
          }}
        >
          {copied ? "Copied!" : "Copy"}
        </Button>
      </Stack>
      {/* body */}
      <Box
        component="pre"
        sx={{
          m: 0, p: 2, overflowX: "auto",
          fontSize: ".82rem", lineHeight: 1.7,
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          color: "#e2e8f0",
          "&::-webkit-scrollbar": { height: "4px" },
          "&::-webkit-scrollbar-track": { bgcolor: "transparent" },
          "&::-webkit-scrollbar-thumb": { bgcolor: "rgba(255,255,255,.1)", borderRadius: "2px" },
        }}
      >
        {code}
      </Box>
    </Box>
  );
}

function MessageContent({ content }: { content: string }) {
  const chunks = useMemo(() => parseMdChunks(content), [content]);
  return (
    <>
      {chunks.map((c, i) => {
        if (c.type === "code") return <CodeBlock key={i} lang={c.lang} code={c.code} />;
        const lines = c.text.split("\n");
        return (
          <span key={i}>
            {lines.map((line, j) => (
              <span key={j}>
                {j > 0 && <br />}
                <InlineMd text={line} />
              </span>
            ))}
          </span>
        );
      })}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Copy helper for plain-text messages                                */
/* ------------------------------------------------------------------ */
function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <IconButton
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setOk(true);
        setTimeout(() => setOk(false), 1500);
      }}
      size="small"
      sx={{ opacity: 0.4, transition: "opacity .15s", "&:hover": { opacity: 1, bgcolor: "transparent" } }}
    >
      <ContentCopyIcon sx={{ fontSize: 15 }} />
      {ok && <Typography variant="caption" sx={{ ml: 0.5, color: "#4ade80", fontSize: ".65rem" }}>Copied</Typography>}
    </IconButton>
  );
}

/* ------------------------------------------------------------------ */
/*  Message bubble                                                     */
/* ------------------------------------------------------------------ */
function Bubble({ msg }: { msg: ChatMsg }) {
  const user = msg.role === "user";
  return (
    <Box sx={{ display: "flex", justifyContent: user ? "flex-end" : "flex-start", mb: 3, animation: "fadeInUp .35s ease-out", px: { xs: 1.5, sm: 3 } }}>
      {!user && (
        <Avatar sx={{ width: 32, height: 32, mr: 2, flexShrink: 0, bgcolor: "rgba(102,126,234,.10)" }}>
          <SmartToyIcon sx={{ fontSize: 16, color: "#818cf8" }} />
        </Avatar>
      )}
      <Box sx={{ maxWidth: "75%", minWidth: 0 }}>
        {user ? (
          <Box
            sx={{
              px: 3, py: 2, borderRadius: "20px 20px 4px 20px",
              backgroundImage: "linear-gradient(135deg,#667eea 0%,#764ba2 100%)",
              color: "#fff", whiteSpace: "pre-wrap", wordBreak: "break-word",
              boxShadow: "0 2px 16px rgba(102,126,234,.22)",
              lineHeight: 1.7, fontSize: ".92rem",
            }}
          >
            {msg.content}
          </Box>
        ) : (
          <Box
            sx={{
              px: 2.5, py: 2, borderRadius: "4px 20px 20px 20px",
              bgcolor: "rgba(255,255,255,.03)",
              border: "1px solid rgba(255,255,255,.06)",
              whiteSpace: "normal", wordBreak: "break-word",
              lineHeight: 1.75, fontSize: ".92rem", color: "#e2e8f0",
            }}
          >
            <MessageContent content={msg.content} />
          </Box>
        )}
        {!user && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.75 }}>
            <CopyBtn text={msg.content} />
            {msg.sources?.length ? (
              <Stack direction="row" spacing={0.5} sx={{ ml: 1, flexWrap: "wrap" }}>
                {msg.sources.map((s, i) => (
                  <Box
                    key={i}
                    sx={{
                      px: 1.2, py: 0.2, borderRadius: 1, fontSize: ".65rem", fontWeight: 600,
                      bgcolor: "rgba(102,126,234,.08)", color: "#818cf8",
                      border: "1px solid rgba(102,126,234,.15)",
                    }}
                  >
                    {s.source || `Source ${s.idx + 1}`}
                  </Box>
                ))}
              </Stack>
            ) : null}
          </Box>
        )}
      </Box>
      {user && (
        <Avatar sx={{ width: 32, height: 32, ml: 2, flexShrink: 0, bgcolor: "rgba(255,255,255,.05)" }}>
          <PersonOutlineIcon sx={{ fontSize: 16, color: "#818cf8" }} />
        </Avatar>
      )}
    </Box>
  );
}

/* ------------------------------------------------------------------ */
/*  Typing indicator                                                   */
/* ------------------------------------------------------------------ */
function TypingDots() {
  return (
    <Box sx={{ display: "flex", justifyContent: "flex-start", mb: 3, animation: "fadeIn .3s ease-out", px: { xs: 1.5, sm: 3 } }}>
      <Avatar sx={{ width: 32, height: 32, mr: 2, flexShrink: 0, bgcolor: "rgba(102,126,234,.10)" }}>
        <SmartToyIcon sx={{ fontSize: 16, color: "#818cf8" }} />
      </Avatar>
      <Stack
        direction="row"
        spacing={1}
        sx={{
          px: 2, py: 1.5, borderRadius: "4px 20px 20px 20px",
          bgcolor: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)",
        }}
      >
        {[0, 1, 2].map((i) => (
          <Box key={i} sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: "#818cf8", animation: "typingDot 1.2s ease-in-out infinite", animationDelay: `${i * .2}s` }} />
        ))}
      </Stack>
    </Box>
  );
}

/* ================================================================== */
/*  App                                                                */
/* ================================================================== */
export default function App() {
  // conversations
  const [convs, setConvs] = useState<Conv[]>([]);
  const [convId, setConvId] = useState<string | null>(null);

  // messages
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);

  // send state
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [streamTxt, setStreamTxt] = useState("");
  const [streamSrc, setStreamSrc] = useState<Source[]>([]);
  const [abortCtrl, setAbortCtrl] = useState<AbortController | null>(null);

  // sidebar drawer (mobile)
  const [drawer, setDrawer] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // voice
  const [voice, setVoice] = useState(false);
  const recogRef = useRef<any>(null);

  const canSend = input.trim().length > 0 && !busy;

  /* ---- load conversations ---- */
  const loadConvs = useCallback(async () => {
    const r = await fetch(`${API}/v1/conversations`).catch(() => undefined);
    if (r?.ok) setConvs(await r.json());
  }, []);

  useEffect(() => { void loadConvs(); }, [loadConvs]);

  /* ---- new chat ---- */
  async function makeNewChat() {
    setConvId(null); setMsgs([]); setStreamTxt(""); setStreamSrc([]); setBusy(false); setInput("");
    setDrawer(false);
    const r = await fetch(`${API}/v1/conversations`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).catch(() => undefined);
    if (r?.ok) { const c: Conv = await r.json(); setConvs((p) => [c, ...p]); setConvId(c.id); }
  }

  /* ---- select conversation ---- */
  async function pickConv(id: string) {
    setConvId(id); setMsgs([]); setStreamTxt(""); setStreamSrc([]); setDrawer(false);
    const r = await fetch(`${API}/v1/conversations/${id}`).catch(() => undefined);
    if (r?.ok) {
      const full: ConvFull = await r.json();
      setMsgs(full.messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })));
    }
  }

  /* ---- delete conversation ---- */
  async function nukeConv(id: string) {
    await fetch(`${API}/v1/conversations/${id}`, { method: "DELETE" }).catch(() => {});
    setConvs((p) => p.filter((c) => c.id !== id));
    if (convId === id) { setConvId(null); setMsgs([]); }
  }

  /* ---- ensure a conversation exists for sending ---- */
  async function ensureConv(): Promise<string> {
    if (convId) return convId;
    const r = await fetch(`${API}/v1/conversations`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).catch(() => undefined);
    if (r?.ok) { const c: Conv = await r.json(); setConvs((p) => [c, ...p]); setConvId(c.id); return c.id; }
    return "";
  }

  /* ---- send message (SSE streaming) ---- */
  async function send() {
    const txt = input.trim();
    if (!txt) return;
    const cid = await ensureConv();
    setMsgs((p) => [...p, { role: "user", content: txt }]);
    setInput(""); setBusy(true); setStreamTxt(""); setStreamSrc([]);

    const ctrl = new AbortController();
    setAbortCtrl(ctrl);

    let accumTxt = "";
    let accumSrc: Source[] = [];

    try {
      const res = await fetch(`${API}/v1/rag/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: txt, conversation_id: cid || undefined, top_k: 6, stream: true }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No body reader");
      const dec = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const pieces = buf.split("\n\n");
        buf = pieces.pop() ?? "";
        for (const piece of pieces) {
          if (!piece.trim()) continue;
          const evM = piece.match(/^event:\s*(.+)$/m);
          const daM = piece.match(/^data:\s*(.+)$/m);
          if (!evM || !daM) continue;
          let j: any;
          try { j = JSON.parse(daM[1].trim()); } catch { continue; }
          if (evM[1].trim() === "token") {
            accumTxt += j.token ?? "";
            setStreamTxt(accumTxt);
          } else if (evM[1].trim() === "sources") {
            accumSrc = j.map((s: any) => ({ source: s.source, idx: s.idx }));
            setStreamSrc(accumSrc);
          }
        }
      }
    } catch (e: any) {
      if (e.name !== "AbortError") {
        setMsgs((p) => [...p, { role: "assistant", content: `Error: ${e.message ?? String(e)}` }]);
      }
    } finally {
      if (accumTxt) {
        setMsgs((p) => [...p, { role: "assistant", content: accumTxt, sources: accumSrc.length ? accumSrc : undefined }]);
        await loadConvs();
      }
      setStreamTxt(""); setStreamSrc([]); setBusy(false); setAbortCtrl(null);
    }
  }

  function stopStream() {
    abortCtrl?.abort();
    if (streamTxt) {
      setMsgs((p) => [...p, { role: "assistant", content: streamTxt, sources: streamSrc.length ? streamSrc : undefined }]);
      void loadConvs();
    }
    setStreamTxt(""); setStreamSrc([]); setBusy(false); setAbortCtrl(null);
  }

  /* ---- voice ---- */
  useEffect(() => {
    if (!("SpeechRecognition" in window) && !("webkitSpeechRecognition" in window)) return;
    const C = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    const r = new C();
    r.continuous = false; r.interimResults = true; r.lang = "en-US";
    r.onresult = (ev: any) => setInput(Array.from(ev.results).map((x: any) => x[0].transcript).join(""));
    r.onend = r.onerror = () => setVoice(false);
    recogRef.current = r;
  }, []);

  useEffect(() => {
    const r = recogRef.current;
    if (!r) return;
    voice ? r.start() : r.stop();
  }, [voice]);

  /* ---- ingest ---- */
  async function ingestFile(f: File) {
    setBusy(true);
    try {
      const fd = new FormData(); fd.append("file", f);
      const url = new URL(`${API}/v1/rag/ingest/file`); url.searchParams.set("source", f.name);
      const res = await fetch(url.toString(), { method: "POST", body: fd });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      setMsgs((p) => [...p, { role: "assistant", content: `Ingested "${f.name}" (${d.chunks_added} chunks).` }]);
    } catch (e) {
      setMsgs((p) => [...p, { role: "assistant", content: `Ingest error: ${e instanceof Error ? e.message : String(e)}` }]);
    } finally { setBusy(false); if (fileRef.current) fileRef.current.value = ""; }
  }

  /* ================================================================== */
  /*  Render                                                             */
  /* ================================================================== */
  return (
    <Stack direction="row" sx={{ height: "100vh", overflow: "hidden", bgcolor: "#0e0f15" }}>
      {/* ── sidebar (desktop) ── */}
      <Box sx={{ width: DRAWER_W, flexShrink: 0, borderRight: "1px solid rgba(255,255,255,.05)", display: { xs: "none", sm: "flex" }, flexDirection: "column", bgcolor: "#11121a" }}>
        <SideContent convs={convs} convId={convId} onNew={makeNewChat} onSelect={pickConv} onDelete={nukeConv} />
      </Box>

      {/* ── sidebar (mobile drawer) ── */}
      <Drawer open={drawer} onClose={() => setDrawer(false)} PaperProps={{ sx: { width: DRAWER_W, bgcolor: "#11121a" } }}>
        <SideContent convs={convs} convId={convId} onNew={makeNewChat} onSelect={pickConv} onDelete={nukeConv} />
      </Drawer>

      {/* ── main chat area ── */}
      <Stack flex={1} sx={{ overflow: "hidden" }}>
        {/* Top bar */}
        <AppBar position="sticky" elevation={0} sx={{ bgcolor: "rgba(14,15,21,.85)", backdropFilter: "blur(14px)", borderBottom: "1px solid rgba(255,255,255,.04)" }}>
          <Toolbar sx={{ py: 0.5 }}>
            <IconButton edge="start" sx={{ display: { sm: "none" }, mr: 1 }} onClick={() => setDrawer(true)}>
              <MenuIcon sx={{ fontSize: 20 }} />
            </IconButton>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexGrow: 1 }}>
              <Avatar sx={{ width: 30, height: 30, bgcolor: "rgba(102,126,234,.12)" }}>
                <SmartToyIcon sx={{ fontSize: 16, color: "#818cf8" }} />
              </Avatar>
              <Stack>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.2, letterSpacing: ".02em" }}>
                  Agentic AI
                </Typography>
                <Typography variant="caption" sx={{ color: "text.disabled", fontSize: ".65rem", lineHeight: 1.2 }}>
                  Powered by RAG
                </Typography>
              </Stack>
            </Box>
            <input ref={fileRef} hidden type="file" accept=".pdf,.txt,.md" onChange={(e) => { const f = e.target.files?.[0]; if (f) void ingestFile(f); }} />
            <IconButton
              size="small"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              sx={{ color: "text.secondary", "&:hover": { bgcolor: "rgba(255,255,255,.06)" } }}
            >
              <UploadFileIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Toolbar>
        </AppBar>

        {/* message list */}
        <ScrollContainer>
          {msgs.length === 0 && !streamTxt && <WelcomeScreen onQuickQuestion={(q) => setInput(q)} />}
          {msgs.map((m, i) => <Bubble key={i} msg={m} />)}

          {/* streaming bubble */}
          {streamTxt && (
            <Box sx={{ display: "flex", mb: 3, animation: "fadeIn .3s ease-out", px: { xs: 1.5, sm: 3 } }}>
              <Avatar sx={{ width: 32, height: 32, mr: 2, flexShrink: 0, bgcolor: "rgba(102,126,234,.10)" }}>
                <SmartToyIcon sx={{ fontSize: 16, color: "#818cf8" }} />
              </Avatar>
              <Box sx={{ maxWidth: "75%" }}>
                <Box sx={{ px: 2.5, py: 2, borderRadius: "4px 20px 20px 20px", bgcolor: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)", lineHeight: 1.75, fontSize: ".92rem", color: "#e2e8f0", whiteSpace: "normal" }}>
                  <MessageContent content={streamTxt} />
                  <Box component="span" sx={{ display: "inline-block", width: 2, height: "1em", bgcolor: "#667eea", ml: 0.5, animation: "blink .8s ease-in-out infinite", verticalAlign: "text-bottom" }} />
                </Box>
                {streamSrc.length > 0 && (
                  <Stack direction="row" spacing={0.5} sx={{ mt: 1, flexWrap: "wrap" }}>
                    {streamSrc.map((s, i) => (
                      <Box key={i} sx={{ px: 1.2, py: 0.2, borderRadius: 1, fontSize: ".65rem", fontWeight: 600, bgcolor: "rgba(102,126,234,.08)", color: "#818cf8", border: "1px solid rgba(102,126,234,.15)" }}>
                        {s.source || `Source ${s.idx + 1}`}
                      </Box>
                    ))}
                  </Stack>
                )}
              </Box>
            </Box>
          )}

          {busy && !streamTxt && <TypingDots />}
        </ScrollContainer>

        {/* input box */}
        <Box sx={{ px: { xs: 1, sm: 2 }, py: 1, borderTop: "1px solid rgba(255,255,255,.04)", bgcolor: "#0e0f15" }}>
          <Paper
            elevation={0}
            sx={{
              p: "6px 6px 6px 14px",
              borderRadius: 3,
              bgcolor: "rgba(255,255,255,.035)",
              border: "1px solid rgba(255,255,255,.07)",
              transition: "border-color .2s, box-shadow .2s",
              "&:focus-within": {
                borderColor: "rgba(102,126,234,.35)",
                boxShadow: "0 0 0 2px rgba(102,126,234,.08)",
              },
            }}
          >
            <Stack direction="row" spacing={0.5} alignItems="flex-end">
              <TextField
                fullWidth
                placeholder="Ask anything…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (canSend) void send(); } }}
                multiline
                maxRows={5}
                minRows={1}
                sx={{
                  "& .MuiInputBase-root": {
                    color: "#e2e8f0",
                    bgcolor: "transparent",
                    border: "none",
                    boxShadow: "none",
                    borderRadius: 0,
                  },
                  "& .MuiInputBase-input": {
                    padding: "8px 6px",
                    fontSize: ".9rem",
                    lineHeight: 1.5,
                  },
                  "& .MuiInputBase-input::placeholder": {
                    color: "rgba(255,255,255,.22)",
                    fontSize: ".88rem",
                  },
                }}
                InputProps={{
                  disableUnderline: true,
                  startAdornment: (
                    <Stack direction="row" sx={{ mr: 0.5 }}>
                      <IconButton
                        size="small"
                        disabled={!("SpeechRecognition" in window) || busy}
                        onClick={() => setVoice(!voice)}
                        sx={{
                          p: 0.75,
                          color: voice ? "#f87171" : "rgba(255,255,255,.35)",
                          "&:hover": { bgcolor: "rgba(255,255,255,.06)" },
                        }}
                      >
                        {voice ? <MicOffIcon sx={{ fontSize: 17 }} /> : <MicIcon sx={{ fontSize: 17 }} />}
                      </IconButton>
                    </Stack>
                  ),
                }}
              />
              <Box sx={{ pb: "5px", display: "flex", alignItems: "center" }}>
                {busy ? (
                  <IconButton onClick={stopStream} size="small" sx={{ color: "#f87171" }}>
                    <StopCircleIcon sx={{ fontSize: 22 }} />
                  </IconButton>
                ) : (
                  <IconButton
                    disabled={!canSend}
                    onClick={() => void send()}
                    size="small"
                    sx={{
                      backgroundImage: canSend ? "linear-gradient(135deg,#667eea,#764ba2)" : "none",
                      bgcolor: canSend ? "unset" : "rgba(255,255,255,.04)",
                      p: "7px",
                      transition: "all .2s",
                      color: canSend ? "#fff" : "rgba(255,255,255,.15)",
                      "&:hover": { bgcolor: canSend ? "unset" : "rgba(255,255,255,.06)" },
                      "&:disabled": { color: "rgba(255,255,255,.12)" },
                    }}
                  >
                    <SendIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                )}
              </Box>
            </Stack>
          </Paper>
        </Box>
      </Stack>
    </Stack>
  );
}

/* ================================================================== */
/*  Sidebar content (shared desktop / mobile)                         */
/* ================================================================== */
function SideContent({ convs, convId, onNew, onSelect, onDelete }: { convs: Conv[]; convId: string | null; onNew: () => void; onSelect: (id: string) => void; onDelete: (id: string) => void }) {
  /* Group conversations by recency */
  const groups = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 86_400_000;
    const weekStart = todayStart - 7 * 86_400_000;
    const monthStart = todayStart - 30 * 86_400_000;

    const today: Conv[] = [];
    const yesterday: Conv[] = [];
    const pastWeek: Conv[] = [];
    const pastMonth: Conv[] = [];
    const older: Conv[] = [];

    for (const c of convs) {
      const ts = c.updated_at ? new Date(c.updated_at).getTime() : 0;
      if (ts >= todayStart) today.push(c);
      else if (ts >= yesterdayStart) yesterday.push(c);
      else if (ts >= weekStart) pastWeek.push(c);
      else if (ts >= monthStart) pastMonth.push(c);
      else older.push(c);
    }

    return [
      { label: "Today", items: today },
      { label: "Yesterday", items: yesterday },
      { label: "Past 7 days", items: pastWeek },
      { label: "Past 30 days", items: pastMonth },
      { label: "Older", items: older },
    ].filter((g) => g.items.length > 0);
  }, [convs]);

  const formatDate = (iso?: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <Stack sx={{ height: "100%" }}>
      {/* New chat btn */}
      <Box sx={{ p: 2, pb: 1 }}>
        <Button
          fullWidth
          variant="contained"
          startIcon={<AddIcon />}
          onClick={onNew}
          sx={{
            textTransform: "none",
            fontWeight: 600,
            borderRadius: 2,
            py: 1.2,
            backgroundImage: "linear-gradient(135deg,#667eea,#764ba2)",
            boxShadow: "0 2px 14px rgba(102,126,234,.30)",
            transition: "transform .15s, box-shadow .2s",
            "&:hover": {
              boxShadow: "0 4px 20px rgba(102,126,234,.45)",
              transform: "translateY(-1px)",
            },
          }}
        >
          New Chat
        </Button>
      </Box>

      {/* Divider */}
      <Box sx={{ height: "1px", mx: 2, mb: 1, bgcolor: "rgba(255,255,255,.04)" }} />

      {/* List */}
      <Stack flex={1} sx={{ overflow: "auto", px: 1.5, py: 0.5 }}>
        {groups.length === 0 && (
          <Stack alignItems="center" justifyContent="center" sx={{ flexGrow: 1, opacity: 0.5 }}>
            <Box sx={{ width: 48, height: 48, borderRadius: "50%", bgcolor: "rgba(255,255,255,.04)", display: "flex", alignItems: "center", justifyContent: "center", mb: 2 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.25)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </Box>
            <Typography variant="body2" color="text.disabled" sx={{ fontWeight: 500 }}>
              No conversations yet
            </Typography>
            <Typography variant="caption" color="text.disabled" sx={{ mt: 0.5 }}>
              Start a new chat to begin
            </Typography>
          </Stack>
        )}

        {groups.map((group) => (
          <Box key={group.label} sx={{ mb: 1.5 }}>
            {/* Section label */}
            <Typography
              variant="caption"
              sx={{
                px: 1.5,
                py: 0.4,
                display: "block",
                color: "text.disabled",
                fontWeight: 700,
                fontSize: ".6rem",
                letterSpacing: ".08em",
                textTransform: "uppercase",
              }}
            >
              {group.label}
            </Typography>

            {group.items.map((c) => {
              const active = c.id === convId;
              return (
                <ListItemButton
                  key={c.id}
                  onClick={() => onSelect(c.id)}
                  selected={active}
                  sx={{
                    borderRadius: 1.5,
                    mb: 0.5,
                    py: 1,
                    px: 1.5,
                    transition: "all .15s",
                    position: "relative",
                    ...(active
                      ? {
                          bgcolor: "rgba(102,126,234,.12)",
                          boxShadow: "inset 2.5px 0 0 #667eea",
                          "&:hover": { bgcolor: "rgba(102,126,234,.16)" },
                        }
                      : {
                          "&:hover": { bgcolor: "rgba(255,255,255,.04)" },
                        }),
                  }}
                >
                  {/* Chat icon */}
                  <Box
                    sx={{
                      width: 30,
                      height: 30,
                      borderRadius: 1,
                      mr: 1.5,
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      bgcolor: active ? "rgba(102,126,234,.15)" : "rgba(255,255,255,.03)",
                      transition: "background .15s",
                    }}
                  >
                    <ChatBubbleSmall active={active} />
                  </Box>

                  {/* Title + time */}
                  <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                    <Typography
                      variant="body2"
                      noWrap
                      sx={{
                        fontWeight: active ? 600 : 400,
                        color: active ? "#a8b4ff" : "text.primary",
                        transition: "color .15s",
                        fontSize: active ? ".85rem" : ".82rem",
                      }}
                    >
                      {c.title}
                    </Typography>
                    {c.updated_at && (
                      <Typography
                        variant="caption"
                        sx={{
                          display: "block",
                          color: "text.disabled",
                          fontSize: ".6rem",
                          mt: 0.1,
                        }}
                      >
                        {formatDate(c.updated_at)}
                      </Typography>
                    )}
                  </Box>

                  {/* Delete button — visible on hover or active */}
                  <Box
                    sx={{
                      opacity: active ? 0 : 0,
                      transition: "opacity .15s",
                      ".MuiListItemButton-root:hover &": { opacity: 1 },
                    }}
                  >
                    <IconButton
                      edge="end"
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(c.id);
                      }}
                      sx={{
                        p: 0.5,
                        color: "rgba(255,255,255,.3)",
                        "&:hover": { color: "#f87171", bgcolor: "rgba(248,113,113,.08)" },
                      }}
                    >
                      <DeleteOutlineIcon sx={{ fontSize: 15 }} />
                    </IconButton>
                  </Box>
                </ListItemButton>
              );
            })}
          </Box>
        ))}
      </Stack>
    </Stack>
  );
}

function ChatBubbleSmall({ active }: { active?: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke={active ? "#818cf8" : "rgba(255,255,255,.3)"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
