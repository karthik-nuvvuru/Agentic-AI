import AddIcon from "@mui/icons-material/Add";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import CloseIcon from "@mui/icons-material/Close";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import MenuIcon from "@mui/icons-material/Menu";
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
  Menu,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getAuthHeader, clearTokens, setTokens, getTokens } from "./auth";
import AuthScreen from "./AuthScreen";
import { ScrollContainer } from "./components/ScrollContainer";
import { WelcomeScreen } from "./components/WelcomeScreen";

const DRAWER_W = 260;
const API = import.meta.env.VITE_API_BASE || "";
const MAX_F = 10_485_760;
const EXTS = [".pdf", ".txt", ".md", ".csv", ".json"];

/* ── types ──────────────────────────────────────────────────────────── */
type Src = { source: string; idx: number };
type CM = { role: "user" | "assistant"; content: string; sources?: Src[]; files?: string[] };
type Conv = { id: string; title: string; created_at?: string; updated_at?: string };
type CF = Conv & { messages: { role: string; content: string; created_at: string }[] };
type PF = { file: File; prog: number; done: boolean; err?: string };

/* ── markdown parser ────────────────────────────────────────────────── */
type MC = { t: "c"; l?: string; c: string } | { t: "t"; c: string };
const pMd = (s: string): MC[] => {
  const r: MC[] = [], re = /^```(\w*)\n([\s\S]*?)^```$/gm;
  let p = 0, m: RegExpExecArray | null;
  while ((m = re.exec(s))) { if (m.index > p) r.push({ t: "t", c: s.slice(p, m.index).replace(/\n+$/, "") }); r.push({ t: "c", l: m[1] || undefined, c: m[2].trimEnd() }); p = m.index + m[0].length; }
  if (p < s.length) r.push({ t: "t", c: s.slice(p) }); return r;
};

