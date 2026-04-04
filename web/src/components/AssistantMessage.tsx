import { Avatar, Box, Stack, Tooltip, Typography } from "@mui/material";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import { useState } from "react";
import { mdComponents } from "./MarkdownRenderer";
import MsgActions from "./MsgActions";

/* ------------------------------------------------------------------ */
/*  Citation list at bottom of message                                 */
/* ------------------------------------------------------------------ */
function CitationStrip({ sources }: { sources?: Array<{ source: string; idx: number }> }) {
  const [expanded, setExpanded] = useState<number | null>(null);

  if (!sources?.length) return null;

  return (
    <Stack direction="row" sx={{ mt: 2, flexWrap: "wrap", gap: 0.5 }}>
      {sources.map((s, i) => (
        <Tooltip
          key={i}
          title={s.source}
          placement="top"
          open={expanded === i}
          onClick={() => setExpanded(expanded === i ? null : i)}
        >
          <Box
            sx={{
              px: 1,
              py: 0.2,
              borderRadius: 0.5,
              fontSize: "0.62rem",
              fontWeight: 600,
              bgcolor: "var(--color-citation-bg)",
              color: "var(--color-link)",
              border: "1px solid var(--color-citation-border)",
              cursor: "pointer",
              animation: `chipIn .25s ease-out`,
              animationDelay: `${i * 0.05}s`,
              animationFillMode: "both",
              transition: "background-color 0.15s",
              "&:hover": {
                bgcolor: "var(--color-citation-hover-bg)",
              },
            }}
          >
            [{s.idx + 1}] {s.source}
          </Box>
        </Tooltip>
      ))}
    </Stack>
  );
}

/* ------------------------------------------------------------------ */
/*  Typing dots                                                        */
/* ------------------------------------------------------------------ */
function TypingDots() {
  return (
    <Box sx={{ display: "flex", justifyContent: "flex-start", mb: 5, animation: "fadeIn 0.3s" }}>
      <Stack direction="row" spacing={2}>
        <Avatar
          sx={{
            width: 28,
            height: 28,
            flexShrink: 0,
            bgcolor: "var(--color-avatar-bg)",
            border: "var(--color-avatar-border)",
            mt: 0.25,
          }}
        >
          <SmartToyIcon sx={{ fontSize: 14, color: "var(--color-avatar-icon)" }} />
        </Avatar>
        <Stack
          direction="row"
          spacing={1.5}
          sx={{
            px: 2,
            py: 1.2,
            borderRadius: "2px 16px 16px 16px",
            bgcolor: "var(--color-typing-bg)",
            border: "1px solid var(--color-typing-border)",
          }}
        >
          {[0, 1, 2].map((i) => (
            <Box
              key={i}
              sx={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                bgcolor: "var(--color-typing-dot)",
                animation: "typingDot 1.2s ease-in-out infinite",
                animationDelay: `${i * 0.2}s`,
                opacity: 0.4,
              }}
            />
          ))}
        </Stack>
      </Stack>
    </Box>
  );
}

/* ------------------------------------------------------------------ */
/*  Assistant message                                                  */
/* ------------------------------------------------------------------ */
interface AssistantMessageProps {
  content: string;
  sources?: Array<{ source: string; idx: number }>;
  messageId?: string;
  onRegenerate?: () => void;
  isStreaming?: boolean;
}

export default function AssistantMessage({ content, sources, messageId, onRegenerate, isStreaming }: AssistantMessageProps) {
  const showTyping = isStreaming && !content;

  if (showTyping) {
    return <TypingDots />;
  }

  return (
    <Box
      className="msg-row"
      sx={{ display: "flex", justifyContent: "flex-start", mb: 5, animation: "fadeInUp 0.25s ease-out" }}
    >
      <Stack direction="row" spacing={2} sx={{ maxWidth: "75%", minWidth: 0, width: "100%" }}>
        <Avatar
          sx={{
            width: 28,
            height: 28,
            flexShrink: 0,
            bgcolor: "var(--color-avatar-bg)",
            border: "var(--color-avatar-border)",
            mt: 0.25,
          }}
        >
          <SmartToyIcon sx={{ fontSize: 14, color: "var(--color-avatar-icon)" }} />
        </Avatar>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          {/* Markdown rendered */}
          <Box
            sx={{
              lineHeight: 1.75,
              fontSize: "0.9rem",
              color: "text.primary",
              "& h1, & h2, & h3, & h4, & h5, & h6": {
                color: "text.primary",
                fontWeight: 600,
                mt: 2,
                mb: 0.5,
              },
              "& h1": { fontSize: "1.25rem" },
              "& h2": { fontSize: "1.1rem" },
              "& h3": { fontSize: "1rem" },
              "& p": { my: 0.25 },
              "& ul, & ol": { mt: 0.5, mb: 0.5 },
              "& li": { my: 0.25 },
              "& hr": { borderColor: "var(--color-border)", my: 2 },
            }}
          >
            <ReactMarkdown components={mdComponents} rehypePlugins={[rehypeHighlight]}>
              {content}
            </ReactMarkdown>
            {/* Cursor blink during streaming */}
            {isStreaming && (
              <Box
                component="span"
                sx={{
                  display: "inline-block",
                  width: 2,
                  height: "1em",
                  bgcolor: "var(--color-link)",
                  ml: 0.5,
                  animation: "blink 0.8s infinite",
                  verticalAlign: "text-bottom",
                }}
              />
            )}
          </Box>

          {/* Citations */}
          <CitationStrip sources={sources} />

          {/* Actions */}
          {!isStreaming && (
            <MsgActions
              content={content}
              messageId={messageId}
              onRegenerate={onRegenerate}
            />
          )}
        </Box>
      </Stack>
    </Box>
  );
}
