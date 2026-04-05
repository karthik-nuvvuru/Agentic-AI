import { useCallback, useRef, useState } from "react";
import {
  apiListConversations,
  apiCreateConversation,
  apiGetConversation,
  apiUpdateConversationTitle,
  apiDeleteConversation,
  streamChat,
  streamChat as streamChatHelper,
  apiIngestFile,
  type Conv,
  type ConvWithMessages,
  type ChatRequest,
  type SourceEntry,
  type StreamingCallbacks,
} from "../services/api";

export interface Message {
  id?: string;
  role: "user" | "assistant";
  content: string;
  sources?: SourceEntry[];
  files?: string[];
  streaming?: boolean;
}

export interface PendingFile {
  file: File;
  name: string;
  size: number;
  progress: number;
  done: boolean;
  error?: string;
}

export function useChat() {
  const [conversations, setConversations] = useState<Conv[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingContent, setStreamingContent] = useState("");
  const [streamingSources, setStreamingSources] = useState<SourceEntry[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const streamControllerRef = useRef<AbortController | null>(null);

  const token = useRef(sessionStorage.getItem("auth_access_token") || "");
  const authHeaders = useCallback(
    () => (token.current ? { Authorization: `Bearer ${token.current}` } : {}),
    []
  );

  // ── Load conversations ──────────────────────────────────────
  const loadConversations = useCallback(async () => {
    try {
      const list = await apiListConversations();
      setConversations(list);
    } catch {
      /* silent */
    }
  }, []);

  // ── New chat ────────────────────────────────────────────────
  const createChat = useCallback(async (): Promise<string | null> => {
    try {
      const conv = await apiCreateConversation();
      setConversations((prev) => [conv, ...prev]);
      setActiveConvId(conv.id);
      setMessages([]);
      setStreamingContent("");
      setStreamingSources([]);
      return conv.id;
    } catch {
      return null;
    }
  }, []);

  // ── Open chat ───────────────────────────────────────────────
  const openChat = useCallback(async (id: string) => {
    setActiveConvId(id);
    setMessages([]);
    setStreamingContent("");
    setStreamingSources([]);
    try {
      const data = await apiGetConversation(id);
      setMessages(
        data.messages.map((m) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          content: m.content,
        }))
      );
    } catch {
      setMessages([]);
    }
  }, []);

  // ── Rename chat ─────────────────────────────────────────────
  const renameChat = useCallback(async (id: string, title: string) => {
    try {
      const updated = await apiUpdateConversationTitle(id, title);
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title: updated.title } : c))
      );
    } catch {
      /* silent */
    }
  }, []);

  // ── Delete chat ─────────────────────────────────────────────
  const deleteChat = useCallback(async (id: string) => {
    try {
      await apiDeleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConvId === id) {
        setActiveConvId(null);
        setMessages([]);
      }
    } catch {
      /* silent */
    }
  }, [activeConvId]);

  // ── Resolve conversation ID ─────────────────────────────────
  const resolveConvId = useCallback(async (): Promise<string> => {
    if (activeConvId) return activeConvId;
    const conv = await apiCreateConversation();
    setConversations((prev) => [conv, ...prev]);
    setActiveConvId(conv.id);
    return conv.id;
  }, [activeConvId]);

  // ── File upload ─────────────────────────────────────────────
  const addFiles = useCallback((list: FileList | File[]) => {
    const MAX_SIZE = 10_485_760;
    const VALID_EXTS = [".pdf", ".txt", ".md", ".csv", ".json"];
    const files: PendingFile[] = [];
    Array.from(list).forEach((f) => {
      const ext = "." + (f.name.split(".").pop() || "").toLowerCase();
      if (!VALID_EXTS.includes(ext)) {
        files.push({ file: f, name: f.name, size: f.size, progress: 100, done: true, error: "Unsupported file type" });
      } else if (f.size > MAX_SIZE) {
        files.push({ file: f, name: f.name, size: f.size, progress: 100, done: true, error: "File too large (10 MB max)" });
      } else {
        files.push({ file: f, name: f.name, size: f.size, progress: 0, done: false });
      }
    });
    setPendingFiles((prev) => [...prev, ...files]);
  }, []);

  const removeFile = useCallback((index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const ingestFiles = useCallback(async (): Promise<string[]> => {
    const todo = pendingFiles.filter((f) => !f.done);
    const uploaded: string[] = [];

    for (const pf of todo) {
      const updateProgress = (p: number) => {
        setPendingFiles((prev) =>
          prev.map((f) => (f.name === pf.name && !f.done ? { ...f, progress: p } : f))
        );
      };

      try {
        const interval = setInterval(() => {
          setPendingFiles((prev) => {
            const match = prev.find((f) => f.name === pf.name && !f.done);
            if (!match) return prev;
            const newP = Math.min(match.progress + 15, 90);
            return prev.map((f) => (f.name === pf.name && !f.done ? { ...f, progress: newP } : f));
          });
        }, 200);

        await apiIngestFile(pf.file, pf.name);
        clearInterval(interval);
        updateProgress(100);
        setPendingFiles((prev) =>
          prev.map((f) => (f.name === pf.name && !f.done ? { ...f, progress: 100, done: true } : f))
        );
        uploaded.push(pf.name);
      } catch {
        setPendingFiles((prev) =>
          prev.map((f) => (f.name === pf.name && !f.done ? { ...f, done: true, error: "Upload failed" } : f))
        );
      }
    }

    return uploaded;
  }, [pendingFiles]);

  // ── Send message ────────────────────────────────────────────
  const sendMessage = useCallback(
    async (
      text: string,
      callbacks: Omit<StreamingCallbacks, "onDone" | "onError"> & {
        onComplete?: (fullContent: string, sources: SourceEntry[]) => void;
        onFailure?: (error: string) => void;
      } = {}
    ) => {
      const convId = await resolveConvId();

      setMessages((prev) => [
        ...prev,
        { role: "user" as const, content: text },
      ]);

      const req: ChatRequest = { message: text, conversation_id: convId, top_k: 6, stream: true };

      setIsStreaming(true);
      setStreamingContent("");
      setStreamingSources([]);

      const controller = streamChatHelper(req, {
        onSources: callbacks.onSources ?? ((sources) => setStreamingSources(sources)),
        onToken: callbacks.onToken ?? ((_, full) => setStreamingContent(full)),
        onConversationId: callbacks.onConversationId,
        onCitation: callbacks.onCitation,
        onDone: () => {
          setIsStreaming(false);
          const content = streamingContent;
          const sources = streamingSources;
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: content, sources: sources.length ? sources : undefined },
          ]);
          callbacks.onComplete?.(content, sources);
        },
        onError: (message) => {
          setIsStreaming(false);
          if (streamingContent) {
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: streamingContent, sources: streamingSources.length ? streamingSources : undefined },
            ]);
          } else {
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: `Error: ${message}` },
            ]);
          }
          callbacks.onFailure?.(message);
        },
      });

      streamControllerRef.current = controller;
    },
    [resolveConvId, streamingContent, streamingSources]
  );

  // ── Regenerate ──────────────────────────────────────────────
  const regenerate = useCallback(async () => {
    if (messages.length < 2 || isStreaming) return;
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUserMsg) return;

    // Remove the last assistant message
    setMessages((prev) => {
      const newMsgs = [...prev];
      for (let i = newMsgs.length - 1; i >= 0; i--) {
        if (newMsgs[i].role === "assistant") {
          newMsgs.splice(i, 1);
          break;
        }
      }
      return newMsgs;
    });

    setIsStreaming(true);
    setStreamingContent("");
    setStreamingSources([]);

    let convId = activeConvId;
    if (!convId) {
      const c = await apiCreateConversation();
      setConversations((prev) => [c, ...prev]);
      setActiveConvId(c.id);
      convId = c.id;
    }

    const controller = streamChat({ message: lastUserMsg.content, conversation_id: convId, top_k: 6, stream: true }, {
      onToken: (_, full) => setStreamingContent(full),
      onSources: (sources) => setStreamingSources(sources),
      onDone: () => {
        setIsStreaming(false);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: streamingContent, sources: streamingSources.length ? streamingSources : undefined },
        ]);
        void loadConversations();
      },
      onError: (message) => {
        setIsStreaming(false);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: streamingContent || `Error: ${message}` },
        ]);
      },
    });

    streamControllerRef.current = controller;
  }, [messages, isStreaming, activeConvId, streamingContent, streamingSources, loadConversations]);

  // ── Edit & resend message ───────────────────────────────────
  const editAndResend = useCallback(async (msgIndex: number, newText: string) => {
    if (isStreaming) return;

    // Trim messages after the edit point
    setMessages((prev) => prev.slice(0, msgIndex).concat({ role: "user", content: newText }));

    const lastMsg = [
      ...messages.slice(0, msgIndex),
      { role: "user" as const, content: newText },
    ].filter((m) => m.role === "user").pop();

    if (!lastMsg || !lastMsg.content) return;

    setIsStreaming(true);
    setStreamingContent("");
    setStreamingSources([]);

    let convId = activeConvId;
    if (!convId) {
      const c = await apiCreateConversation();
      setConversations((prev) => [c, ...prev]);
      setActiveConvId(c.id);
      convId = c.id;
    }

    const controller = streamChat({ message: lastMsg.content, conversation_id: convId, top_k: 6, stream: true }, {
      onToken: (_, full) => setStreamingContent(full),
      onSources: (sources) => setStreamingSources(sources),
      onDone: () => {
        setIsStreaming(false);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: streamingContent, sources: streamingSources.length ? streamingSources : undefined },
        ]);
        void loadConversations();
      },
      onError: (message) => {
        setIsStreaming(false);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: streamingContent || `Error: ${message}` },
        ]);
      },
    });

    streamControllerRef.current = controller;
  }, [isStreaming, messages, activeConvId, streamingContent, streamingSources, loadConversations]);

  // ── Stop ────────────────────────────────────────────────────
  const stop = useCallback(() => {
    streamControllerRef.current?.abort();
    if (streamingContent) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: streamingContent, sources: streamingSources.length ? streamingSources : undefined },
      ]);
      void loadConversations();
    }
    setStreamingContent("");
    setStreamingSources([]);
    setIsStreaming(false);
    streamControllerRef.current = null;
  }, [streamingContent, streamingSources, loadConversations]);

  return {
    conversations,
    activeConvId,
    messages,
    isStreaming,
    pendingFiles,
    loadConversations,
    createChat,
    openChat,
    renameChat,
    deleteChat,
    sendMessage,
    regenerate,
    editAndResend,
    stop,
    streamingContent,
    streamingSources,
    addFiles,
    removeFile,
    ingestFiles,
    setActiveConvId,
    setPendingFiles,
  };
}
