import {
  Box,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import CloseIcon from "@mui/icons-material/Close";
import SendIcon from "@mui/icons-material/Send";
import StopCircleIcon from "@mui/icons-material/StopCircle";
import { useCallback, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
type PF = { file: File; prog: number; done: boolean; err?: string };

const MAX_F = 10_485_760;
const EXTS = [".pdf", ".txt", ".md", ".csv", ".json"];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function fI(n: string) {
  const e = "." + n.split(".").pop()!.toLowerCase();
  const m: Record<string, string> = { ".pdf": "PDF", ".txt": "TXT", ".md": "MD", ".csv": "CSV", ".json": "JSON" };
  return m[e] || "FILE";
}

function fS(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}

/* ------------------------------------------------------------------ */
/*  InputArea                                                          */
/* ------------------------------------------------------------------ */
interface InputAreaProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  files: PF[];
  onAddFiles: (fl: FileList | File[]) => void;
  onRemoveFile: (i: number) => void;
  isStreaming: boolean;
  disabled?: boolean;
}

export function InputArea({
  value,
  onChange,
  onSend,
  onStop,
  files,
  onAddFiles,
  onRemoveFile,
  isStreaming,
  disabled,
}: InputAreaProps) {
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const canSend = value.trim().length > 0 && !disabled;

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (e.dataTransfer.files?.length) onAddFiles(e.dataTransfer.files);
    },
    [onAddFiles]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (canSend) onSend();
      }
    },
    [canSend, onSend]
  );

  return (
    <Box
      sx={{ px: { xs: 1, sm: 2 }, py: 1, maxWidth: 768, mx: "auto", width: "100%" }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      {dragging && (
        <Box
          sx={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            bgcolor: "var(--color-drag-overlay)",
            backdropFilter: "blur(4px)",
            border: "2px dashed var(--color-link)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            animation: "fadeIn 0.15s",
          }}
        >
          <Typography sx={{ color: "var(--color-link)", fontWeight: 500, fontSize: "1rem" }}>
            Drop files to upload
          </Typography>
        </Box>
      )}

      {/* File chips */}
      {files.length > 0 && (
        <Stack direction="row" spacing={0.75} sx={{ mb: 1, flexWrap: "wrap", gap: 0.5, animation: "fadeIn 0.2s" }}>
          {files.map((f, i) => (
            <Box
              key={i}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.75,
                px: 1,
                py: 0.35,
                borderRadius: 1.5,
                bgcolor: f.err ? "rgba(239,68,68,.06)" : "var(--color-chip-bg)",
                border: `1px solid ${f.err ? "rgba(239,68,68,.15)" : "var(--color-chip-border)"}`,
                animation: "chipIn 0.2s ease-out",
                maxWidth: "100%",
              }}
            >
              <Box
                sx={{
                  width: 18,
                  height: 18,
                  borderRadius: 0.5,
                  bgcolor: f.err ? "rgba(239,68,68,.1)" : f.prog >= 100 ? "rgba(52,211,153,.1)" : "rgba(99,102,241,.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Typography
                  sx={{
                    fontSize: "0.55rem",
                    fontWeight: 700,
                    color: f.err ? "#f87171" : f.prog >= 100 ? "#34d399" : "#818cf8",
                  }}
                >
                  {f.err ? "!" : f.prog >= 100 ? "✓" : fI(f.file.name)}
                </Typography>
              </Box>
              <Typography sx={{ fontSize: "0.7rem", maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "text.primary" }}>
                {f.file.name}
              </Typography>
              <Typography sx={{ fontSize: "0.58rem", color: "text.disabled" }}>{fS(f.file.size)}</Typography>
              <IconButton size="small" onClick={() => onRemoveFile(i)} sx={{ p: 0.25, color: "text.disabled", ":hover": { color: "#f87171" }, minHeight: 24, minWidth: 24 }}>
                <CloseIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Box>
          ))}
        </Stack>
      )}

      {/* Input bar */}
      <Paper
        elevation={0}
        sx={{
          p: "4px 4px 4px 10px",
          borderRadius: 3,
          bgcolor: "var(--color-input-bg)",
          border: `1px solid ${dragging ? "var(--color-link)" : "var(--color-input-border)"}`,
          transition: "all 0.2s",
          "&:focus-within": {
            borderColor: "var(--color-input-focus-border)",
            boxShadow: "var(--color-input-focus-shadow)",
          },
        }}
      >
        <Stack direction="row" alignItems="flex-end" spacing={0}>
          <IconButton
            size="small"
            onClick={() => fileRef.current?.click()}
            sx={{ color: "var(--color-icon)", p: 0.5, mb: 0.25, "&:hover": { color: "text.primary", bgcolor: "var(--color-icon-hover)" }, minHeight: 36, minWidth: 36 }}
          >
            <AttachFileIcon sx={{ fontSize: 16 }} />
          </IconButton>
          <TextField
            fullWidth
            placeholder="Message…"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            multiline
            maxRows={6}
            minRows={1}
            disabled={disabled && !isStreaming}
            sx={{
              "& .MuiInputBase-root": {
                color: "text.primary",
                bgcolor: "transparent",
                border: "none",
                boxShadow: "none",
                fontSize: "0.86rem",
                lineHeight: 1.4,
                padding: "5px 4px",
              },
              "& .MuiInputBase-input:disabled": {
                opacity: 0.5,
                WebkitTextFillColor: "text.disabled",
              },
              "& .MuiInputBase-input::placeholder": {
                color: "var(--color-placeholder)",
                fontSize: "0.84rem",
              },
            }}
            InputProps={{ disableUnderline: true }}
          />
          {isStreaming ? (
            <IconButton
              onClick={onStop}
              sx={{
                color: "#f87171",
                p: 0.5,
                mb: 0.25,
                bgcolor: "rgba(239,68,68,.08)",
                animation: "stopPulse 1.5s ease-in-out infinite",
                minHeight: 36,
                minWidth: 36,
                "&:hover": { bgcolor: "rgba(239,68,68,.15)" },
              }}
            >
              <StopCircleIcon sx={{ fontSize: 20 }} />
            </IconButton>
          ) : (
            <IconButton
              disabled={!canSend}
              onClick={onSend}
              sx={{
                p: 0.5,
                mb: 0.25,
                minHeight: 36,
                minWidth: 36,
                color: canSend ? "primary.main" : "var(--color-icon)",
                "&:hover": canSend ? { bgcolor: "var(--color-icon-hover)" } : { bgcolor: "var(--color-icon-hover)" },
                transition: "all 0.15s",
              }}
            >
              <SendIcon
                sx={{
                  fontSize: 17,
                  transform: canSend ? "rotate(-45deg)" : "none",
                  transition: "transform 0.15s",
                }}
              />
            </IconButton>
          )}
        </Stack>
      </Paper>

      {/* Footer hint */}
      <Typography
        sx={{ textAlign: "center", mt: 0.5, fontSize: "0.62rem", color: "text.disabled" }}
      >
        {isStreaming ? "AI is thinking…" : "Press Cmd/Ctrl+Enter to send"}
      </Typography>
    </Box>
  );
}
