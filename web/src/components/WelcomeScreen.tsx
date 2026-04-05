import { Box, Stack, Typography, Paper } from "@mui/material";
import {
  UploadFile as UploadIcon,
  Search as SearchIcon,
  Chat as ChatIcon,
} from "@mui/icons-material";

interface WelcomeScreenProps {
  onQuickQuestion: (question: string) => void;
}

const quickQuestions = [
  { label: "Summarize the key points from the uploaded document", icon: "\u{1F4C4}" },
  { label: "What are the main topics covered in my files?", icon: "\u{1F50D}" },
  { label: "Compare and contrast the findings", icon: "\u2696\u{FE0F}" },
  { label: "What conclusions can be drawn?", icon: "\u{1F4A1}" },
];

const features = [
  { icon: UploadIcon, label: "Upload documents", desc: "PDF, TXT, MD, CSV" },
  { icon: SearchIcon, label: "Smart search", desc: "Vector + keyword RAG" },
  { icon: ChatIcon, label: "Follow-ups", desc: "Stay in context" },
];

export function WelcomeScreen({ onQuickQuestion }: WelcomeScreenProps) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "70vh",
        py: 5,
        px: 2,
        animation: "fadeInUp 0.4s ease-out",
      }}
    >
      {/* Icon */}
      <Box
        sx={{
          width: 56,
          height: 56,
          borderRadius: 3,
          mb: 3,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
          boxShadow: "0 4px 24px rgba(99,102,241,.35)",
          animation: "glow 8s ease-in-out infinite",
        }}
      >
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1.27A7 7 0 0 1 14 22h-4a7 7 0 0 1-6.73-3H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z" />
          <circle cx="7.5" cy="14" r="1.5" />
          <circle cx="16.5" cy="14" r="1.5" />
        </svg>
      </Box>

      {/* Title */}
      <Typography
        sx={{
          fontWeight: 800,
          fontSize: { xs: 28, sm: 36 },
          mb: 1.5,
          textAlign: "center",
          color: "#e4e4e7",
          letterSpacing: "-.03em",
        }}
      >
        Ask me anything
      </Typography>

      {/* Subtitle — ChatGPT style */}
      <Typography
        sx={{
          color: "#71717a",
          fontSize: 15,
          textAlign: "center",
          maxWidth: 480,
          mb: 4,
          lineHeight: 1.6,
        }}
      >
        Upload your documents and ask questions. Get intelligent, source-attributed answers powered by RAG.
      </Typography>

      {/* Feature grid */}
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ width: "100%", maxWidth: 600, mb: 5 }}
      >
        {features.map((f) => (
          <Paper
            key={f.label}
            elevation={0}
            sx={{
              flex: 1,
              p: 3,
              textAlign: "center",
              borderRadius: 3,
              bgcolor: "rgba(255,255,255,.04)",
              border: "1px solid rgba(255,255,255,.08)",
              transition: "all .2s",
              cursor: "default",
              "&:hover": {
                bgcolor: "rgba(255,255,255,.06)",
                transform: "translateY(-2px)",
                borderColor: "rgba(99,102,241,.2)",
              },
            }}
          >
            <Box
              sx={{
                width: 36,
                height: 36,
                mx: "auto",
                mb: 1.5,
                borderRadius: 2,
                bgcolor: "rgba(99,102,241,.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <f.icon sx={{ fontSize: 18, color: "#818cf8" }} />
            </Box>
            <Typography
              variant="body2"
              sx={{ fontWeight: 600, mb: 0.5, fontSize: 13, color: "#d4d4d8" }}
            >
              {f.label}
            </Typography>
            <Typography variant="body2" sx={{ fontSize: 12, color: "#71717a" }}>
              {f.desc}
            </Typography>
          </Paper>
        ))}
      </Stack>

      {/* Quick questions */}
      <Typography
        sx={{
          color: "#71717a",
          mb: 2,
          fontWeight: 500,
          fontSize: 13,
          letterSpacing: ".02em",
        }}
      >
        Try asking
      </Typography>

      <Stack direction="column" spacing={1.5} sx={{ width: "100%", maxWidth: 520 }}>
        {quickQuestions.map((q) => (
          <Box
            key={q.label}
            onClick={() => onQuickQuestion(q.label)}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              px: 3,
              py: 1.5,
              borderRadius: 3,
              cursor: "pointer",
              border: "1px solid rgba(255,255,255,.08)",
              bgcolor: "rgba(255,255,255,.02)",
              transition: "all .15s",
              "&:hover": {
                bgcolor: "rgba(99,102,241,.06)",
                borderColor: "rgba(99,102,241,.3)",
                transform: "translateY(-1px)",
                boxShadow: "0 2px 8px rgba(99,102,241,.08)",
              },
              "&:active": { transform: "scale(0.99)" },
            }}
          >
            <Box
              sx={{
                fontSize: 16,
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {q.icon}
            </Box>
            <Typography
              sx={{
                color: "#d4d4d8",
                fontSize: 14,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                lineHeight: 1.4,
              }}
            >
              {q.label}
            </Typography>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}
