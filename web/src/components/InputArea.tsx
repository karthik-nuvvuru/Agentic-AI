import { useCallback, useRef, useEffect, useState } from "react";
import { Box, IconButton, Paper, TextField, Typography } from "@mui/material";
import { AttachFile, Close, ArrowUpward, StopCircle } from "@mui/icons-material";

interface PendingFile {
  file: File;
  name: string;
  size: number;
  progress: number;
  done: boolean;
  error?: string;
}

interface InputAreaProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  isStreaming: boolean;
  pendingFiles: PendingFile[];
  onAddFiles: (files: FileList | File[]) => void;
  onRemoveFile: (index: number) => void;
}

export function InputArea({
  value, onChange, onSend, onStop, isStreaming,
  pendingFiles, onAddFiles, onRemoveFile,
}: InputAreaProps) {
  const [dragging, setDragging] = useState(false);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = inputRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    }
  }, [value]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (value.trim() && !isStreaming) onSend();
    }
  }, [value, isStreaming, onSend]);

  const canSend = value.trim().length > 0 && !isStreaming;

  return (
    <Box
      sx={{
        px: { xs: 2, sm: 3 },
        py: { xs: 1.5, sm: 2 },
        maxWidth: 768,
        mx: "auto",
        width: "100%",
        position: "relative",
      }}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer.files?.length) onAddFiles(e.dataTransfer.files);
      }}
    >
      {/* Drag overlay */}
      {dragging && (
        <Box
          sx={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            bgcolor: "rgba(99,102,241,.06)",
            backdropFilter: "blur(6px)",
            border: "2px dashed #6366f1",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Typography sx={{ color: "#818cf8", fontWeight: 500, fontSize: 16 }}>
            Drop files to upload
          </Typography>
        </Box>
      )}

      {/* File chips */}
      {pendingFiles.length > 0 && (
        <Box
          sx={{
            mb: 1.5,
            display: "flex",
            flexWrap: "wrap",
            gap: 1.5,
            animation: "fadeIn 0.2s",
          }}
        >
          {pendingFiles.map((f, i) => (
            <Box
              key={i}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                px: 1.5,
                py: 0.5,
                borderRadius: 1.5,
                bgcolor: f.error ? "rgba(239,68,68,.06)" : "rgba(255,255,255,.06)",
                border: `1px solid ${f.error ? "rgba(239,68,68,.15)" : "rgba(255,255,255,.1)"}`,
                animation: "chipIn 0.2s ease-out",
                maxWidth: 220,
              }}
            >
              <Box
                sx={{
                  width: 18,
                  height: 18,
                  borderRadius: 0.75,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  bgcolor: f.error
                    ? "rgba(239,68,68,.1)"
                    : f.progress >= 100
                    ? "rgba(52,211,153,.1)"
                    : "rgba(99,102,241,.1)",
                }}
              >
                <Typography
                  sx={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: f.error
                      ? "#f87171"
                      : f.progress >= 100
                      ? "#34d399"
                      : "#818cf8",
                  }}
                >
                  {f.error ? "!" : f.progress >= 100 ? "\u2713" : (f.name.split(".").pop()?.toUpperCase().slice(0, 3) || "FILE")}
                </Typography>
              </Box>
              <Typography
                sx={{
                  fontSize: 12,
                  maxWidth: 100,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  color: "#a1a1aa",
                }}
              >
                {f.name}
              </Typography>
              {!f.done && !f.error && (
                <Box
                  sx={{
                    width: 36,
                    height: 3,
                    borderRadius: 2,
                    bgcolor: "rgba(255,255,255,.08)",
                    overflow: "hidden",
                  }}
                >
                  <Box
                    sx={{
                      height: "100%",
                      width: `${f.progress}%`,
                      bgcolor: "#6366f1",
                      borderRadius: 2,
                      transition: "width .2s",
                    }}
                  />
                </Box>
              )}
              <Typography
                sx={{ fontSize: 10, color: "#52525b", flexShrink: 0 }}
              >
                {f.error || (f.done ? "ready" : `${(f.size / 1024).toFixed(0)} KB`)}
              </Typography>
              <IconButton
                size="small"
                onClick={() => onRemoveFile(i)}
                sx={{
                  p: 0.25,
                  color: "#52525b",
                  ":hover": { color: "#f87171" },
                  minHeight: 20,
                  minWidth: 20,
                }}
              >
                <Close sx={{ fontSize: 12 }} />
              </IconButton>
            </Box>
          ))}
        </Box>
      )}

      {/* Input bar — glassmorphic */}
      <Paper
        elevation={0}
        sx={{
          p: "4px 4px 4px 8px",
          borderRadius: 4,
          bgcolor: focused ? "rgba(255,255,255,.08)" : "rgba(255,255,255,.06)",
          border: `1px solid ${dragging ? "#6366f1" : focused ? "rgba(99,102,241,.4)" : "rgba(255,255,255,.1)"}`,
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          boxShadow: focused
            ? "0 0 0 2px rgba(99,102,241,.1), 0 4px 24px rgba(0,0,0,.2)"
            : "0 2px 8px rgba(0,0,0,.12)",
          transition: "border-color .15s, box-shadow .15s, background .15s",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "flex-end", gap: 1 }}>
          {/* Attach */}
          <IconButton
            size="small"
            title="Attach files"
            onClick={() => fileRef.current?.click()}
            disabled={isStreaming}
            sx={{
              color: "#71717a",
              flexShrink: 0,
              "&:hover:not(:disabled)": { color: "#a1a1aa", bgcolor: "rgba(255,255,255,.06)" },
              mb: 0.5,
              transition: "transform .1s",
              "&:active": { transform: "scale(0.92)" },
            }}
          >
            <AttachFile sx={{ fontSize: 18 }} />
          </IconButton>
          <input
            ref={fileRef}
            hidden
            type="file"
            accept=".pdf,.txt,.md,.csv,.json"
            onChange={(e) => {
              if (e.target.files?.length) {
                onAddFiles(e.target.files);
                e.target.value = "";
              }
            }}
          />

          {/* Textarea */}
          <TextField
            inputRef={inputRef}
            fullWidth
            multiline
            maxRows={6}
            placeholder="Message Agentic AI\u2026"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            InputProps={{
              disableUnderline: true,
              sx: {
                color: "#e4e4e7",
                fontSize: 14,
                minHeight: 36,
                padding: "6px 4px",
                "&::placeholder": { color: "rgba(255,255,255,.35)", opacity: 1 },
              },
            }}
            sx={{ "& fieldset": { display: "none" } }}
          />

          {/* Send / Stop */}
          {isStreaming ? (
            <IconButton
              title="Stop generating"
              onClick={onStop}
              sx={{
                color: "#f87171",
                bgcolor: "rgba(239,68,68,.1)",
                flexShrink: 0,
                mb: 0.5,
                "&:hover": { bgcolor: "rgba(239,68,68,.15)" },
                animation: "stopPulse 1.5s ease-in-out infinite",
                transition: "transform .1s",
                "&:active": { transform: "scale(0.92)" },
              }}
            >
              <StopCircle sx={{ fontSize: 20 }} />
            </IconButton>
          ) : (
            <IconButton
              title="Send message"
              disabled={!canSend}
              onClick={onSend}
              sx={{
                flexShrink: 0,
                mb: 0.5,
                color: canSend ? "#fff" : "#52525b",
                bgcolor: canSend ? "#6366f1" : "rgba(255,255,255,.04)",
                "&:hover:not(:disabled)": { bgcolor: "#4f46e5" },
                transition: "all .15s, transform .1s",
                "&:active:not(:disabled)": { transform: "scale(0.92)" },
              }}
            >
              <ArrowUpward
                sx={{
                  fontSize: 17,
                  transform: canSend ? "rotate(0deg)" : "none",
                }}
              />
            </IconButton>
          )}
        </Box>
      </Paper>

      <Typography
        sx={{
          textAlign: "center",
          mt: 0.5,
          fontSize: 11,
          color: "rgba(255,255,255,.2)",
          userSelect: "none",
        }}
      >
        {isStreaming ? "Generating response\u2026" : "Press Enter to send, Shift+Enter for new line"}
      </Typography>
    </Box>
  );
}