function ICode({ text }: { text: string }) {
  const segs = text.split(/(`[^`]+`)/g);
  return <>{segs.map((s, i) => {
    if (s.startsWith("`") && s.endsWith("`")) return <Box key={i} component="code" sx={{ px: .5, py: .1, borderRadius: .5, fontSize: ".8em", bgcolor: "rgba(99,102,241,.12)", color: "#a78bfa", fontFamily: "'JetBrains Mono',monospace" }}>{s.slice(1, -1)}</Box>;
    return s;
  })}</>;
}

function CBlock({ lang, code }: { lang?: string; code: string }) {
  const [ok, setOk] = useState(false);
  return (
    <Box sx={{ my: 1.5, borderRadius: 2, overflow: "hidden", border: "1px solid rgba(255,255,255,.06)", bgcolor: "#0a0a0e" }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 2, py: .6, borderBottom: "1px solid rgba(255,255,255,.04)", bgcolor: "rgba(255,255,255,.015)" }}>
        <Typography sx={{ color: "text.disabled", fontWeight: 600, fontSize: ".65rem", letterSpacing: ".05em", textTransform: "uppercase" }}>{lang || "code"}</Typography>
        <Button size="small" onClick={async () => { await navigator.clipboard.writeText(code); setOk(true); setTimeout(() => setOk(false), 2e3); }} sx={{ fontSize: ".65rem", fontWeight: 600, textTransform: "none", color: ok ? "#34d399" : "text.disabled", px: 1, py: .2, borderRadius: 1, minWidth: 0, bgcolor: "transparent", "&:hover": { bgcolor: "rgba(255,255,255,.04)" } }}>
          <ContentCopyIcon sx={{ fontSize: 13, mr: ok ? 0 : .4 }} />{ok ? "Copied" : "Copy"}
        </Button>
      </Stack>
      <Box component="pre" sx={{ m: 0, p: 2, overflowX: "auto", fontSize: ".78rem", lineHeight: 1.7, fontFamily: "'JetBrains Mono',monospace", color: "#e4e4e7", "&::-webkit-scrollbar": { height: 3 }, "&::-webkit-scrollbar-thumb": { bgcolor: "rgba(255,255,255,.08)", borderRadius: 2 } }}>{code}</Box>
    </Box>
  );
}

function MsgBody({ content }: { content: string }) { const cs = useMemo(() => pMd(content), [content]); return <>{cs.map((x, i) => x.t === "c" ? <CBlock key={i} lang={x.l} code={x.c} /> : x.c.split("\n").map((l, j) => <span key={j}>{j > 0 && <br />}<ICode text={l} /></span>))}</>; }

/* ── helpers ────────────────────────────────────────────────────────── */
const fI = (n: string) => { const e = "." + n.split(".").pop()!.toLowerCase(); const m: Record<string, string> = { ".pdf": "PDF", ".txt": "TXT", ".md": "MD", ".csv": "CSV", ".json": "JSON" }; return m[e] || "FILE"; };
const fS = (b: number) => b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`;

/* ── user bubble ────────────────────────────────────────────────────── */
function UB({ m }: { m: CM }) { return (
  <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 5 }}>
    <Box sx={{ maxWidth: "70%", minWidth: 0 }}>
      {m.files?.map((f, i) => <Box key={i} sx={{ display: "inline-flex", alignItems: "center", gap: .5, px: 1, py: .3, borderRadius: 1, mr: 1, mb: .75, bgcolor: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.06)", fontSize: ".62rem", fontWeight: 500, color: "text.secondary" }}>{fI(f)} {f}</Box>)}
      <Box sx={{ px: 3, py: 1.8, borderRadius: "18px 4px 18px 18px", backgroundImage: "linear-gradient(135deg,#6366f1 0%,#7c3aed 100%)", color: "#fff", whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: 1.6, fontSize: ".9rem", boxShadow: "0 1px 4px rgba(99,102,241,.12)", letterSpacing: "-.01em" }}>{m.content}</Box>
    </Box>
  </Box>
); }

/* ── assistant bubble ───────────────────────────────────────────────── */
function AB({ m }: { m: CM }) { return (
  <Box sx={{ display: "flex", justifyContent: "flex-start", mb: 5, animation: "fadeInUp .25s ease-out" }}>
    <Stack direction="row" spacing={2} sx={{ maxWidth: "70%", minWidth: 0, width: "100%" }}>
      <Avatar sx={{ width: 28, height: 28, flexShrink: 0, bgcolor: "rgba(99,102,241,.08)", border: "1px solid rgba(99,102,241,.12)", mt: .25 }}><SmartToyIcon sx={{ fontSize: 14, color: "#818cf8" }} /></Avatar>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Box sx={{ lineHeight: 1.75, fontSize: ".9rem", color: "#d4d4d8" }}><MsgBody content={m.content} /></Box>
        {m.sources?.length ? <Stack direction="row" spacing={.5} sx={{ mt: 2, flexWrap: "wrap", gap: .5 }}>{m.sources.map((s, i) => <Box key={i} sx={{ px: 1, py: .2, borderRadius: .5, fontSize: ".62rem", fontWeight: 600, bgcolor: "rgba(99,102,241,.06)", color: "#818cf8", border: "1px solid rgba(99,102,241,.08)", animation: "chipIn .25s ease-out", animationDelay: `${i * .05}s`, animationFillMode: "both" }}>{s.source || `src ${s.idx + 1}`}</Box>)}</Stack> : null}
        <Stack direction="row" sx={{ mt: 1 }}>
          <Tooltip title="Copy"><IconButton size="small" onClick={() => navigator.clipboard.writeText(m.content)} sx={{ p: .4, color: "rgba(255,255,255,.15)", "&:hover": { color: "#fff" } }}><ContentCopyIcon sx={{ fontSize: 14 }} /></IconButton></Tooltip>
        </Stack>
      </Box>
    </Stack>
  </Box>
); }

/* ── typing dots ────────────────────────────────────────────────────── */
function TD() { return (
  <Box sx={{ display: "flex", justifyContent: "flex-start", mb: 5, animation: "fadeIn .3s" }}>
    <Stack direction="row" spacing={2}>
      <Avatar sx={{ width: 28, height: 28, flexShrink: 0, bgcolor: "rgba(99,102,241,.08)", border: "1px solid rgba(99,102,241,.12)", mt: .25 }}><SmartToyIcon sx={{ fontSize: 14, color: "#818cf8" }} /></Avatar>
      <Stack direction="row" spacing={1.5} sx={{ px: 2, py: 1.2, borderRadius: "2px 16px 16px 16px", bgcolor: "rgba(255,255,255,.02)", border: "1px solid rgba(255,255,255,.04)" }}>
        {[0, 1, 2].map(i => <Box key={i} sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "#6366f1", animation: "typingDot 1.2s ease-in-out infinite", animationDelay: `${i * .2}s`, opacity: .4 }} />)}
      </Stack>
    </Stack>
  </Box>
); }

/* ── sidebar list ───────────────────────────────────────────────────── */
function SBox({ convs, convId, onNew, onSelect, onDelete }: { convs: Conv[]; convId: string | null; onNew: () => void; onSelect: (s: string) => void; onDelete: (s: string) => void }) {
  const gs = useMemo(() => {
    const n = new Date(); const td = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
    const g: [string, Conv[]][] = [["Today", []], ["Yesterday", []], ["Past 7 days", []], ["Past 30 days", []], ["Older", []]];
    for (const c of convs) { const t = c.updated_at ? new Date(c.updated_at).getTime() : 0; if (t >= td) g[0][1].push(c); else if (t >= td - 864e5) g[1][1].push(c); else if (t >= td - 7 * 864e5) g[2][1].push(c); else if (t >= td - 30 * 864e5) g[3][1].push(c); else g[4][1].push(c); }
    return g.filter(([, a]) => a.length);
  }, [convs]);
  const fmt = (iso?: string) => iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
  return (
    <Stack sx={{ height: "100%" }}>
      <Box sx={{ p: 1.5 }}>
        <Button fullWidth variant="contained" startIcon={<AddIcon sx={{ fontSize: 17 }} />} onClick={onNew} sx={{ textTransform: "none", fontWeight: 600, borderRadius: 2, py: .85, fontSize: ".8rem", bgcolor: "rgba(255,255,255,.06)", color: "#d4d4d8", border: "1px solid rgba(255,255,255,.08)", transition: "all .15s", "&:hover": { bgcolor: "rgba(255,255,255,.1)", color: "#fff" } }}>New Chat</Button>
      </Box>
      <Box sx={{ height: "1px", mx: 1.5, mb: .5, bgcolor: "rgba(255,255,255,.03)" }} />
      <Stack flex={1} sx={{ overflow: "auto" }}>
        {gs.length === 0 && <Stack alignItems="center" sx={{ flexGrow: 1, justifyContent: "center", opacity: .3, px: 3, mt: 8 }}><Typography sx={{ fontSize: ".8rem", color: "text.disabled", textAlign: "center" }}>No conversations yet</Typography></Stack>}
        {gs.map(([lb, items]) => (
          <Box key={lb} sx={{ mb: 1 }}>
            <Typography sx={{ px: 2, py: .5, color: "text.disabled", fontWeight: 600, fontSize: ".6rem", letterSpacing: ".06em", textTransform: "uppercase" }}>{lb}</Typography>
            {items.map(c => { const a = c.id === convId; return (
              <ListItemButton key={c.id} dense onClick={() => onSelect(c.id)} selected={a} sx={{ borderRadius: 1.5, mx: 1, my: .2, transition: "all .15s", bgcolor: a ? "rgba(99,102,241,.08)" : "transparent", "&:hover": { bgcolor: "rgba(255,255,255,.04)" }, position: "relative", pr: a ? 4 : 2 }}>
                <Typography noWrap sx={{ fontFamily: "-apple-system,BlinkMacSystemFont,sans-serif", fontWeight: a ? 500 : 400, color: a ? "#c4b5fd" : "text.primary", fontSize: ".8rem", letterSpacing: "-.01em" }}>{c.title}</Typography>
                <IconButton edge="end" size="small" onClick={e => { e.stopPropagation(); onDelete(c.id); }} sx={{ opacity: a ? 0.6 : 0, transition: "opacity .15s", position: "absolute", right: 6, p: .3, color: "text.disabled", "&:hover": { color: "#f87171" }, ".MuiListItemButton-root:hover &": { opacity: 0.7 } }}><DeleteOutlineIcon sx={{ fontSize: 13 }} /></IconButton>
              </ListItemButton>
            ); })}
          </Box>
        ))}
      </Stack>
    </Stack>
  );
}

/* ── app core ────────────────────────────────────────────────────────── */
type AUser = { id: string; email: string; name?: string };

function AppCore({ user, onLogout }: { user: AUser; onLogout: () => void }) {
  const [convs, setConvs] = useState<Conv[]>([]);
  const [convId, setConvId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<CM[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [streamT, setStreamT] = useState("");
  const [streamS, setStreamS] = useState<Src[]>([]);
  const [actrl, setCtrl] = useState<AbortController | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [files, setFiles] = useState<PF[]>([]);
  const [dragging, setDragging] = useState(false);
  const [menuEl, setMenuEl] = useState<null | HTMLElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const attachRef = useRef<HTMLInputElement>(null);
  const canSend = input.trim().length > 0 && !busy;
  const hAuth = useCallback(() => getAuthHeader(), []);
  const tok = useMemo(() => getAuthHeader()["Authorization"] || "", []);

  const load = useCallback(async () => { const r = await fetch(`${API}/v1/conversations`, { headers: { Authorization: tok } }).catch(() => undefined); if (r?.ok) setConvs(await r.json()); }, [tok]);
  useEffect(() => { void load(); }, [load]);

  const newChat = async () => { setConvId(null); setMsgs([]); setStreamT(""); setStreamS([]); setBusy(false); setInput(""); setFiles([]); setDrawer(false); const r = await fetch(`${API}/v1/conversations`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: tok }, body: "{}" }).catch(() => undefined); if (r?.ok) { const c: Conv = await r.json(); setConvs(p => [c, ...p]); setConvId(c.id); } };

  const pick = async (id: string) => { setConvId(id); setMsgs([]); setStreamT(""); setStreamS([]); setFiles([]); setDrawer(false); const r = await fetch(`${API}/v1/conversations/${id}`, { headers: { Authorization: tok } }).catch(() => undefined); if (r?.ok) { const f: CF = await r.json(); setMsgs(f.messages.map(m => ({ role: m.role as "user" | "assistant", content: m.content }))); } };
  const nuke = async (id: string) => { await fetch(`${API}/v1/conversations/${id}`, { method: "DELETE", headers: { Authorization: tok } }).catch(() => {}); setConvs(p => p.filter(c => c.id !== id)); if (convId === id) { setConvId(null); setMsgs([]); } };
  const eConv = async () => { if (convId) return convId; const r = await fetch(`${API}/v1/conversations`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: tok }, body: "{}" }).catch(() => undefined); if (r?.ok) { const c: Conv = await r.json(); setConvs(p => [c, ...p]); setConvId(c.id); return c.id; } return ""; };

  const addFiles = useCallback((fl: FileList | File[]) => { const n: PF[] = []; Array.from(fl).forEach(f => { const e = "." + (f.name.split(".").pop() || "").toLowerCase(); if (!EXTS.includes(e) || f.size > MAX_F) n.push({ file: f, prog: 0, done: true, err: f.size > MAX_F ? "Too large (10 MB)" : "Unsupported" }); else n.push({ file: f, prog: 0, done: false }); }); setFiles(p => [...p, ...n]); }, []);
  const rmF = useCallback((i: number) => setFiles(p => { const n = [...p]; n.splice(i, 1); return n; }), []);
  const ing = useCallback(async () => { const todo = files.filter(f => !f.done); const ok: string[] = []; for (const p of todo) { try { const fd = new FormData(); fd.append("file", p.file); const u = new URL(`${API}/v1/rag/ingest/file`); u.searchParams.set("source", p.file.name); const iv = setInterval(() => setFiles(x => x.map(y => y === p ? { ...y, prog: Math.min(y.prog + 15, 90) } : y)), 200); const r = await fetch(u.toString(), { method: "POST", body: fd }); clearInterval(iv); if (!r.ok) throw new Error(""); setFiles(x => x.map(y => y === p ? { ...y, prog: 100, done: true } : y)); ok.push(p.file.name); } catch { setFiles(x => x.map(y => y === p ? { ...y, done: true, err: "Failed" } : y)); } } return ok; }, [files]);

  const send = async () => { const txt = input.trim(); if (!txt && files.filter(f => !f.err).length === 0) return; const fn = files.filter(f => !f.err).map(f => f.file.name); await ing(); const cid = await eConv(); if (txt) setMsgs(p => [...p, { role: "user" as const, content: txt, files: fn.length ? fn : undefined }]); else if (fn.length) setMsgs(p => [...p, { role: "user" as const, content: `Uploaded ${fn.length} file${fn.length > 1 ? "s" : ""}.`, files: fn }]); setInput(""); setBusy(true); setStreamT(""); setStreamS([]); setFiles([]); const c = new AbortController(); setCtrl(c); let at = "", as: Src[] = []; try { const body = txt || "Summarize the uploaded documents."; const r = await fetch(`${API}/v1/rag/chat/stream`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: tok }, body: JSON.stringify({ message: body, conversation_id: cid || undefined, top_k: 6, stream: true }), signal: c.signal }); if (!r.ok) throw new Error(`HTTP ${r.status}`); const rd = r.body?.getReader(); if (!rd) throw new Error("No reader"); const dec = new TextDecoder(); let buf = ""; for (;;) { const { done, value } = await rd.read(); if (done) break; buf += dec.decode(value, { stream: true }); const ps = buf.split("\n\n"); buf = ps.pop() ?? ""; for (const pc of ps) { if (!pc.trim()) continue; const em = pc.match(/^event:\s*(.+)$/m), dm = pc.match(/^data:\s*(.+)$/m); if (!em || !dm) continue; let j: any; try { j = JSON.parse(dm[1].trim()); } catch { continue; } if (em[1].trim() === "token") { at += j.token ?? ""; setStreamT(at); } else if (em[1].trim() === "sources") { as = j.map((s: any) => ({ source: s.source, idx: s.idx })); setStreamS([...as]); } } } } catch (e: any) { if (e.name !== "AbortError") setMsgs(p => [...p, { role: "assistant" as const, content: `Error: ${e.message}` }]); } finally { if (at) { setMsgs(p => [...p, { role: "assistant" as const, content: at, sources: as.length ? [...as] : undefined }]); await load(); } setStreamT(""); setStreamS([]); setBusy(false); setCtrl(null); } };
  const stop = () => { actrl?.abort(); if (streamT) { setMsgs(p => [...p, { role: "assistant" as const, content: streamT, sources: streamS.length ? [...streamS] : undefined }]); void load(); } setStreamT(""); setStreamS([]); setBusy(false); setCtrl(null); };
  const ing1 = async (f: File) => { setBusy(true); try { const fd = new FormData(); fd.append("file", f); const u = new URL(`${API}/v1/rag/ingest/file`); u.searchParams.set("source", f.name); const r = await fetch(u.toString(), { method: "POST", body: fd }); const d = await r.json(); setMsgs(p => [...p, { role: "assistant" as const, content: `Ingested "${f.name}" (${d.chunks_added} chunks).` }]); } catch { setMsgs(p => [...p, { role: "assistant" as const, content: "Ingest error" }]); } finally { setBusy(false); if (fileRef.current) fileRef.current.value = ""; } };

  return (
    <Stack direction="row" sx={{ height: "100vh", overflow: "hidden", bgcolor: "#09090b" }}>
      <input ref={attachRef} hidden type="file" multiple accept=".pdf,.txt,.md,.csv,.json" onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
      <input ref={fileRef} hidden type="file" accept=".pdf,.txt,.md,.csv,.json" onChange={e => { const f = e.target.files?.[0]; if (f) void ing1(f); e.target.value = ""; }} />
      <Box sx={{ width: DRAWER_W, flexShrink: 0, borderRight: "1px solid rgba(255,255,255,.03)", display: { xs: "none", sm: "flex" }, flexDirection: "column" }}>
        <SBox convs={convs} convId={convId} onNew={newChat} onSelect={pick} onDelete={nuke} />
      </Box>
      <Drawer open={drawer} onClose={() => setDrawer(false)} PaperProps={{ sx: { width: DRAWER_W, bgcolor: "#09090b", borderRight: "1px solid rgba(255,255,255,.03)" } }}><SBox convs={convs} convId={convId} onNew={newChat} onSelect={pick} onDelete={nuke} /></Drawer>
      <Stack flex={1} sx={{ overflow: "hidden" }}>
        {dragging && <Box sx={{ position: "absolute", inset: 0, zIndex: 10, bgcolor: "rgba(99,102,241,.03)", backdropFilter: "blur(4px)", border: "2px dashed rgba(99,102,241,.25)", display: "flex", alignItems: "center", justifyContent: "center", animation: "fadeIn .15s" }}><Typography sx={{ color: "#818cf8", fontWeight: 500, fontSize: ".95rem" }}>Drop files to analyze</Typography></Box>}

        <AppBar position="sticky" elevation={0} sx={{ bgcolor: "#09090b", borderBottom: "1px solid rgba(255,255,255,.04)" }}>
          <Toolbar sx={{ py: 0, minHeight: "44px !important" }}>
            <IconButton edge="start" sx={{ display: { sm: "none" }, mr: .5, p: .5 }} onClick={() => setDrawer(true)}><MenuIcon sx={{ fontSize: 17 }} /></IconButton>
            <IconButton size="small" onClick={newChat} sx={{ display: { sm: "flex" }, mr: .5, p: .5, color: "text.secondary", "&:hover": { bgcolor: "rgba(255,255,255,.05)" } }}><AddIcon sx={{ fontSize: 17 }} /></IconButton>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.3, px: 1, py: .3, borderRadius: 1.5, bgcolor: "rgba(255,255,255,.04)" }}>
              <SmartToyIcon sx={{ fontSize: 14, color: "#a78bfa" }} />
              <Typography sx={{ fontWeight: 500, fontSize: ".78rem", color: "#d4d4d8" }}>RAG Assistant</Typography>
            </Box>
            <Typography sx={{ mx: 1.5, color: "text.disabled", fontSize: ".65rem", display: { xs: "none", sm: "block" } }}>/</Typography>
            <Typography sx={{ fontWeight: 400, fontSize: ".78rem", color: "text.secondary", display: { xs: "none", sm: "block" } }}>{convId ? convs.find(c => c.id === convId)?.title || "Chat" : "New Chat"}</Typography>
            <Box flex={1} />
            <Tooltip title="Upload"><IconButton size="small" onClick={() => fileRef.current?.click()} disabled={busy} sx={{ color: "text.secondary", p: .5, "&:hover": { color: "#d4d4d8" } }}><UploadFileIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
            <Tooltip title="Account"><IconButton size="small" onClick={e => setMenuEl(e.currentTarget)} sx={{ ml: .5, p: .2 }}><Avatar sx={{ width: 24, height: 24, bgcolor: "rgba(99,102,241,.15)", fontSize: ".55rem", fontWeight: 700, color: "#a78bfa" }}>{user.name?.charAt(0).toUpperCase() || user.email.charAt(0).toUpperCase()}</Avatar></IconButton></Tooltip>
            <Menu anchorEl={menuEl} open={!!menuEl} onClose={() => setMenuEl(null)} anchorOrigin={{ horizontal: "right", vertical: "bottom" }} transformOrigin={{ horizontal: "right", vertical: "top" }} PaperProps={{ sx: { bgcolor: "#17171b", border: "1px solid rgba(255,255,255,.06)", borderRadius: 2, minWidth: 170, p: .5 } }}>
              <MenuItem disabled sx={{ py: 1, opacity: 1 }}><Box sx={{ minWidth: 0, pr: 2 }}><Typography sx={{ fontWeight: 500, fontSize: ".8rem", color: "#d4d4d8" }}>{user.name || "User"}</Typography><Typography sx={{ fontSize: ".68rem", color: "text.disabled" }}>{user.email}</Typography></Box></MenuItem>
              <Box sx={{ height: 1, bgcolor: "rgba(255,255,255,.06)", mx: 0, my: .5 }} />
              <MenuItem onClick={() => { setMenuEl(null); onLogout(); }} sx={{ color: "#f87171", fontSize: ".8rem" }}>Sign out</MenuItem>
            </Menu>
          </Toolbar>
        </AppBar>

        <ScrollContainer>
          {msgs.length === 0 && !streamT && <WelcomeScreen onQuickQuestion={q => setInput(q)} />}
          {msgs.map((m, i) => m.role === "user" ? <UB key={i} m={m} /> : <AB key={i} m={m} />)}
          {streamT && (
            <Box sx={{ display: "flex", justifyContent: "flex-start", mb: 5, animation: "fadeIn .25s" }}>
              <Stack direction="row" spacing={2} sx={{ maxWidth: "70%", minWidth: 0, width: "100%" }}>
                <Avatar sx={{ width: 28, height: 28, flexShrink: 0, bgcolor: "rgba(99,102,241,.08)", border: "1px solid rgba(99,102,241,.12)", mt: .25 }}><SmartToyIcon sx={{ fontSize: 14, color: "#818cf8" }} /></Avatar>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Box sx={{ lineHeight: 1.75, fontSize: ".9rem", color: "#d4d4d8" }}><MsgBody content={streamT} /><Box component="span" sx={{ display: "inline-block", width: 2, height: "1em", bgcolor: "#6366f1", ml: .5, animation: "blink .8s infinite", verticalAlign: "text-bottom" }} /></Box>
                  {streamS.length > 0 && <Stack direction="row" spacing={.5} sx={{ mt: 2, flexWrap: "wrap", gap: .5 }}>{streamS.map((s, i) => <Box key={i} sx={{ px: 1, py: .2, borderRadius: .5, fontSize: ".62rem", fontWeight: 600, bgcolor: "rgba(99,102,241,.06)", color: "#818cf8", border: "1px solid rgba(99,102,241,.08)" }}>{s.source || `src ${s.idx + 1}`}</Box>)}</Stack>}
                </Box>
              </Stack>
            </Box>
          )}
          {busy && !streamT && <TD />}
        </ScrollContainer>

        {/* ── compact input bar ── */}
        <Box sx={{ px: { xs: 1, sm: 2 }, py: 1, maxWidth: 768, mx: "auto", width: "100%" }}>
          {files.length > 0 && (
            <Stack direction="row" spacing={.75} sx={{ mb: 1, flexWrap: "wrap", gap: .5, animation: "fadeIn .2s" }}>
              {files.map((f, i) => (
                <Box key={i} sx={{ display: "flex", alignItems: "center", gap: .75, px: 1, py: .35, borderRadius: 1.5, bgcolor: "rgba(255,255,255,.03)", border: `1px solid ${f.err ? "rgba(239,68,68,.15)" : "rgba(255,255,255,.06)"}`, animation: "chipIn .2s ease-out", animationDelay: `${i * .04}s`, animationFillMode: "both" }}>
                  <Box sx={{ width: 18, height: 18, borderRadius: .5, bgcolor: f.err ? "rgba(239,68,68,.1)" : f.prog >= 100 ? "rgba(52,211,153,.1)" : "rgba(99,102,241,.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Typography sx={{ fontSize: ".55rem", fontWeight: 700, color: f.err ? "#f87171" : f.prog >= 100 ? "#34d399" : "#818cf8" }}>{f.err ? "!" : f.prog >= 100 ? "✓" : fI(f.file.name)}</Typography>
                  </Box>
                  <Typography sx={{ fontSize: ".7rem", maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "text.primary" }}>{f.file.name}</Typography>
                  <Typography sx={{ fontSize: ".58rem", color: "text.disabled" }}>{fS(f.file.size)}</Typography>
                  <IconButton size="small" onClick={() => rmF(i)} sx={{ p: 0.25, color: "text.disabled", ":hover": { color: "#f87171" } }}><CloseIcon sx={{ fontSize: 14 }} /></IconButton>
                </Box>
              ))}
            </Stack>
          )}
          <Paper elevation={0} sx={{ p: "4px 4px 4px 10px", borderRadius: 3, bgcolor: "rgba(255,255,255,.03)", border: `1px solid ${dragging ? "rgba(99,102,241,.25)" : "rgba(255,255,255,.05)"}`, transition: "all .2s", "&:focus-within": { borderColor: "rgba(99,102,241,.3)", boxShadow: "0 0 0 2px rgba(99,102,241,.06)" } }}
            onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}>
            <Stack direction="row" alignItems="flex-end" spacing={0}>
              <IconButton size="small" onClick={() => attachRef.current?.click()} sx={{ color: "rgba(255,255,255,.3)", p: .5, mb: .25, "&:hover": { color: "#d4d4d8", bgcolor: "rgba(255,255,255,.05)" } }}><AttachFileIcon sx={{ fontSize: 16 }} /></IconButton>
              <TextField fullWidth placeholder="Message…" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (canSend) void send(); } }} multiline maxRows={4} minRows={1} sx={{ "& .MuiInputBase-root": { color: "#e4e4e7", bgcolor: "transparent", border: "none", boxShadow: "none" }, "& .MuiInputBase-input": { padding: "5px 4px", fontSize: ".86rem", lineHeight: 1.4 }, "& .MuiInputBase-input::placeholder": { color: "rgba(255,255,255,.18)", fontSize: ".84rem" } }} InputProps={{ disableUnderline: true }} />
              {busy ? (
                <IconButton onClick={stop} sx={{ color: "#f87171", p: .5, mb: .25 }}><StopCircleIcon sx={{ fontSize: 20 }} /></IconButton>
              ) : (
                <IconButton disabled={!canSend && files.filter(f => !f.err).length === 0} onClick={() => void send()} sx={{ p: .5, mb: .25, color: canSend ? "#fff" : "rgba(255,255,255,.15)", bgcolor: canSend ? "transparent" : "rgba(255,255,255,.03)", "&:hover": { bgcolor: canSend ? "transparent" : "rgba(255,255,255,.06)" }, transition: "all .15s" }}>
                  <SendIcon sx={{ fontSize: 17, transform: canSend ? "rotate(-45deg)" : "none", transition: "transform .15s" }} />
                </IconButton>
              )}
            </Stack>
          </Paper>
        </Box>
      </Stack>
    </Stack>
  );
}

/* ── exported root ──────────────────────────────────────────────────── */
export default function App() {
  const [user, setUser] = useState<AUser | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => { (async () => { const t = getTokens(); if (!t) { setReady(true); return; } try { const r = await fetch(`${API}/v1/auth/me`, { headers: { Authorization: `Bearer ${t.access_token}` } }); if (!r.ok) throw 0; const d = await r.json(); setUser(d.user); } catch { clearTokens(); } finally { setReady(true); } })(); }, []);
  if (!ready) return null;
  if (!user) return <AuthScreen onSuccess={d => { setTokens(d.access_token, d.refresh_token); setUser(d.user as AUser); }} />;
  return <AppCore user={user} onLogout={() => { clearTokens(); setUser(null); }} />;
}
