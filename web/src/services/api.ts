export const API = import.meta.env.VITE_API_BASE || "";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = sessionStorage.getItem("auth_access_token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...options.headers as Record<string, string>,
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
    throw new Error(err.detail || err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Auth ──────────────────────────────────────────────────────
export interface UserInfo { id: string; email: string; name: string; avatar_url: string | null }
export interface AuthResponse { access_token: string; token_type: string; user: UserInfo }

export async function apiLogin(email: string, password: string): Promise<AuthResponse> {
  return request("/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function apiRegister(email: string, password: string, name: string): Promise<AuthResponse> {
  return request("/v1/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, name }),
  });
}

export async function apiMe(): Promise<{ user: UserInfo }> {
  return request("/v1/auth/me");
}

export async function apiLogout(): Promise<void> {
  await fetch(`${API}/v1/auth/logout`, {
    method: "POST",
    headers: { Authorization: `Bearer ${sessionStorage.getItem("auth_access_token") || ""}` },
    credentials: "include",
  }).catch(() => {});
}

// ── Conversations ─────────────────────────────────────────────
export interface Conv {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ConvWithMessages extends Conv {
  messages: { id: string; role: string; content: string; created_at: string }[];
}

export async function apiListConversations(): Promise<Conv[]> {
  return request("/v1/conversations");
}

export async function apiCreateConversation(title?: string): Promise<Conv> {
  return request("/v1/conversations", {
    method: "POST",
    body: JSON.stringify({ title: title || undefined }),
  });
}

export async function apiGetConversation(id: string): Promise<ConvWithMessages> {
  return request(`/v1/conversations/${id}`);
}

export async function apiUpdateConversationTitle(id: string, title: string): Promise<Conv> {
  return request(`/v1/conversations/${id}/title`, {
    method: "PUT",
    body: JSON.stringify({ title }),
  });
}

export async function apiDeleteConversation(id: string): Promise<void> {
  await fetch(`${API}/v1/conversations/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${sessionStorage.getItem("auth_access_token") || ""}` },
  });
}

// ── RAG ───────────────────────────────────────────────────────
export interface ChatRequest {
  message: string;
  conversation_id?: string;
  top_k?: number;
  stream?: boolean;
}

export interface SourceEntry {
  chunk_id: string;
  document_id: string;
  source: string;
  doc_name: string;
  page: number | null;
  idx: number;
  number: number;
}

export interface ChatResponse {
  conversation_id: string;
  message_id: string;
  answer: string;
  sources: SourceEntry[];
}

export async function apiIngestFile(file: File, source: string): Promise<{ document_id: string; chunks_added: number }> {
  const fd = new FormData();
  fd.append("file", file);
  const u = new URL(`${API}/v1/rag/ingest/file`);
  u.searchParams.set("source", source);
  const token = sessionStorage.getItem("auth_access_token");
  const res = await fetch(u.toString(), {
    method: "POST",
    body: fd,
    headers: { Authorization: token ? `Bearer ${token}` : "" },
  });
  if (!res.ok) throw new Error("Upload failed");
  return res.json();
}

export async function apiSubmitFeedback(messageId: string, score: 0 | 1): Promise<void> {
  await fetch(`${API}/v1/feedback/submit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sessionStorage.getItem("auth_access_token") || ""}`,
    },
    body: JSON.stringify({ message_id: messageId, score }),
  }).catch(() => {});
}

// ── Streaming ─────────────────────────────────────────────────
export interface StreamingCallbacks {
  onSources?: (sources: SourceEntry[]) => void;
  onToken?: (token: string, fullContent: string) => void;
  onDone?: (usage: { input: number; output: number; total: number; cost_cents: number; run_id: string }) => void;
  onError?: (message: string) => void;
  onConversationId?: (conversationId: string) => void;
  onCitation?: (source: { title: string; page: number | null; number: number }) => void;
}

export function streamChat(req: ChatRequest, callbacks: StreamingCallbacks): AbortController {
  const controller = new AbortController();
  const token = sessionStorage.getItem("auth_access_token");

  (async () => {
    try {
      const res = await fetch(`${API}/v1/rag/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: token ? `Bearer ${token}` : "" },
        body: JSON.stringify({ ...req, stream: true }),
        signal: controller.signal,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader = res.body?.getReader();
      if (!reader) throw new Error("ReadableStream not supported");

      const dec = new TextDecoder();
      let buf = "";
      let fullContent = "";

      while (true) {
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

          let data: Record<string, unknown>;
          try { data = JSON.parse(dm[1].trim()); } catch { continue; }

          const type = em[1].trim();

          switch (type) {
            case "sources":
              callbacks.onSources?.(data.sources as SourceEntry[]);
              break;
            case "conversation_id":
              callbacks.onConversationId?.(data.conversation_id as string);
              break;
            case "token":
              fullContent += data.content as string;
              callbacks.onToken?.(data.content as string, fullContent);
              break;
            case "citation":
              callbacks.onCitation?.(data.source as { title: string; page: number | null; number: number });
              break;
            case "done":
              callbacks.onDone?.(data as { input: number; output: number; total: number; cost_cents: number; run_id: string });
              return;
            case "error":
              callbacks.onError?.(data.message as string);
              return;
          }
        }
      }
    } catch (e) {
      if ((e as DOMException)?.name !== "AbortError") {
        callbacks.onError?.((e as Error).message);
      }
    }
  })();

  return controller;
}
