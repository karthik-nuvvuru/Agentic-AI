import { useCallback, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
type Role = "user" | "assistant";
type Msg = {
  role: Role;
  content: string;
  sources?: Array<{ source: string; idx: number }>;
  files?: string[];
  id?: string;
  runId?: string;
};
type Conv = { id: string; title: string; updated_at?: string };
type Usage = { input: number; output: number; total: number; cost_cents: number };

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
const API = import.meta.env.VITE_API_BASE || "";

function authHeaders(token: string) {
  return { "Content-Type": "application/json", Authorization: token };
}

/* ------------------------------------------------------------------ */
/*  useStreamingChat                                                   */
/* ------------------------------------------------------------------ */
export function useStreamingChat({
  tok,
  onConvsChange,
}: {
  tok: string;
  onConvsChange?: (c: Conv[]) => void;
}) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [streamT, setStreamT] = useState("");
  const [streamS, setStreamS] = useState<NonNullable<Msg["sources"]>>([]);
  const [streamUsage, setStreamUsage] = useState<Usage | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const ctrlRef = useRef<AbortController | null>(null);

  /* ── send ─────────────────────────────────────────────── */
  const send = useCallback(
    async (
      input: string,
      cid: string | null,
      { files }: { files?: File[] } = {}
    ) => {
      const fn = files?.map((f) => f.name);

      // Optimistically add user message
      const userContent =
        input || (fn?.length ? `Uploaded ${fn.length} file${fn.length > 1 ? "s" : ""}.` : "");
      if (userContent) {
        setMsgs((p) => [...p, { role: "user" as const, content: userContent, files: fn }]);
      }

      setStreamT("");
      setStreamS([]);
      setStreamUsage(null);
      setIsStreaming(true);

      const ctrl = new AbortController();
      ctrlRef.current = ctrl;

      // Ingest files first
      if (files?.length) {
        for (const f of files) {
          if (ctrl.signal.aborted) break;
          const fd = new FormData();
          fd.append("file", f);
          const u = new URL(`${API}/v1/rag/ingest/file`);
          u.searchParams.set("source", f.name);
          try {
            await fetch(u.toString(), { method: "POST", body: fd, signal: ctrl.signal });
          } catch {
            /* swallow ingestion errors */
          }
        }
      }

      // Resolve conversation id
      let convId = cid;
      if (!convId) {
        try {
          const r = await fetch(`${API}/v1/conversations`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: tok },
            body: "{}",
            signal: ctrl.signal,
          });
          if (r.ok) {
            const c: Conv = await r.json();
            convId = c.id;
            onConvsChange?.([]); // trigger sidebar refresh
          }
        } catch {
          /* create conversation failed */
        }
      }

      // SSE stream
      let assistantContent = "";
      let assistantSources: NonNullable<Msg["sources"]> = [];
      try {
        const body = userContent || "Please analyze the uploaded documents.";
        const r = await fetch(`${API}/v1/rag/chat/stream`, {
          method: "POST",
          headers: authHeaders(tok),
          body: JSON.stringify({ message: body, conversation_id: convId || undefined, top_k: 6, stream: true }),
          signal: ctrl.signal,
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);

        const reader = r.body?.getReader();
        if (!reader) throw new Error("ReadableStream not supported");

        const dec = new TextDecoder();
        let buf = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });

          const parts = buf.split("\n\n");
          buf = parts.pop() ?? "";

          for (const part of parts) {
            if (!part.trim()) continue;
            const em = part.match(/^event:\s*(.+)$/m);
            const dm = part.match(/^data:\s*(.+)$/m);
            if (!em || !dm) continue;

            let j: Record<string, unknown>;
            try {
              j = JSON.parse(dm[1].trim());
            } catch {
              continue;
            }

            const type = em[1].trim();

            if (type === "sources") {
              assistantSources = (j as any).sources ?? [];
              setStreamS([...assistantSources]);
            }
            if (type === "thinking") {
              // thinking indicator — frontend can show "Searching…"
            }
            if (type === "citation") {
              const src = (j as any).source;
              if (src && !assistantSources.find((s) => s.idx === src.idx)) {
                assistantSources.push({ source: src.title || `src ${src.idx + 1}`, idx: src.idx });
                setStreamS([...assistantSources]);
              }
            }
            if (type === "token") {
              assistantContent += (j as any).content ?? "";
              setStreamT(assistantContent);
            }
            if (type === "done") {
              setStreamUsage((j as any).usage ?? null);
            }
            if (type === "error") {
              setMsgs((p) => [
                ...p,
                { role: "assistant" as const, content: `Error: ${(j as any).message || "Unknown"}` },
              ]);
            }
          }
        }
      } catch (e: unknown) {
        const name = (e as DOMException)?.name;
        if (name !== "AbortError") {
          if (assistantContent) {
            // Already got partial content — just commit it
          } else {
            setMsgs((p) => [
              ...p,
              { role: "assistant" as const, content: "Connection lost. Please try again." },
            ]);
          }
        }
      } finally {
        if (assistantContent) {
          setMsgs((p) => [
            ...p,
            { role: "assistant" as const, content: assistantContent, sources: [...assistantSources] },
          ]);
        }
        setStreamT("");
        setStreamS([]);
        setIsStreaming(false);
        ctrlRef.current = null;
      }
    },
    [tok, onConvsChange]
  );

  /* ── stop ─────────────────────────────────────────────── */
  const stop = useCallback(() => {
    ctrlRef.current?.abort();
    // Commit partial content
    setMsgs((p) => {
      if (!streamT) return p;
      return [
        ...p,
        {
          role: "assistant" as const,
          content: streamT,
          ...(streamS.length ? { sources: [...streamS] } : {}),
        },
      ];
    });
    setStreamT("");
    setStreamS([]);
    setIsStreaming(false);
    ctrlRef.current = null;
  }, [streamT, streamS]);

  /* ── regenerate ───────────────────────────────────────── */
  const regenerate = useCallback(
    async (lastUserIdx: number | undefined) => {
      if (lastUserIdx === undefined) return;
      const userMsg = msgs[lastUserIdx];
      if (!userMsg) return;

      // Remove everything from lastUserIdx onward, then resend
      setMsgs((p) => p.slice(0, lastUserIdx));
      // Extract conversation id from context (best effort)
      const cid = ""; // will create new conv
      await send(userMsg.content, cid, { files: userMsg.files?.map((name) => new File([""], name)) ?? [] });
    },
    [msgs, send]
  );

  return {
    msgs,
    setMsgs,
    streamT,
    streamS,
    streamUsage,
    isStreaming,
    send,
    stop,
    regenerate,
  };
}
