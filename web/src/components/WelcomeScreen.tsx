import { Box, Button, Paper, Stack, Typography, Avatar as MuiAvatar } from "@mui/material";
import {
  UploadFile as UploadFileIcon,
  AutoAwesome as SparklesIcon,
  Chat as ChatIcon,
  AutoFixHigh as MagicIcon,
} from "@mui/icons-material";

interface WelcomeScreenProps {
  onQuickQuestion: (question: string) => void;
}

const quickQuestions = [
  "Explain how quantum computing works in simple terms",
  "What are the best practices for API design?",
  "Compare REST vs GraphQL vs gRPC",
  "Help me understand machine learning basics",
];

export function WelcomeScreen({ onQuickQuestion }: WelcomeScreenProps) {
  return (
    <Box className="flex flex-col items-center justify-center min-h-[70vh] py-8 animate-[fadeInUp_0.4s_ease-out]">
      {/* Title area */}
      <div className="flex items-center justify-center w-16 h-16 mb-5 rounded-2xl bg-gradient-to-br from-[#667eea] to-[#7c3aed] shadow-[0_8px_32px_rgba(102,126,234,.35)]">
        <SparklesIcon sx={{ fontSize: 32, color: "#fff" }} />
      </div>

      <Typography
        variant="h4"
        sx={{
          fontWeight: 700, mb: 1.5,
          background: "linear-gradient(135deg, #667eea 0%, #a78bfa 100%)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}
      >
        How can I help you today?
      </Typography>

      <Typography variant="body1" color="text.secondary" className="text-center max-w-xl mb-8 leading-relaxed">
        I'm your AI assistant with access to your documents. Upload files, ask questions, and get intelligent answers with source citations.
      </Typography>

      {/* Feature grid */}
      <Box className="flex gap-3 max-w-xl mb-8">
        {[
          { icon: UploadFileIcon, label: "Upload docs", desc: "PDF, TXT, MD, CSV, JSON" },
          { icon: MagicIcon, label: "Smart retrieval", desc: "Hybrid vector + keyword search" },
          { icon: ChatIcon, label: "Follow-ups", desc: "Ask naturally, stay in context" },
        ].map((f, i) => (
          <Box key={i} className="flex-1">
            <Paper
              elevation={0}
              className="text-center p-4 rounded-xl border transition-all duration-200 cursor-default hover:translate-y-[-2px]"
              sx={{
                bgcolor: "action.hover",
                borderColor: "divider",
                "&:hover": { boxShadow: "0 4px 16px rgba(0,0,0,.15)" },
              }}
            >
              <MuiAvatar
                className="mx-auto mb-2"
                sx={{
                  width: 36, height: 36,
                  bgcolor: "rgba(102,126,234,.1)", color: "#818cf8",
                }}
              >
                <f.icon sx={{ fontSize: 17 }} />
              </MuiAvatar>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.25, fontSize: "0.82rem", letterSpacing: "-0.01em" }}>
                {f.label}
              </Typography>
              <Typography variant="caption" color="text.disabled" sx={{ fontSize: "0.68rem" }}>
                {f.desc}
              </Typography>
            </Paper>
          </Box>
        ))}
      </Box>

      {/* Quick questions */}
      <Box sx={{ width: "100%", maxWidth: 520 }}>
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2, fontWeight: 500, fontSize: "0.82rem" }}>
          Try asking
        </Typography>

        <Stack direction="column" spacing={1.5}>
          {quickQuestions.map((q, i) => (
            <Button
              key={q}
              variant="outlined"
              fullWidth
              onClick={() => onQuickQuestion(q)}
              sx={{
                justifyContent: "flex-start", py: 1.5, px: 2.5, borderRadius: 2,
                textAlign: "left", textTransform: "none", color: "text.primary",
                borderColor: "var(--color-border)",
                bgcolor: "rgba(255,255,255,.02)",
                fontSize: "0.86rem",
                transition: "all 0.15s",
                "& .MuiButton-startIcon": { display: "flex", alignItems: "center" },
                "&:hover": {
                  bgcolor: "rgba(102,126,234,.06)", borderColor: "rgba(102,126,234,.3)",
                },
              }}
            >
              <span className="w-5 h-5 rounded-full bg-[var(--color-chip-bg)] border border-[var(--color-chip-border)] flex items-center justify-center text-[0.6rem] font-bold text-[var(--color-text-secondary)] flex-shrink-0 mr-2.5">
                {i + 1}
              </span>
              <Typography variant="body2" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {q}
              </Typography>
            </Button>
          ))}
        </Stack>
      </Box>
    </Box>
  );
}
