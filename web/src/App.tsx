import SendIcon from "@mui/icons-material/Send";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import {
  AppBar,
  Box,
  Button,
  Container,
  CssBaseline,
  Divider,
  IconButton,
  Paper,
  Stack,
  TextField,
  Toolbar,
  Typography,
} from "@mui/material";
import { useMemo, useRef, useState } from "react";
import "./App.css";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type RagChatResponse = {
  answer: string;
  sources: Array<{
    chunk_id: string;
    document_id: string;
    source: string;
    idx: number;
  }>;
};

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://127.0.0.1:8000";

function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hi! Upload a document (PDF/TXT/MD) and ask questions — I’ll answer using RAG with citations.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [topK, setTopK] = useState(6);
  const [sources, setSources] = useState<RagChatResponse["sources"]>([]);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const canSend = useMemo(() => input.trim().length > 0 && !busy, [input, busy]);

  async function sendMessage() {
    const text = input.trim();
    if (!text) return;

    setSources([]);
    setMessages((m) => [...m, { role: "user", content: text }]);
    setInput("");
    setBusy(true);

    try {
      const res = await fetch(`${API_BASE}/v1/rag/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, top_k: topK }),
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || `Request failed (${res.status})`);
      }

      const data = (await res.json()) as RagChatResponse;
      setMessages((m) => [...m, { role: "assistant", content: data.answer }]);
      setSources(data.sources);
    } catch (e) {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: `Error: ${e instanceof Error ? e.message : String(e)}`,
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  async function ingestFile(file: File) {
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const url = new URL(`${API_BASE}/v1/rag/ingest/file`);
      url.searchParams.set("source", file.name);

      const res = await fetch(url.toString(), { method: "POST", body: form });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || `Ingest failed (${res.status})`);
      }

      const data = await res.json();
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: `Ingested "${file.name}" (${data.chunks_added} chunks). Ask me something about it.`,
        },
      ]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: `Ingest error: ${e instanceof Error ? e.message : String(e)}`,
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <CssBaseline />
      <AppBar
        position="sticky"
        elevation={0}
        sx={{ borderBottom: "1px solid", borderColor: "divider" }}
      >
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Agentic-AI • RAG Chat
          </Typography>
          <Stack direction="row" spacing={2} alignItems="center">
            <TextField
              size="small"
              label="Top K"
              type="number"
              value={topK}
              onChange={(e) =>
                setTopK(Math.max(1, Math.min(50, Number(e.target.value))))
              }
              sx={{ width: 110 }}
            />
            <input
              ref={fileRef}
              hidden
              type="file"
              accept=".pdf,.txt,.md"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void ingestFile(f);
                if (fileRef.current) fileRef.current.value = "";
              }}
            />
            <Button
              variant="outlined"
              startIcon={<UploadFileIcon />}
              onClick={() => fileRef.current?.click()}
              disabled={busy}
            >
              Upload
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>

      <Container maxWidth="md" sx={{ py: 3 }}>
        <Paper variant="outlined" sx={{ p: 2, minHeight: "60vh" }}>
          <Stack spacing={2}>
            {messages.map((m, idx) => (
              <Box
                key={idx}
                sx={{
                  display: "flex",
                  justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                }}
              >
                <Box
                  sx={{
                    maxWidth: "85%",
                    px: 2,
                    py: 1.5,
                    borderRadius: 2,
                    bgcolor: m.role === "user" ? "primary.main" : "grey.900",
                    color: "white",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  <Typography variant="body1">{m.content}</Typography>
                </Box>
              </Box>
            ))}
          </Stack>
        </Paper>

        <Box sx={{ mt: 2 }}>
          <Paper variant="outlined" sx={{ p: 1.5 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <TextField
                fullWidth
                placeholder="Ask a question about your ingested documents…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (canSend) void sendMessage();
                  }
                }}
                multiline
                maxRows={4}
              />
              <IconButton
                color="primary"
                disabled={!canSend}
                onClick={() => void sendMessage()}
              >
                <SendIcon />
              </IconButton>
            </Stack>
          </Paper>
        </Box>

        {sources.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              Sources
            </Typography>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Stack spacing={1}>
                {sources.map((s) => (
                  <Box key={s.chunk_id}>
                    <Typography variant="body2">
                      <strong>{s.source || "document"}</strong> — chunk {s.idx}
                    </Typography>
                    <Divider sx={{ mt: 1 }} />
                  </Box>
                ))}
              </Stack>
            </Paper>
          </Box>
        )}
      </Container>
    </>
  );
}

export default App;
