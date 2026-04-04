import { Box, IconButton, Typography } from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ThumbUpOutlined from "@mui/icons-material/ThumbUpOutlined";
import ThumbDownOutlined from "@mui/icons-material/ThumbDownOutlined";
import AutorenewOutlined from "@mui/icons-material/AutorenewOutlined";
import { useState } from "react";

const API = import.meta.env.VITE_API_BASE || "";
const tok = localStorage.getItem("auth_access_token")
  ? `Bearer ${localStorage.getItem("auth_access_token")}`
  : "";

/* ------------------------------------------------------------------ */
/*  Copy + feedback + regenerate bar shown on hover                   */
/* ------------------------------------------------------------------ */
interface MsgActionsProps {
  content: string;
  messageId?: string;
  onRegenerate?: () => void;
  onFeedback?: (score: 0 | 1) => void;
}

export default function MsgActions({ content, messageId, onRegenerate, onFeedback }: MsgActionsProps) {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<0 | 1 | null>(null);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFeedback = async (score: 0 | 1) => {
    setFeedback(score);
    if (messageId && tok) {
      try {
        await fetch(`${API}/v1/feedback/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: tok },
          body: JSON.stringify({ message_id: messageId, score }),
        });
      } catch {
        /* silent */
      }
    }
    onFeedback?.(score);
  };

  return (
    <Box
      sx={{
        display: "flex",
        gap: 0.5,
        mt: 1,
        opacity: { xs: 1, sm: 0 },
        transition: "opacity 0.15s",
        ".msg-row:hover &": { opacity: 1 },
      }}
    >
      <IconButton size="small" onClick={handleCopy} sx={{ p: 0.4, color: "text.disabled", "&:hover": { color: "text.primary" } }}>
        <ContentCopyIcon sx={{ fontSize: 14 }} />
        <Typography sx={{ fontSize: "0.6rem", ml: 0.3 }}>{copied ? "Copied" : "Copy"}</Typography>
      </IconButton>

      {onRegenerate && (
        <IconButton size="small" onClick={onRegenerate} sx={{ p: 0.4, color: "text.disabled", "&:hover": { color: "text.primary" } }}>
          <AutorenewOutlined sx={{ fontSize: 14 }} />
          <Typography sx={{ fontSize: "0.6rem", ml: 0.3 }}>Retry</Typography>
        </IconButton>
      )}

      <IconButton
        size="small"
        onClick={() => handleFeedback(1)}
        sx={{ p: 0.4, color: feedback === 1 ? "success.main" : "text.disabled", "&:hover": { color: "success.main" } }}
      >
        <ThumbUpOutlined sx={{ fontSize: 14 }} />
      </IconButton>

      <IconButton
        size="small"
        onClick={() => handleFeedback(0)}
        sx={{ p: 0.4, color: feedback === 0 ? "error.main" : "text.disabled", "&:hover": { color: "error.main" } }}
      >
        <ThumbDownOutlined sx={{ fontSize: 14 }} />
      </IconButton>
    </Box>
  );
}
