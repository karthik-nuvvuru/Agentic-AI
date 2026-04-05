import {
  Avatar,
  Box,
  Button,
  CssBaseline,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  TextField,
  ThemeProvider,
  Tooltip,
  Typography,
  createTheme,
  useMediaQuery,
} from "@mui/material";
import {
  Add as AddIcon,
  DarkModeOutlined as DarkModeOutlined,
  LightModeOutlined as LightModeOutlined,
  Menu as MenuIcon,
  SmartToy as SmartToyIcon,
  UploadFile as UploadFileIcon,
} from "@mui/icons-material";
import { useCallback, useEffect, useRef, useState } from "react";
import "./index.css";
import { apiMe, apiLogout, type Conv } from "./services/api";
import AuthScreen from "./AuthScreen";
import { useChat } from "./hooks/useChat";
import { Sidebar } from "./components/Sidebar";
import { InputArea } from "./components/InputArea";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { MessageBubble } from "./components/MessageBubble";
import { ScrollContainer } from "./components/ScrollContainer";
import { SidebarSkeletons } from "./components/Skeleton";

const darkTheme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#667eea" },
    background: { default: "#09090b", paper: "rgba(255,255,255,.05)" },
    text: { primary: "#e4e4e7", secondary: "#a1a1aa", disabled: "rgba(255,255,255,.3)" },
    divider: "rgba(255,255,255,.1)",
    error: { main: "#f87171" },
    success: { main: "#34d399" },
  },
  shape: { borderRadius: 10 },
  typography: { fontFamily: "'Inter', system-ui, -apple-system, sans-serif" },
  components: {
    MuiButton: { styleOverrides: { root: { textTransform: "none", fontWeight: 500, borderRadius: 8 } } },
    MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
    MuiSkeleton: { styleOverrides: { root: { bgcolor: "rgba(128,128,128,.08)" } } },
    MuiListItemButton: { styleOverrides: { root: { minHeight: 40, borderRadius: 8 } } },
    MuiTextField: {
      styleOverrides: { root: { "& .MuiOutlinedInput-root": { borderRadius: 12, backgroundColor: "rgba(255,255,255,.04)" } } },
    },
  },
});

interface AppUser {
  id: string;
  email: string;
  name: string;
}

