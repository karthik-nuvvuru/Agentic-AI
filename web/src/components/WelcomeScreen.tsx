import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import QuestionAnswerIcon from "@mui/icons-material/QuestionAnswer";
import ArticleIcon from "@mui/icons-material/Article";
import SearchIcon from "@mui/icons-material/Search";
import ChatIcon from "@mui/icons-material/Chat";
import { Box, Button, Paper, Stack, Typography, Avatar } from "@mui/material";

interface WelcomeScreenProps {
  onQuickQuestion: (question: string) => void;
}

const quickQuestions = [
  "Summarize the key points from the uploaded document",
  "What are the main topics covered?",
  "Compare and contrast the findings",
  "What conclusions can be drawn?",
];

const features = [
  {
    icon: UploadFileIcon,
    title: "Upload Documents",
    desc: "PDFs, text, and markdown files",
  },
  {
    icon: SearchIcon,
    title: "RAG-Powered Search",
    desc: "Retrieve relevant context intelligently",
  },
  {
    icon: ArticleIcon,
    title: "Source Tracking",
    desc: "Every answer cites its sources",
  },
  {
    icon: ChatIcon,
    title: "Conversational AI",
    desc: "Ask follow-up questions naturally",
  },
];

export function WelcomeScreen({ onQuickQuestion }: WelcomeScreenProps) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100%",
        py: 4,
        animation: "fadeInUp 0.5s ease-out",
      }}
    >
      <Avatar
        sx={{
          width: 72,
          height: 72,
          mb: 2,
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          boxShadow: "0 4px 20px rgba(102, 126, 234, 0.4)",
        }}
      >
        <AutoAwesomeIcon sx={{ fontSize: 36 }} />
      </Avatar>

      <Typography
        variant="h4"
        sx={{
          fontWeight: 700,
          mb: 1,
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        Agentic AI Assistant
      </Typography>

      <Typography variant="body1" color="text.secondary" sx={{ mb: 4, textAlign: "center", maxWidth: 480 }}>
        Upload your documents and ask questions. Get intelligent, source-attributed answers powered by RAG.
      </Typography>

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ width: "100%", maxWidth: 720, mb: 5 }}
      >
        {features.map((f) => (
          <Paper
            key={f.title}
            elevation={0}
            sx={{
              flex: 1,
              p: 2.5,
              textAlign: "center",
              bgcolor: "action.hover",
              borderRadius: 2,
              border: "1px solid",
              borderColor: "divider",
              transition: "transform 0.2s, box-shadow 0.2s",
              "&:hover": {
                transform: "translateY(-2px)",
                boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
              },
            }}
          >
            <Avatar
              sx={{
                width: 40,
                height: 40,
                mx: "auto",
                mb: 1,
                bgcolor: "rgba(102, 126, 234, 0.12)",
                color: "#667eea",
              }}
            >
              <f.icon sx={{ fontSize: 20 }} />
            </Avatar>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
              {f.title}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {f.desc}
            </Typography>
          </Paper>
        ))}
      </Stack>

      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2, fontWeight: 500 }}>
        Quick questions to get started
      </Typography>

      <Stack direction="column" spacing={1.5} sx={{ width: "100%", maxWidth: 520 }}>
        {quickQuestions.map((q) => (
          <Button
            key={q}
            variant="outlined"
            fullWidth
            onClick={() => onQuickQuestion(q)}
            startIcon={<QuestionAnswerIcon sx={{ fontSize: 18 }} />}
            sx={{
              justifyContent: "flex-start",
              py: 1.5,
              px: 2,
              borderRadius: 2,
              textAlign: "left",
              textTransform: "none",
              color: "text.primary",
              borderColor: "divider",
              bgcolor: "action.hover",
              "&:hover": {
                bgcolor: "rgba(102, 126, 234, 0.08)",
                borderColor: "#667eea",
                color: "#667eea",
              },
            }}
          >
            <Typography variant="body2" noWrap>
              {q}
            </Typography>
          </Button>
        ))}
      </Stack>
    </Box>
  );
}
