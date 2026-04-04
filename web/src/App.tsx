import {
  AppBar,
  Avatar,
  Box,
  CssBaseline,
  Drawer,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  ThemeProvider,
  Toolbar,
  Tooltip,
  Typography,
  createTheme,
  useMediaQuery,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DarkModeOutlined from "@mui/icons-material/DarkModeOutlined";
import LightModeOutlined from "@mui/icons-material/LightModeOutlined";
import MenuIcon from "@mui/icons-material/Menu";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import SendIcon from "@mui/icons-material/Send";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import StopCircleIcon from "@mui/icons-material/StopCircle";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom/client";

import { getAuthHeader, clearTokens, getTokens } from "./auth";
import AuthScreen from "./AuthScreen";
import { ScrollContainer } from "./components/ScrollContainer";
import { WelcomeScreen } from "./components/WelcomeScreen";
import AssistantMessage from "./components/AssistantMessage";
import UserMessage from "./components/UserMessage";
import { InputArea } from "./components/InputArea";
import { Sidebar } from "./components/Sidebar";
import { ChatSkeleton, SidebarSkeletons } from "./components/Skeleton";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
type Src = { source: string; idx: number };
type CM = {
  role: "user" | "assistant";
  content: string;
  sources?: Src[];
  files?: string[];
  id?: string;
};
type Conv = { id: string; title: string; created_at?: string; updated_at?: string };
type CF = Conv & { messages: { role: string; content: string; created_at: string }[] };
type PF = { file: File; prog: number; done: boolean; err?: string };

const DRAWER_W = 260;
const API = import.meta.env.VITE_API_BASE || "";
const MAX_F = 10_485_760;
const EXTS = [".pdf", ".txt", ".md", ".csv", ".json"];

/* ------------------------------------------------------------------ */
/*  Theme — uses CSS variables from index.css for dark/light           */
/* ------------------------------------------------------------------ */
const darkTheme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#667eea" },
    background: { default: "var(--color-bg)", paper: "var(--color-surface)" },
    text: { primary: "var(--color-text-primary)", secondary: "var(--color-text-secondary)", disabled: "var(--color-text-disabled)" },
    divider: "var(--color-border)",
    error: { main: "#f87171" },
    success: { main: "#34d399" },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: ["Inter", "system-ui", "Segoe UI", "Roboto", "Arial"].join(","),
  },
  components: {
    MuiButton: { styleOverrides: { root: { textTransform: "none", fontWeight: 500, borderRadius: 8 } } },
    MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
    MuiSkeleton: { styleOverrides: { root: { bgcolor: "var(--color-skeleton-bg)" } } },
  },
});

const lightTheme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#667eea" },
    background: { default: "#f8f9fa", paper: "#ffffff" },
    text: { primary: "#1a1a2e", secondary: "#4a4a68", disabled: "#a0a0b8" },
    divider: "#e0e0e8",
    error: { main: "#dc2626" },
    success: { main: "#16a34a" },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: ["Inter", "system-ui", "Segoe UI", "Roboto", "Arial"].join(","),
  },
  components: {
    MuiButton: { styleOverrides: { root: { textTransform: "none", fontWeight: 500, borderRadius: 8 } } },
    MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
    MuiSkeleton: { styleOverrides: { root: { bgcolor: "rgba(0,0,0,.06)" } } },
  },
});

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function fI(n: string) {
  const e = "." + n.split(".").pop()!.toLowerCase();
  const m: Record<string, string> = { ".pdf": "PDF", ".txt": "TXT", ".md": "MD", ".csv": "CSV", ".json": "JSON" };
  return m[e] || "FILE";
}

