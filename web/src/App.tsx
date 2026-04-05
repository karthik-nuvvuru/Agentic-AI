import {
  Avatar,
  Box,
  CssBaseline,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  ThemeProvider,
  Tooltip,
  Typography,
  createTheme,
  useMediaQuery,
} from "@mui/material";
import {
  DarkModeOutlined,
  LightModeOutlined,
  Menu as MenuIcon,
  SmartToy as SmartToyIcon,
} from "@mui/icons-material";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./index.css";
import { apiMe, apiLogout, type Conv } from "./services/api";
import AuthScreen from "./AuthScreen";
import { useChat } from "./hooks/useChat";
import { Sidebar } from "./components/Sidebar";
import { InputArea } from "./components/InputArea";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { MessageBubble } from "./components/MessageBubble";
import { ScrollContainer } from "./components/ScrollContainer";

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#667eea" },
    background: { default: "#212121", paper: "#2f2f2f" },
    text: { primary: "#ececec", secondary: "#b4b4b4" },
    divider: "rgba(255,255,255,.08)",
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
  },
});

interface AppUser { id: string; email: string; name: string }

export default function App() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [ready, setReady] = useState(false);
  const [input, setInput] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const chat = useChat();
  const isMobile = useMediaQuery("(max-width:640px)");
  const convListRef = useRef<Conv[]>([]);
  useEffect(() => { convListRef.current = chat.conversations; }, [chat.conversations]);

  const checkAuth = useCallback(() => {
    apiMe()
      .then((r) => setUser(r.user))
      .catch(() => setUser(null))
      .finally(() => setReady(true));
  }, []);

  useEffect(() => { checkAuth(); }, [checkAuth]);
  useEffect(() => { if (user) chat.loadConversations(); }, [user]);

  const handleSend = useCallback(() => {
    const txt = input.trim();
    if (!txt && chat.pendingFiles.filter((f) => !f.error).length === 0) return;
    chat.ingestFiles().then((names) => {
      const prompt = txt || `Summarize the uploaded documents: ${names.join(", ")}`;
      setInput("");
      chat.sendMessage(prompt);
      setTimeout(() => chat.loadConversations(), 500);
    });
  }, [input, chat]);

  const handleStop = useCallback(() => { chat.stop(); }, [chat]);
  const handleQuickQuestion = useCallback((q: string) => { chat.sendMessage(q); setTimeout(() => chat.loadConversations(), 500); }, [chat]);

  const handleNewChat = useCallback(async () => {
    await chat.createChat();
    setInput("");
    if (isMobile) setSidebarOpen(false);
  }, [chat, isMobile]);

  const handleSelectChat = useCallback(async (id: string) => {
    await chat.openChat(id);
    if (isMobile) setSidebarOpen(false);
  }, [chat, isMobile]);

  const handleDeleteChat = useCallback((id: string) => { chat.deleteChat(id); }, [chat]);
  const handleRenameChat = useCallback((id: string, title: string) => { chat.renameChat(id, title); }, [chat]);

  const toggleTheme = useCallback(() => {
    setDarkMode((p) => {
      const next = !p;
      document.documentElement.classList.toggle("dark", next);
      document.documentElement.classList.toggle("light", !next);
      return next;
    });
  }, []);

  const handleLogout = useCallback(async () => {
    setAnchorEl(null);
    await apiLogout();
    localStorage.removeItem("auth_access_token");
    sessionStorage.removeItem("auth_access_token");
    setUser(null);
  }, []);

  const currentConvTitle = chat.activeConvId
    ? convListRef.current.find((c) => c.id === chat.activeConvId)?.title || "New Chat"
    : "New Chat";

  const userInitials = user?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || "?";

  const displayMessages = useMemo(() => {
    const result: Array<{
      role: "user" | "assistant";
      content: string;
      sources?: Array<{ source: string; idx: number; number: number }>;
      id?: string;
      streaming?: boolean;
      files?: string[];
    }> = [];

    // Add all committed messages
    for (const m of chat.messages) {
      result.push({
        role: m.role,
        content: m.content,
        sources: m.sources,
        id: m.id,
        streaming: false,
        files: m.files,
      });
    }

    // Only show streaming bubble if actively streaming and last committed
    // message is not an assistant message (or doesn't have same content)
    if (chat.isStreaming && chat.streamingContent) {
      const lastMsg = result[result.length - 1];
      const shouldAddStreaming =
        !lastMsg ||
        lastMsg.role !== "assistant" ||
        lastMsg.content !== chat.streamingContent;

      if (shouldAddStreaming) {
        result.push({
          role: "assistant",
          content: chat.streamingContent,
          sources: chat.streamingSources.length ? chat.streamingSources : undefined,
          streaming: true,
        });
      }
    }

    return result;
  }, [chat.messages, chat.isStreaming, chat.streamingContent, chat.streamingSources]);

  const hasContent = displayMessages.length > 0;

  // Loading skeleton
  if (!ready) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#212121" }}>
        <SmartToyIcon sx={{ fontSize: 32, color: "#ececec", opacity: 0.6, animation: "pulse 1.5s ease-in-out infinite" }} />
      </div>
    );
  }

  if (!user) return <AuthScreen onSuccess={checkAuth} />;

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />

      <input
        ref={chat.inputRef}
        type="file"
        multiple
        accept=".pdf,.txt,.md,.csv,.json"
        style={{ display: "none" }}
        onChange={(e) => { if (e.target.files?.length) { chat.addFiles(e.target.files); e.target.value = ""; } }}
      />

      <Stack
        direction="row"
        sx={{
          height: "100vh",
          overflow: "hidden",
          bgcolor: "#212121",
          width: "100%",
          position: "relative",
        }}
      >
        {/* Sidebar */}
        {!isMobile && (
          <Box sx={{ width: 260, minWidth: 260, bgcolor: "#171717", display: "flex", flexDirection: "column" }}>
            <Sidebar
              convs={chat.conversations}
              convId={chat.activeConvId}
              onNew={handleNewChat}
              onSelect={handleSelectChat}
              onDelete={handleDeleteChat}
              onRename={handleRenameChat}
              open={false}
              onClose={() => {}}
              user={user}
            />
          </Box>
        )}

        {isMobile && (
          <Sidebar
            convs={chat.conversations}
            convId={chat.activeConvId}
            onNew={handleNewChat}
            onSelect={handleSelectChat}
            onDelete={handleDeleteChat}
            onRename={handleRenameChat}
            open={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            user={user}
          />
        )}

        {/* Main Chat Area */}
        <Box sx={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden", bgcolor: "#212121" }}>
          {/* Top Header Bar */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              px: { xs: 1.5, sm: 2 },
              py: 1,
              borderBottom: "1px solid rgba(255,255,255,.06)",
              bgcolor: "#212121",
              flexShrink: 0,
              minHeight: 48,
            }}
          >
            {isMobile && (
              <IconButton size="small" onClick={() => setSidebarOpen(true)} sx={{ color: "#b4b4b4", mr: 0.5 }}>
                <MenuIcon fontSize="small" />
              </IconButton>
            )}

            {/* Chat title — centered like ChatGPT */}
            <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 0.5 }}>
              <Typography
                sx={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: "#ececec",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: 200,
                }}
              >
                {currentConvTitle}
              </Typography>
            </Box>

            {/* Right actions */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <Tooltip title={darkMode ? "Light mode" : "Dark mode"}>
                <IconButton
                  size="small"
                  onClick={toggleTheme}
                  sx={{ color: "#b4b4b4", "&:hover": { bgcolor: "rgba(255,255,255,.08)" } }}
                >
                  {darkMode ? <LightModeOutlined fontSize="small" /> : <DarkModeOutlined fontSize="small" />}
                </IconButton>
              </Tooltip>

              {/* User avatar */}
              <IconButton size="small" onClick={(e: React.MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget)} sx={{ ml: 0.5 }}>
                <Avatar
                  sx={{
                    width: 28,
                    height: 28,
                    fontSize: 11,
                    fontWeight: 600,
                    bgcolor: "#667eea",
                    color: "#fff",
                  }}
                >
                  {userInitials}
                </Avatar>
              </IconButton>
            </Box>
          </Box>

          {/* Messages Area */}
          <Box sx={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {hasContent ? (
              <ScrollContainer isStreaming={chat.isStreaming}>
                <Box sx={{ width: "100%", maxWidth: 768, mx: "auto", px: { xs: 3, sm: 4 }, py: 6 }}>
                  {displayMessages.map((msg, i) => (
                    <MessageBubble
                      key={msg.id ?? `msg-${i}`}
                      message={{ role: msg.role, content: msg.content, sources: msg.sources, id: msg.id, streaming: msg.streaming, files: msg.files }}
                      isLastMessage={i === displayMessages.length - 1}
                      isStreaming={msg.streaming === true}
                      messageIndex={i}
                      onRegenerate={() => { if (!chat.isStreaming) chat.regenerate(); }}
                      onEditMessage={(idx, text) => { if (!chat.isStreaming) chat.editAndResend(idx, text); }}
                    />
                  ))}
                </Box>
              </ScrollContainer>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <WelcomeScreen onQuickQuestion={handleQuickQuestion} />
              </div>
            )}
          </Box>

          {/* Input Area */}
          <Box
            sx={{
              flexShrink: 0,
              bgcolor: "#212121",
              borderTop: "1px solid rgba(255,255,255,.06)",
              py: { xs: 2, sm: 3 },
            }}
          >
            <Box
              sx={{
                maxWidth: 768,
                mx: "auto",
                px: { xs: 2, sm: 3 },
              }}
            >
              <InputArea
                value={input}
                onChange={setInput}
                onSend={handleSend}
                onStop={handleStop}
                isStreaming={chat.isStreaming}
                pendingFiles={chat.pendingFiles}
                onAddFiles={chat.addFiles}
                onRemoveFile={chat.removeFile}
              />
            </Box>
          </Box>
        </Box>
      </Stack>

      {/* User menu */}
      <Menu
        anchorEl={anchorEl}
        open={!!anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        PaperProps={{ sx: { bgcolor: "#2f2f2f", border: "1px solid rgba(255,255,255,.08)", borderRadius: 2, minWidth: 200, mt: 0.5 } }}
      >
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography sx={{ fontWeight: 600, fontSize: 13, color: "#ececec" }}>{user?.name || "User"}</Typography>
          <Typography sx={{ fontSize: 12, color: "#b4b4b4", mt: 0.25 }}>{user?.email}</Typography>
        </Box>
        <Divider sx={{ bgcolor: "rgba(255,255,255,.06)" }} />
        <MenuItem onClick={handleLogout} sx={{ justifyContent: "center", color: "#f87171", py: 1.25, fontSize: 13 }}>
          Sign out
        </MenuItem>
      </Menu>
    </ThemeProvider>
  );
}
