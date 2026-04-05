import { useCallback, useRef, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import { Box, IconButton, Typography, Fade } from "@mui/material";
import {
  ContentCopy as ContentCopyIcon,
  ThumbUpOutlined,
  ThumbDownOutlined,
  AutorenewOutlined,
  Edit as EditIcon,
  Check as CheckIcon,
} from "@mui/icons-material";
import { mdComponents } from "./MarkdownRenderer";
import { apiSubmitFeedback } from "../services/api";

interface MessageBubbleProps {
  message: {
    id?: string;
    role: "user" | "assistant";
    content: string;
    sources?: Array<{ source: string; idx: number; number: number }>;
    files?: string[];
    streaming?: boolean;
  };
  isLastMessage?: boolean;
  isStreaming?: boolean;
  messageIndex: number;
  onRegenerate?: () => void;
  onEditMessage?: (index: number, newText: string) => void;
}

function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}

/* Typing dots */
function TypingDots() {
  return (
    <div className="flex items-start gap-3 mb-5 animate-[fadeIn_0.3s_ease-out]">
      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 bg-[var(--color-avatar-bg)] border border-[var(--color-avatar-border)]">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-4 h-4 text-[var(--color-avatar-icon)]"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1.27A7 7 0 0 1 14 22h-4a7 7 0 0 1-6.73-3H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2zM7.5 14a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm9 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z" />
        </svg>
      </div>
      <div className="flex items-center gap-1.5 px-4 py-3 rounded-bl-[16px] rounded-br-[16px] rounded-tr-[4px] rounded-tl-[16px] bg-[var(--color-typing-bg)] border border-[var(--color-typing-border)]">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-[var(--color-typing-dot)] animate-[typingDot_1.2s_ease-in-out_infinite] opacity-40"
            style={{ animationDelay: `${i * 0.2}s` }}
          />
        ))}
      </div>
    </div>
  );
}