/* ------------------------------------------------------------------ */
/*  AppCore (authenticated)                                            */
/* ------------------------------------------------------------------ */
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
  const [menuEl, setMenuEl] = useState<null | HTMLElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const hAuth = useCallback(() => getAuthHeader(), []);
  const tok = useMemo(() => getAuthHeader()["Authorization"] || "", []);

  // Detect mobile
  const isMobile = useMediaQuery("(max-width:600px)");

  // ── Load conversations ──────────────────────────────────────
  const loadConvs = useCallback(async () => {
    const r = await fetch(`${API}/v1/conversations`, { headers: { Authorization: tok } }).catch(() => undefined);
    if (r?.ok) setConvs(await r.json());
  }, [tok]);

  useEffect(() => {
    void loadConvs();
  }, [loadConvs]);

  // ── New chat ────────────────────────────────────────────────
  const newChat = useCallback(async () => {
    setConvId(null);
    setMsgs([]);
    setStreamT("");
    setStreamS([]);
    setBusy(false);
    setInput("");
    setFiles([]);
    setDrawer(false);
    const r = await fetch(`${API}/v1/conversations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: tok },
      body: "{}",
    }).catch(() => undefined);
    if (r?.ok) {
      const c: Conv = await r.json();
      setConvs((p) => [c, ...p]);
      setConvId(c.id);
    }
  }, [tok]);

  // ── Pick conversation ──────────────────────────────────────
  const pick = useCallback(async (id: string) => {
    setConvId(id);
    setMsgs([]);
    setStreamT("");
    setStreamS([]);
    setFiles([]);
    setDrawer(false);
    setBusy(false);
    const r = await fetch(`${API}/v1/conversations/${id}`, { headers: { Authorization: tok } }).catch(() => undefined);
    if (r?.ok) {
      const f: CF = await r.json();
      setMsgs(f.messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })));
    }
  }, [tok]);

  // ── Delete conversation ─────────────────────────────────────
  const nuke = useCallback(async (id: string) => {
    await fetch(`${API}/v1/conversations/${id}`, {
      method: "DELETE",
      headers: { Authorization: tok },
    }).catch(() => {});
    setConvs((p) => p.filter((c) => c.id !== id));
    if (convId === id) {
      setConvId(null);
      setMsgs([]);
    }
  }, [convId, tok]);

  // ── File helpers ────────────────────────────────────────────
  const addFiles = useCallback((fl: FileList | File[]) => {
    const n: PF[] = [];
    Array.from(fl).forEach((f) => {
      const e = "." + (f.name.split(".").pop() || "").toLowerCase();
      if (!EXTS.includes(e) || f.size > MAX_F) {
        n.push({ file: f, prog: 0, done: true, err: f.size > MAX_F ? "Too large (10 MB)" : "Unsupported" });
      } else {
        n.push({ file: f, prog: 0, done: false });
      }
    });
    setFiles((p) => [...p, ...n]);
  }, []);

  const rmF = useCallback((i: number) => setFiles((p) => { const n = [...p]; n.splice(i, 1); return n; }), []);

  const resolveConvId = useCallback(async (): Promise<string> => {
    if (convId) return convId;
    const r = await fetch(`${API}/v1/conversations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: tok },
      body: "{}",
    }).catch(() => undefined);
    if (r?.ok) {
      const c: Conv = await r.json();
      setConvs((p) => [c, ...p]);
      setConvId(c.id);
      return c.id;
    }
    return "";
  }, [convId, tok]);

  // ── Ingest pending files ───────────────────────────────────
  const ingest = useCallback(async (): Promise<string[]> => {
    const todo = files.filter((f) => !f.done);
    const ok: string[] = [];
    for (const p of todo) {
      try {
        const fd = new FormData();
        fd.append("file", p.file);
        const u = new URL(`${API}/v1/rag/ingest/file`);
        u.searchParams.set("source", p.file.name);
        const iv = setInterval(
          () => setFiles((x) => x.map((y) => (y === p ? { ...y, prog: Math.min(y.prog + 15, 90) } : y))),
          200
        );
        const r = await fetch(u.toString(), { method: "POST", body: fd });
        clearInterval(iv);
        if (!r.ok) throw new Error("");
        setFiles((x) => x.map((y) => (y === p ? { ...y, prog: 100, done: true } : y)));
        ok.push(p.file.name);
      } catch {
        setFiles((x) => x.map((y) => (y === p ? { ...y, done: true, err: "Failed" } : y)));
      }
    }
    return ok;
  }, [files]);

  // ── Send message (SSE streaming) ───────────────────────────
  const send = useCallback(async () => {
    const txt = input.trim();
    if (!txt && files.filter((f) => !f.err).length === 0) return;

    const fn = files.filter((f) => !f.err).map((f) => f.file.name);
    await ingest();

    const cid = await resolveConvId();

    if (txt) {
      setMsgs((p) => [...p, { role: "user" as const, content: txt, files: fn.length ? fn : undefined }]);
    } else if (fn.length) {
      setMsgs((p) => [
        ...p,
        { role: "user" as const, content: `Uploaded ${fn.length} file${fn.length > 1 ? "s" : ""}.`, files: fn },
      ]);
    }

    setInput("");
    setBusy(true);
    setStreamT("");
    setStreamS([]);
    setFiles([]);

    const c = new AbortController();
    setCtrl(c);

    let at = "";
    let as: Src[] = [];

    try {
      const body = txt || "Summarize the uploaded documents.";
      const r = await fetch(`${API}/v1/rag/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: tok },
        body: JSON.stringify({ message: body, conversation_id: cid || undefined, top_k: 6, stream: true }),
        signal: c.signal,
      });

      if (!r.ok) throw new Error(`HTTP ${r.status}`);

      const rd = r.body?.getReader();
      if (!rd) throw new Error("ReadableStream not supported by browser");

      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await rd.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });

        const ps = buf.split("\n\n");
        buf = ps.pop() ?? "";

        for (const pc of ps) {
          if (!pc.trim()) continue;
          const em = pc.match(/^event:\s*(.+)$/m);
          const dm = pc.match(/^data:\s*(.+)$/m);
          if (!em || !dm) continue;

          let j: Record<string, unknown>;
          try {
            j = JSON.parse(dm[1].trim());
          } catch {
            continue;
          }

          const type = em[1].trim();

          if (type === "sources") {
            as = (j as any).sources ?? [];
            setStreamS([...as]);
          }

          if (type === "token") {
            at += (j as any).content ?? "";
            setStreamT(at);
          }

          if (type === "error") {
            setMsgs((p) => [...p, { role: "assistant" as const, content: `Error: ${(j as any).message || "Unknown"}` }]);
            return;
          }

          if (type === "thinking") {
            // Show typing dots (handled by AssistantMessage when content is empty)
          }

          if (type === "citation") {
            const src = (j as any).source;
            if (!as.find((s) => s.idx === src.idx)) {
              as.push({ source: src.title || `src ${src.idx + 1}`, idx: src.idx });
              setStreamS([...as]);
            }
          }
        }
      }
    } catch (e: unknown) {
      const name = (e as DOMException)?.name;
      if (name !== "AbortError") {
        if (!at) {
          setMsgs((p) => [
            ...p,
            { role: "assistant" as const, content: `Error: ${(e as Error).message}` },
          ]);
        }
      } else {
        // Client disconnected — partial commit handled in stop()
      }
    } finally {
      if (at) {
        setMsgs((p) => [
          ...p,
          { role: "assistant" as const, content: at, sources: as.length ? [...as] : undefined },
        ]);
        void loadConvs();
      }
      setStreamT("");
      setStreamS([]);
      setBusy(false);
      setCtrl(null);
    }
  }, [input, files, ingest, resolveConvId, tok, loadConvs]);

  // ── Stop streaming ──────────────────────────────────────────
  const stop = useCallback(() => {
    actrl?.abort();
    if (streamT) {
      setMsgs((p) => [
        ...p,
        { role: "assistant" as const, content: streamT, sources: streamS.length ? [...streamS] : undefined },
      ]);
      void loadConvs();
    }
    setStreamT("");
    setStreamS([]);
    setBusy(false);
    setCtrl(null);
  }, [actrl, streamT, streamS, loadConvs]);

  // ── File upload standalone ──────────────────────────────────
  const ing1 = useCallback(async (f: File) => {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const u = new URL(`${API}/v1/rag/ingest/file`);
      u.searchParams.set("source", f.name);
      const r = await fetch(u.toString(), { method: "POST", body: fd });
      const d = await r.json();
      setMsgs((p) => [
        ...p,
        { role: "assistant" as const, content: `Ingested "${f.name}" (${d.chunks_added} chunks).` },
      ]);
    } catch {
      setMsgs((p) => [...p, { role: "assistant" as const, content: "Ingest failed." }]);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }, []);

  // ── Quick question from WelcomeScreen ───────────────────────
  const setQuick = useCallback((q: string) => setInput(q), []);

  // ── File input handler ─────────────────────────────────────
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const f = e.target.files[0];
      if (e.target.files.length === 1 && !files.length) {
        void ing1(f);
      } else {
        addFiles(e.target.files);
      }
    }
    e.target.value = "";
  }, [files.length, ing1, addFiles]);

  return (
    <Stack direction="row" sx={{ height: "100vh", overflow: "hidden", bgcolor: "var(--color-bg)" }}>
      {/* Hidden file inputs */}
      <input ref={fileRef} hidden type="file" accept=".pdf,.txt,.md,.csv,.json" onChange={handleFileUpload} />

      {/* ── Sidebar ──────────────────────────────────────── */}
      <Box
        sx={{
          width: DRAWER_W,
          flexShrink: 0,
          borderRight: "1px solid var(--color-border)",
          display: { xs: "none", sm: "flex" },
          flexDirection: "column",
          bgcolor: "var(--color-sidebar-bg)",
        }}
      >
        {convs.length ? (
          <Sidebar convs={convs} convId={convId} onNew={newChat} onSelect={pick} onDelete={nuke} />
        ) : (
          <SidebarSkeletons />
        )}
      </Box>

      {/* Mobile drawer */}
      <Drawer open={drawer} onClose={() => setDrawer(false)} PaperProps={{ sx: { width: DRAWER_W, bgcolor: "var(--color-sidebar-bg)" } }}>
        <Sidebar convs={convs} convId={convId} onNew={newChat} onSelect={pick} onDelete={nuke} />
      </Drawer>

      {/* ── Main area ────────────────────────────────────── */}
      <Stack flex={1} sx={{ overflow: "hidden" }}>
        {/* Header */}
        <AppBar position="sticky" elevation={0} sx={{ bgcolor: "var(--color-header-bg)", borderBottom: "1px solid var(--color-border)" }}>
          <Toolbar sx={{ py: 0, minHeight: "44px !important" }}>
            {/* Hamburger (mobile) */}
            <IconButton
              edge="start"
              sx={{ display: { sm: "none" }, mr: 0.5, p: 0.5 }}
              onClick={() => setDrawer(true)}
            >
              <MenuIcon sx={{ fontSize: 17 }} />
            </IconButton>

            {/* New chat */}
            <IconButton
              size="small"
              onClick={newChat}
              sx={{ display: { sm: "flex" }, mr: 0.5, p: 0.5, color: "text.secondary", "&:hover": { bgcolor: "rgba(128,128,128,.05)" } }}
            >
              <AddIcon sx={{ fontSize: 17 }} />
            </IconButton>

            {/* Title */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.3, px: 1, py: 0.3, borderRadius: 1.5, bgcolor: "var(--color-chip-bg)" }}>
              <SmartToyIcon sx={{ fontSize: 14, color: "var(--color-link)" }} />
              <Typography sx={{ fontWeight: 500, fontSize: "0.78rem", color: "text.primary" }}>RAG Assistant</Typography>
            </Box>

            <Typography sx={{ mx: 1.5, color: "text.disabled", fontSize: "0.65rem", display: { xs: "none", sm: "block" } }}>
              &middot;
            </Typography>
            <Typography sx={{ fontWeight: 400, fontSize: "0.78rem", color: "text.secondary", display: { xs: "none", sm: "block" } }}>
              {convId ? convs.find((c) => c.id === convId)?.title || "Chat" : "New Chat"}
            </Typography>

            <Box flex={1} />

            {/* Upload */}
            <Tooltip title="Upload">
              <IconButton
                size="small"
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                sx={{ color: "text.secondary", p: 0.5, "&:hover": { color: "text.primary" } }}
              >
                <UploadFileIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>

            {/* User avatar */}
            <Tooltip title="Account">
              <IconButton size="small" onClick={(e) => setMenuEl(e.currentTarget)} sx={{ ml: 0.5, p: 0.2 }}>
                <Avatar
                  sx={{
                    width: 24,
                    height: 24,
                    bgcolor: "var(--color-avatar-bg)",
                    fontSize: "0.55rem",
                    fontWeight: 700,
                    color: "var(--color-avatar-icon)",
                  }}
                >
                  {user.name?.charAt(0).toUpperCase() || user.email.charAt(0).toUpperCase()}
                </Avatar>
              </IconButton>
            </Tooltip>

            {/* User menu */}
            <Menu
              anchorEl={menuEl}
              open={!!menuEl}
              onClose={() => setMenuEl(null)}
              anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
              transformOrigin={{ horizontal: "right", vertical: "top" }}
              PaperProps={{ sx: { bgcolor: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 2, p: 0.5 } }}
            >
              <MenuItem disabled sx={{ py: 1, opacity: 1 }}>
                <Box sx={{ minWidth: 0, pr: 2 }}>
                  <Typography sx={{ fontWeight: 500, fontSize: "0.8rem", color: "text.primary" }}>
                    {user.name || "User"}
                  </Typography>
                  <Typography sx={{ fontSize: "0.68rem", color: "text.disabled" }}>{user.email}</Typography>
                </Box>
              </MenuItem>
              <Box sx={{ height: 1, bgcolor: "var(--color-border)", mx: 0, my: 0.5 }} />
              <MenuItem onClick={() => { setMenuEl(null); onLogout(); }} sx={{ color: "#f87171", fontSize: "0.8rem" }}>
                Sign out
              </MenuItem>
            </Menu>
          </Toolbar>
        </AppBar>

        {/* ── Message area ────────────────────────────────── */}
        <ScrollContainer>
          {msgs.length === 0 && !streamT ? (
            <WelcomeScreen onQuickQuestion={setQuick} />
          ) : (
            msgs.map((m, i) =>
              m.role === "user" ? (
                <UserMessage key={i} m={m} />
              ) : (
                <AssistantMessage
                  key={i}
                  content={m.content}
                  sources={m.sources}
                  messageId={m.id}
                />
              )
            )
          )}
          {/* Streaming assistant message */}
          {streamT && (
            <AssistantMessage content={streamT} sources={streamS} isStreaming />
          )}
          {/* Typing dots while waiting for first token */}
          {busy && !streamT && (
            <AssistantMessage content="" isStreaming />
          )}
        </ScrollContainer>

        {/* ── Input area ──────────────────────────────────── */}
        <InputArea
          value={input}
          onChange={setInput}
          onSend={send}
          onStop={stop}
          files={files}
          onAddFiles={addFiles}
          onRemoveFile={rmF}
          isStreaming={busy}
          disabled={false}
        />
      </Stack>
    </Stack>
  );
}

/* ------------------------------------------------------------------ */
/*  Root App                                                           */
/* ------------------------------------------------------------------ */
type AUser = { id: string; email: string; name?: string };

export default function App() {
  const [user, setUser] = useState<AUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const t = getTokens();
      if (!t) {
        setReady(true);
        return;
      }
      try {
        const r = await fetch(`${API}/v1/auth/me`, {
          headers: { Authorization: `Bearer ${t.access_token}` },
        });
        if (!r.ok) throw 0;
        const d = await r.json();
        setUser(d.user);
      } catch {
        clearTokens();
      } finally {
        setReady(true);
      }
    })();
  }, []);

  if (!ready) return <CssBaseline />;
  if (!user) return <AuthScreen onSuccess={(d) => setUser(d.user as AUser)} />;
  return <AppCore user={user} onLogout={() => { clearTokens(); setUser(null); }} />;
}
