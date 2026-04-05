import { useCallback, useRef, useState, useEffect } from "react";
import { Box, Paper, TextField, Typography, IconButton, Fade } from "@mui/material";
import {
  AttachFile,
  Close,
  Send,
  StopCircle,
  ArrowUpward,
} from "@mui/icons-material";

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
  disabled: boolean;
  isStreaming: boolean;
  pendingFiles: PendingFile[];
  onAddFiles: (files: FileList | File[]) => void;
  onRemoveFile: (index: number) => void;
  onSubmitFile?: (file: File) => void;
}

function fileExt(name: string): string {
  const ext = "." + name.split(".").pop()!.toLowerCase();
  const map: Record<string, string> = { ".pdf": "PDF", ".txt": "TXT", ".md": "MD", ".csv": "CSV", ".json": "JSON" };
  return map[ext] || "FILE";
}

function fileSize(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}

export function InputArea({
  value,
  onChange,
  onSend,
  onStop,
  disabled,
  isStreaming,
  pendingFiles,
  onAddFiles,
  onRemoveFile,
  onSubmitFile,
}: InputAreaProps) {
  const [dragging, setDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canSend = value.trim().length > 0 && !disabled && !isStreaming;

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (canSend) onSend();
      }
    },
    [canSend, onSend]
  );

  const handleSubmitFile = useCallback(
    (f: File) => {
      onSubmitFile?.(f);
    },
    [onSubmitFile]
  );

  return (
    <Box
      sx={{ px: { xs: 1, sm: 2 }, pb: { xs: 1, sm: 2 }, pt: 0.5, maxWidth: 768, mx: "auto", width: "100%" }}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer.files?.length) onAddFiles(e.dataTransfer.files);
      }}
    >
      {/* Drag overlay */}
      <Fade in={dragging}>
        <Box
          sx={{
            position: "fixed", inset: 0, zIndex: 9999,
            bgcolor: "rgba(99,102,241,.06)", backdropFilter: "blur(6px)",
            border: "2px dashed #6366f1",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <Typography sx={{ color: "#818cf8", fontWeight: 500, fontSize: "1rem" }}>
            Drop files to upload
          </Typography>
        </Box>
      </Fade>

      {/* File chips */}
      {pendingFiles.length > 0 && (
        <Box sx={{ mb: 1.5, display: "flex", flexWrap: "wrap", gap: 1.5, animation: "fadeIn 0.2s" }}>
          {pendingFiles.map((f, i) => (
            <Box
              key={i}
              sx={{
                display: "flex", alignItems: "center", gap: 1,
                px: 1.5, py: 0.5, borderRadius: 1.5,
                bgcolor: f.error ? "rgba(239,68,68,.06)" : "rgba(255,255,255,.06)",
                border: `1px solid ${f.error ? "rgba(239,68,68,.15)" : "rgba(255,255,255,.08)"}`,
                animation: "chipIn 0.2s ease-out",
                maxWidth: 220,
              }}
            >
              <Box
                sx={{
                  width: 20, height: 20, borderRadius: 0.75, display: "flex",
                  alignItems: "center", justifyContent: "center", flexShrink: 0,
                  bgcolor: f.error ? "rgba(239,68,68,.1)" : f.progress >= 100 ? "rgba(52,211,153,.1)" : "rgba(99,102,241,.1)",
                }}
              >
                <Typography sx={{ fontSize: "0.55rem", fontWeight: 700, color: f.error ? "#f87171" : f.progress >= 100 ? "#34d399" : "#818cf8" }}>
                  {f.error ? "!" : f.progress >= 100 ? "✓" : fileExt(f.name)}
                </Typography>
              </Box>
              <Typography sx={{ fontSize: "0.7rem", maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "text.primary", flexShrink: 1 }}>
                {f.name}
              </Typography>

              {/* Progress bar */}
              {!f.done && !f.error && (
                <Box sx={{ width: 40, height: 3, borderRadius: 2, bgcolor: "rgba(255,255,255,.06)", overflow: "hidden", flexShrink: 0 }}>
                  <Box sx={{ width: `${f.progress}%`, height: "100%", bgcolor: "#818cf8", borderRadius: 2, transition: "width 0.2s" }} />
                </Box>
              )}

              <Typography sx={{ fontSize: "0.55rem", color: "text.disabled", flexShrink: 0 }}>
                {f.error ? f.error : fileSize(f.size)}
              </Typography>
              <IconButton
                size="small"
                onClick={() => onRemoveFile(i)}
                sx={{ p: 0.25, color: "text.disabled", ":hover": { color: "#f87171" }, minHeight: 20, minWidth: 20, flexShrink: 0 }}
              >
                <Close sx={{ fontSize: 12 }} />
              </IconButton>
            </Box>
          ))}
        </Box>
      )}

      {/* Input bar */}
      <Paper
        elevation={0}
        sx={{
          p: "4px 4px 4px 8px",
          borderRadius: 4,
          bgcolor: "rgba(255,255,255,.04)",
          border: `1px solid ${dragging ? "#6366f1" : "rgba(255,255,255,.08)"}`,
          transition: "border-color 0.15s, box-shadow 0.15s",
          "&:focus-within": {
            borderColor: "rgba(99,102,241,.4)",
            boxShadow: "0 0 0 2px rgba(99,102,241,.08)",
          },
        }}
      >
        <div className="flex items-end gap-1">
          <IconButton
            size="small"
            onClick={() => fileInputRef.current?.click()}
            disabled={isStreaming}
            sx={{
              color: "rgba(255,255,255,.35)", p: 0.75, flexShrink: 0,
              "&:hover:not(:disabled)": { color: "#e4e4e7", bgcolor: "rgba(255,255,255,.06)" },
            }}
          >
            <AttachFile sx={{ fontSize: 16 }} />
          </IconButton>

          <input
            ref={fileInputRef}
            hidden
            type="file"
            accept=".pdf,.txt,.md,.csv,.json"
            onChange={(e) => {
              if (e.target.files) {
                if (e.target.files.length === 1 && !pendingFiles.length) {
                  handleSubmitFile(e.target.files[0]);
                } else {
                  onAddFiles(e.target.files);
                }
              }
              e.target.value = "";
            }}
          />

          <TextField
            inputRef={textareaRef}
            fullWidth
            multiline
            maxRows={6}
            placeholder="Ask anything…"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled && !isStreaming}
            sx={{
              "& .MuiInputBase-root": {
                color: "text.primary", bgcolor: "transparent", border: "none",
                boxShadow: "none", fontSize: "0.88rem", lineHeight: 1.5, padding: "8px 8px",
              },
              "& .MuiInputBase-input:disabled": { opacity: 0.5, WebkitTextFillColor: "rgba(255,255,255,.3)" },
              "& .MuiInputBase-input::placeholder": { color: "rgba(255,255,255,.25)", fontSize: "0.86rem" },
            }}
            InputProps={{ disableUnderline: true }}
          />

          {isStreaming ? (
            <IconButton
              onClick={onStop}
              sx={{
                color: "#f87171", p: 0.75, flexShrink: 0, mb: "1px",
                bgcolor: "rgba(239,68,68,.08)",
                animation: "stopPulse 1.5s ease-in-out infinite",
                "&:hover": { bgcolor: "rgba(239,68,68,.15)" },
              }}
            >
              <StopCircle sx={{ fontSize: 20 }} />
            </IconButton>
          ) : (
            <IconButton
              disabled={!canSend}
              onClick={onSend}
              sx={{
                p: 0.75, flexShrink: 0, mb: "1px",
                color: canSend ? "#e4e4e7" : "rgba(255,255,255,.2)",
                bgcolor: canSend ? "#667eea" : "rgba(255,255,255,.04)",
                "&:hover:not(:disabled)": { bgcolor: "#5a6fd6" },
                transition: "all 0.15s",
              }}
            >
              <ArrowUpward sx={{ fontSize: 17 }} />
            </IconButton>
          )}
        </div>
      </Paper>

      {/* Footer text */}
      <Typography sx={{ textAlign: "center", mt: 0.5, fontSize: "0.6rem", color: "text.disabled", userSelect: "none" }}>
        {isStreaming ? "Generating response…" : "Press Enter to send, Shift+Enter for new line"}
      </Typography>
    </Box>
  );
}