/* Actions bar */
function ActionsBar({
  content,
  messageId,
  onRegenerate,
  isLast,
}: {
  content: string;
  messageId?: string;
  onRegenerate?: () => void;
  isLast?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<0 | 1 | null>(null);

  const handleCopy = useCallback(async () => {
    await copyToClipboard(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [content]);

  const handleFeedback = useCallback(
    async (score: 0 | 1) => {
      setFeedback(score);
      if (messageId) await apiSubmitFeedback(messageId, score);
    },
    [messageId]
  );

  return (
    <div
      className={`flex items-center gap-1 mt-2 transition-opacity duration-150 ${
        isLast ? "opacity-100" : "opacity-0"
      } group-hover/msg:opacity-100`}
    >
      <button
        onClick={handleCopy}
        className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-zinc-500 hover:text-zinc-300 transition-colors hover:bg-zinc-800"
      >
        {copied ? (
          <CheckIcon className="text-green-400" sx={{ fontSize: 13 }} />
        ) : (
          <ContentCopyIcon sx={{ fontSize: 13 }} />
        )}
        <span className="text-[0.6rem]">{copied ? "Copied!" : "Copy"}</span>
      </button>

      {onRegenerate && (
        <button
          onClick={onRegenerate}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-zinc-500 hover:text-zinc-300 transition-colors hover:bg-zinc-800"
        >
          <AutorenewOutlined sx={{ fontSize: 13 }} />
          <span className="text-[0.6rem]">Retry</span>
        </button>
      )}

      <div className="w-px h-3 bg-zinc-700/30 mx-1" />

      <button
        onClick={() => handleFeedback(1)}
        className={`p-1 rounded transition-colors ${
          feedback === 1
            ? "text-green-400"
            : "text-zinc-500 hover:text-green-400"
        }`}
      >
        <ThumbUpOutlined sx={{ fontSize: 14 }} />
      </button>
      <button
        onClick={() => handleFeedback(0)}
        className={`p-1 rounded transition-colors ${
          feedback === 0
            ? "text-red-400"
            : "text-zinc-500 hover:text-red-400"
        }`}
      >
        <ThumbDownOutlined sx={{ fontSize: 14 }} />
      </button>
    </div>
  );
}

/* Citations */
function Citations({
  sources,
}: {
  sources?: Array<{ source: string; idx: number; number: number }>;
}) {
  if (!sources?.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-3">
      {sources.map((s, i) => (
        <div
          key={i}
          className="px-2 py-0.5 rounded text-[0.62rem] font-semibold cursor-default bg-[var(--color-citation-bg)] text-[var(--color-link)] border border-[var(--color-citation-border)] hover:bg-[var(--color-citation-hover-bg)] transition-colors"
          title={s.source}
          style={{
            animation: "chipIn 0.25s ease-out both",
            animationDelay: `${i * 0.05}s`,
          }}
        >
          [{s.number}] {s.source}
        </div>
      ))}
    </div>
  );
}

/* Main component */
export function MessageBubble({
  message,
  isLastMessage,
  isStreaming,
  messageIndex,
  onRegenerate,
  onEditMessage,
}: MessageBubbleProps) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(message.content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus textarea when editing
  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [editing]);

  if (message.role === "user") {
    return (
      <div className="group/user relative flex justify-end mb-5 animate-[fadeInUp_0.2s_ease-out]">
        <div className="min-w-0">
          {message.files?.map((f, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg mr-1 mb-1.5 bg-[var(--color-chip-bg)] border border-[var(--color-chip-border)] text-[0.62rem] font-medium text-zinc-400"
            >
              {f}
            </span>
          ))}
          {editing ? (
            <div className="bg-[#18181b] border border-[var(--color-border)] rounded-[18px] p-3">
              <textarea
                ref={textareaRef}
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                autoFocus
                rows={2}
                className="w-full bg-transparent text-[0.9rem] text-zinc-100 outline-none resize-none placeholder-zinc-500 leading-relaxed"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (editText.trim()) {
                      onEditMessage?.(messageIndex, editText.trim());
                      setEditing(false);
                    }
                  }
                  if (e.key === "Escape") {
                    setEditing(false);
                    setEditText(message.content);
                  }
                }}
              />
              <div className="flex gap-2 justify-end mt-2">
                <button
                  onClick={() => {
                    setEditing(false);
                    setEditText(message.content);
                  }}
                  className="px-3 py-1 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (editText.trim()) {
                      onEditMessage?.(messageIndex, editText.trim());
                      setEditing(false);
                    }
                  }}
                  disabled={!editText.trim()}
                  className="px-3 py-1 rounded-lg text-xs bg-[#667eea] text-white font-medium disabled:opacity-30 hover:bg-[#5a6fd6] transition-colors"
                >
                  Resend
                </button>
              </div>
            </div>
          ) : (
            <div className="px-4 py-2.5 rounded-[18px] bg-gradient-to-br from-[#6366f1]/80 to-[#7c3aed]/80 text-white whitespace-pre-wrap leading-relaxed text-[0.9rem] shadow-[0_1px_4px_rgba(99,102,241,.15)]" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
              {message.content}
            </div>
          )}
          {!editing && (
            <div className="opacity-0 group-hover/user:opacity-100 transition-opacity duration-150">
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1 mt-2 ml-2 px-2 py-1 rounded-md text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <EditIcon sx={{ fontSize: 13 }} />
                Edit
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Assistant message
  if (isStreaming && !message.content && !message.streaming) {
    return <TypingDots />;
  }

  return (
    <div className="group/msg flex justify-start mb-8 animate-[slideUp_0.3s_ease-out]">
      <div className="flex gap-4 max-w-[80%] min-w-0 w-full">
        {/* Avatar */}
        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 bg-[var(--color-avatar-bg)] border border-[var(--color-avatar-border)]">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-4 h-4 text-[var(--color-avatar-icon)]"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1.27A7 7 0 0 1 14 22h-4a7 7 0 0 1-6.73-3H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2ZM7.5 14a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm9 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z" />
          </svg>
        </div>

        <div className="min-w-0 flex-1">
          {/* Message prose */}
          <div className="leading-relaxed text-[0.95rem] text-[var(--color-text-primary)] prose-sm max-w-prose">
            <div className="prose [&>h1]:text-[1.5rem] [&>h2]:text-[1.25rem] [&>h3]:text-[1.1rem] [&>h4]:text-[1rem] [&>h5]:text-[0.95rem] [&>h6]:text-[0.9rem] [&>h1,h2,h3,h4,h5,h6]:font-semibold [&>h1,h2,h3,h4,h5,h6]:mt-6 [&>h1,h2,h3,h4,h5,h6]:mb-2 [&>p]:my-2 [&>ul,>ol]:my-2 [&>li]:my-0.5 [&>hr]:border-[var(--color-border)] [&>hr]:my-4 [&>pre]:bg-[var(--color-code-bg)] [&>pre]:border [&>pre]:border-[var(--color-code-border)] [&>pre]:rounded-xl [&>pre]:overflow-hidden [&>pre]:mt-2 [&>pre]:mb-2 [&>code]:bg-[var(--color-inline-code-bg)] [&>code]:text-[var(--color-inline-code-text)] [&>code]:px-1.5 [&>code]:py-0.5 [&>code]:rounded-md [&>code]:text-[0.84rem] [&>code]:font-mono [&>a]:text-[var(--color-link)] [&>a]:no-underline hover:[&>a]:underline [&>table]:border-collapse [&>table]:my-2 [&>table]:border [&>table]:border-[var(--color-border)] [&>table]:rounded-lg [&>th]:border [&>th]:border-[var(--color-border)] [&>th]:px-3 [&>th]:py-2 [&>th]:font-medium [&>td]:border [&>td]:border-[var(--color-border)] [&>td]:px-3 [&>td]:py-2 [&>blockquote]:border-l-2 [&>blockquote]:border-[var(--color-link)] [&>blockquote]:pl-4 [&>blockquote]:my-2 [&>blockquote]:text-zinc-400">
              <ReactMarkdown
                components={mdComponents}
                rehypePlugins={[rehypeHighlight]}
              >
                {message.content}
              </ReactMarkdown>
              {isStreaming && (
                <span className="inline-block w-[2px] h-[1.5em] bg-[var(--color-link)] ml-2 align-text-bottom animate-[blink_1s_infinite]" />
              )}
            </div>
          </div>

          <Citations sources={message.sources} />
          {!isStreaming && (
            <ActionsBar
              content={message.content}
              messageId={message.id}
              onRegenerate={isLastMessage ? onRegenerate : undefined}
              isLast={isLastMessage}
            />
          )}
        </div>
      </div>
    </div>
  );
}