export default function App() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [ready, setReady] = useState(false);
  const [input, setInput] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    return document.documentElement.classList.contains("light") ? false : true;
  });
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [showRename, setShowRename] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const chat = useChat();
  const isMobile = useMediaQuery("(max-width:640px)");

  /* Keep conv list ref current for header title display */
  const convListRef = useRef<Conv[]>([]);
  useEffect(() => { convListRef.current = chat.conversations; }, [chat.conversations]);

  /* ── Auth check ──────────────────────────────────────── */
  useEffect(() => {
    apiMe()
      .then((r) => setUser(r.user))
      .catch(() => setUser(null))
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (user) {
      chat.loadConversations();
    }
  }, [user]);

  /* ── Actions ─────────────────────────────────────────── */
  const handleSend = useCallback(() => {
    const txt = input.trim();
    if (!txt && chat.pendingFiles.filter((f) => !f.error).length === 0) return;

    if (chat.pendingFiles.length > 0) {
      chat.ingestFiles().then((names) => {
        const prompt = txt || `Summarize the uploaded documents: ${names.join(", ")}`;
        setInput("");
        chat.sendMessage(prompt);
      });
    } else {
      setInput("");
      chat.sendMessage(txt);
    }
  }, [input, chat]);

  const handleStop = useCallback(() => { chat.stop(); }, [chat]);

  const handleQuickQuestion = useCallback((q: string) => {
    chat.sendMessage(q);
  }, [chat]);

  const handleNewChat = useCallback(async () => {
    await chat.createChat();
    if (isMobile) setSidebarOpen(false);
  }, [chat, isMobile]);

  const handleSelectChat = useCallback(async (id: string) => {
    await chat.openChat(id);
    if (isMobile) setSidebarOpen(false);
  }, [chat, isMobile]);

  const handleDeleteChat = useCallback((id: string) => {
    chat.deleteChat(id);
  }, [chat]);

  const handleRenameChat = useCallback((id: string, title: string) => {
    chat.renameChat(id, title);
  }, [chat]);

  const handleStartRename = useCallback(() => {
    const current = convListRef.current.find((c) => c.id === chat.activeConvId);
    setRenameValue(current?.title || "");
    setShowRename(true);
  }, [chat.activeConvId]);

  const handleConfirmRename = useCallback(() => {
    if (chat.activeConvId && renameValue.trim()) {
      chat.renameChat(chat.activeConvId, renameValue.trim());
    }
    setShowRename(false);
  }, [chat.activeConvId, renameValue, chat]);

  const toggleTheme = useCallback(() => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.classList.toggle("dark", next);
    document.documentElement.classList.toggle("light", !next);
  }, [darkMode]);

  const handleLogout = useCallback(async () => {
    setAnchorEl(null);
    await apiLogout();
    sessionStorage.removeItem("auth_access_token");
    setUser(null);
  }, []);

  const handleFileClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  /* ── Loading / Auth ──────────────────────────────────── */
  if (!ready) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#09090b]">
        <div className="flex flex-col items-center gap-4">
          <SmartToyIcon sx={{ fontSize: 48, color: "#667eea", animation: "pulse 2s ease-in-out infinite" }} />
          <Typography variant="body2" sx={{ color: "#a1a1aa" }}>Loading...</Typography>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen onSuccess={() => setReady(true)} />;
  }

  /* ── Derived values ──────────────────────────────────── */
  const currentConvTitle = chat.activeConvId
    ? convListRef.current.find((c) => c.id === chat.activeConvId)?.title || "New Chat"
    : "New Chat";

  const userInitials =
    user?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || "?";

  const displayMessages = [
    ...chat.messages.map((m) => ({
      role: m.role,
      content: m.content,
      sources: m.sources,
      id: m.id,
      streaming: false as const,
      files: m.files,
    })),
    ...(chat.isStreaming || chat.streamingContent
      ? [{
          role: "assistant" as const,
          content: chat.streamingContent,
          sources: chat.streamingSources.length ? chat.streamingSources : undefined,
          id: undefined,
          streaming: true as const,
          files: undefined as undefined,
        }]
      : []),
  ];

  const hasContent = displayMessages.length > 0;

  /* ── Render ──────────────────────────────────────────── */
  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />

      {/* Hidden file input for header upload */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.txt,.md,.csv,.json"
        style={{ display: "none" }}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            chat.addFiles(e.target.files);
            e.target.value = "";
          }
        }}
      />

      <Stack direction="row" sx={{ height: "100vh", overflow: "hidden", bgcolor: "#09090b" }}>
        {/* ── Sidebar ─────────────────────────────────── */}
        <Sidebar
          convs={chat.conversations}
          convId={showRename ? null : chat.activeConvId}
          onNew={handleNewChat}
          onSelect={handleSelectChat}
          onDelete={handleDeleteChat}
          onRename={handleRenameChat}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* ── Main area ──────────────────────────────── */}
        <Box sx={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
          {/* Header */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              px: { xs: 1.5, sm: 2 },
              py: 1,
              gap: 1.25,
              borderBottom: "1px solid rgba(255,255,255,.06)",
              bgcolor: "rgba(9,9,11,.92)",
              backdropFilter: "blur(12px)",
              zIndex: 10,
              flexShrink: 0,
            }}
          >
            {/* Hamburger (mobile) */}
            <IconButton
              size="small"
              onClick={() => setSidebarOpen(true)}
              sx={{
                color: "#71717a",
                minWidth: 32,
                mr: { sm: 0 },
                display: { xs: "flex", sm: "none" },
              }}
            >
              <MenuIcon />
            </IconButton>

            {/* New Chat */}
            <Tooltip title="New Chat">
              <IconButton
                size="small"
                onClick={handleNewChat}
                sx={{
                  bgcolor: "rgba(102,126,234,.12)",
                  color: "#818cf8",
                  "&:hover": { bgcolor: "rgba(102,126,234,.2)" },
                  minWidth: 32,
                }}
              >
                <AddIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            {/* Logo + Brand */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexShrink: 0 }}>
              <SmartToyIcon sx={{ fontSize: 18, color: "#667eea" }} />
              <Typography
                variant="h6"
                sx={{
                  fontSize: 14,
                  fontWeight: 700,
                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  letterSpacing: -0.3,
                }}
              >
                Agentic AI
              </Typography>
            </Box>

            {/* Separator */}
            <Divider orientation="vertical" flexItem sx={{ bgcolor: "rgba(255,255,255,.08)", mx: 0.25 }} />

            {/* Conv title / rename */}
            <Box sx={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center" }}>
              {showRename ? (
                <Stack direction="row" spacing={0.75} alignItems="center" sx={{ flex: 1 }}>
                  <TextField
                    size="small"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleConfirmRename();
                      if (e.key === "Escape") setShowRename(false);
                    }}
                    autoFocus
                    fullWidth
                    sx={{ "& .MuiOutlinedInput-root": { fontSize: 13, bgcolor: "rgba(255,255,255,.06)" } }}
                  />
                  <Button
                    size="small"
                    variant="contained"
                    onClick={handleConfirmRename}
                    sx={{ bgcolor: "#667eea", fontSize: 12, px: 1.25, py: 0.5, minWidth: "auto" }}
                  >
                    Save
                  </Button>
                  <Button
                    size="small"
                    onClick={() => setShowRename(false)}
                    sx={{ fontSize: 12, px: 0.75, py: 0.5, minWidth: "auto" }}
                  >
                    Cancel
                  </Button>
                </Stack>
              ) : (
                <Tooltip title={currentConvTitle} placement="bottom-start">
                  <Typography
                    onClick={handleStartRename}
                    sx={{
                      fontSize: 13,
                      color: "#e4e4e7",
                      fontWeight: 500,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      cursor: "pointer",
                      px: 1,
                      py: 0.35,
                      borderRadius: 1,
                      transition: "background .15s",
                      "&:hover": { bgcolor: "rgba(255,255,255,.06)" },
                    }}
                  >
                    {currentConvTitle}
                  </Typography>
                </Tooltip>
              )}
            </Box>

            {/* Right actions */}
            <Stack direction="row" spacing={0.25} alignItems="center">
              {/* File upload */}
              <Tooltip title="Upload files">
                <IconButton
                  size="small"
                  onClick={handleFileClick}
                  sx={{
                    color: "#71717a",
                    minWidth: 32,
                    "&:hover": { color: "#667eea", bgcolor: "rgba(102,126,234,.1)" },
                  }}
                >
                  <UploadFileIcon fontSize="small" />
                </IconButton>
              </Tooltip>

              {/* Theme toggle */}
              <Tooltip title={darkMode ? "Light mode" : "Dark mode"}>
                <IconButton
                  size="small"
                  onClick={toggleTheme}
                  sx={{
                    color: "#71717a",
                    minWidth: 32,
                    "&:hover": {
                      color: darkMode ? "#fbbf24" : "#818cf8",
                      bgcolor: darkMode ? "rgba(251,191,36,.1)" : "rgba(99,102,241,.1)",
                    },
                  }}
                >
                  {darkMode ? <LightModeOutlined fontSize="small" /> : <DarkModeOutlined fontSize="small" />}
                </IconButton>
              </Tooltip>

              {/* User avatar */}
              <IconButton
                size="small"
                onClick={(e: React.MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget)}
                sx={{ px: 0.5 }}
              >
                <Avatar
                  sx={{
                    width: 28,
                    height: 28,
                    fontSize: 12,
                    fontWeight: 600,
                    bgcolor: "rgba(99,102,241,.15)",
                    color: "#a5b4fc",
                    border: "1.5px solid rgba(99,102,241,.3)",
                  }}
                >
                  {userInitials}
                </Avatar>
              </IconButton>
            </Stack>

            {/* User menu */}
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={() => setAnchorEl(null)}
              anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
              transformOrigin={{ vertical: "top", horizontal: "right" }}
              PaperProps={{ sx: { bgcolor: "#18181b", border: "1px solid rgba(255,255,255,.08)", borderRadius: 2, minWidth: 180, mt: 0.5 } }}
            >
              <Box sx={{ px: 2, py: 1.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, fontSize: 14, color: "#e4e4e7" }}>
                  {user?.name || "User"}
                </Typography>
                <Typography variant="caption" sx={{ color: "#71717a", display: "block", mt: 0.25 }}>
                  {user?.email}
                </Typography>
              </Box>
              <Divider sx={{ bgcolor: "rgba(255,255,255,.08)" }} />
              <MenuItem onClick={handleLogout} sx={{ justifyContent: "center", color: "#f87171", py: 1.25, fontSize: 14 }}>
                Sign out
              </MenuItem>
            </Menu>
          </Box>

          {/* Messages area */}
          <Box sx={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {hasContent ? (
              <ScrollContainer isStreaming={chat.isStreaming}>
                <div className="w-full max-w-3xl mx-auto px-4 py-6 space-y-4">
                  {displayMessages.map((msg, i) => (
                    <MessageBubble
                      key={msg.id ?? `msg-${i}`}
                      message={{
                        role: msg.role,
                        content: msg.content,
                        sources: msg.sources,
                        id: msg.id,
                        streaming: msg.streaming,
                        files: msg.files,
                      }}
                      onRegenerate={() => { if (!chat.isStreaming) chat.regenerate(); }}
                      onEditMessage={(index, text) => { if (!chat.isStreaming) chat.editAndResend(index, text); }}
                      messageIndex={i}
                    />
                  ))}
                </div>
              </ScrollContainer>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <WelcomeScreen onQuickQuestion={handleQuickQuestion} />
              </div>
            )}
          </Box>

          {/* Input area */}
          <Box sx={{ flexShrink: 0 }}>
            <InputArea
              value={input}
              onChange={setInput}
              onSend={handleSend}
              onStop={handleStop}
              disabled={false}
              isStreaming={chat.isStreaming}
              pendingFiles={chat.pendingFiles}
              onAddFiles={chat.addFiles}
              onRemoveFile={chat.removeFile}
            />
          </Box>
        </Box>
      </Stack>
    </ThemeProvider>
  );
}
