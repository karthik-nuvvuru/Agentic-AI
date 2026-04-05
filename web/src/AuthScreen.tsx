import { useState, useCallback } from "react";
import {
  Alert, Box, Button, CircularProgress, Collapse,
  Divider, IconButton, InputAdornment, TextField, Typography,
} from "@mui/material";
import {
  GitHub as GitHubIcon,
  LockOutlined as LockIcon,
  MailOutline as MailIcon,
  PersonOutline as PersonIcon,
  Visibility,
  VisibilityOff,
  SmartToyOutlined as AIIcon,
} from "@mui/icons-material";
import { apiLogin, apiRegister } from "./services/api";

const inputSx = {
  "& .MuiOutlinedInput-root": {
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,.08)",
    color: "#f4f4f5",
    height: 48,
    "& fieldset": { borderColor: "rgba(255,255,255,.15)", borderWidth: 1 },
    "&:hover fieldset": { borderColor: "rgba(255,255,255,.25)" },
    "&.Mui-focused fieldset": { borderColor: "#818cf8", borderWidth: 1.5 },
    "& input::placeholder": { color: "rgba(255,255,255,.4)" },
  },
  "& .MuiInputLabel-root": { color: "#a1a1aa" },
  "& .MuiInputLabel-root.Mui-focused": { color: "#a78bfa" },
  "& .MuiFormHelperText-root": { color: "#f87171" },
};

interface AuthScreenProps { onSuccess: () => Promise<void> | void }
type Mode = "login" | "register";

export default function AuthScreen({ onSuccess }: AuthScreenProps) {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const submit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim()) { setError("Email is required"); return; }
    if (!password.trim()) { setError("Password is required"); return; }
    if (mode === "register" && password.length < 8) { setError("Minimum 8 characters"); return; }
    if (mode === "register" && !name.trim()) { setError("Name is required"); return; }
    setLoading(true);
    try {
      const res = mode === "login"
        ? await apiLogin(email.trim(), password)
        : await apiRegister(email.trim(), password, name.trim());
      localStorage.setItem("auth_access_token", res.access_token);
      await onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [mode, email, password, name, onSuccess]);

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      minHeight: "100vh", background: "#0f0f23", position: "relative", overflow: "hidden",
    }}>
      {/* Background gradient orbs */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
        <div style={{
          position: "absolute", top: "-10%", left: "10%", width: 500, height: 500,
          borderRadius: "50%", background: "radial-gradient(circle, rgba(99,102,241,.15) 0%, transparent 70%)",
          filter: "blur(60px)", animation: "glow 8s ease-in-out infinite",
        }} />
        <div style={{
          position: "absolute", bottom: "-15%", right: "5%", width: 400, height: 400,
          borderRadius: "50%", background: "radial-gradient(circle, rgba(168,85,247,.12) 0%, transparent 70%)",
          filter: "blur(60px)", animation: "glow 8s ease-in-out 4s infinite",
        }} />
      </div>

      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 400, padding: "0 16px" }}>
        {/* Logo area */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 56, height: 56, borderRadius: 16, marginBottom: 16,
            background: "linear-gradient(135deg, #667eea 0%, #7c3aed 100%)",
            boxShadow: "0 4px 24px rgba(99,102,241,.35)",
          }}>
            <AIIcon sx={{ fontSize: 28, color: "#fff" }} />
          </div>
          <Typography sx={{
            fontWeight: 800, fontSize: 28, letterSpacing: "-.03em",
            background: "linear-gradient(135deg, #e2e8f0, #a78bfa)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>
            Agentic AI
          </Typography>
          <Typography sx={{ color: "#71717a", fontSize: 14, marginTop: 0.5 }}>
            {mode === "login" ? "Welcome back — sign in to continue" : "Create your account to get started"}
          </Typography>
        </div>

        {/* Card */}
        <Box sx={{
          bgcolor: "#16162a",
          border: "1px solid rgba(99,102,241,.2)",
          borderRadius: 4, p: { xs: 3, sm: 4 },
          boxShadow: "0 20px 60px rgba(0,0,0,.5), 0 0 40px rgba(99,102,241,.05)",
        }}>
          {/* Mode toggle pills */}
          <Box sx={{
            display: "flex", bgcolor: "rgba(0,0,0,.3)", borderRadius: 2, p: 0.5, mb: 4,
          }}>
            {(["login", "register"] as Mode[]).map((m) => (
              <Button key={m} onClick={() => { setMode(m); setError(""); }} fullWidth disableRipple sx={{
                textTransform: "none", fontWeight: 600, fontSize: 13, borderRadius: 1.5, py: 0.6,
                color: m === mode ? "#fff" : "#a1a1aa",
                bgcolor: m === mode ? "rgba(99,102,241,.3)" : "transparent",
                "&:hover": { bgcolor: m === mode ? "rgba(99,102,241,.35)" : "rgba(255,255,255,.04)" },
              }}>
                {m === "login" ? "Sign In" : "Sign Up"}
              </Button>
            ))}
          </Box>

          {/* Error alert */}
          <Collapse in={!!error}>
            <Alert severity="error" variant="filled" onClose={() => setError("")} sx={{
              mb: 3, borderRadius: 2, bgcolor: "rgba(239,68,68,.15)", color: "#fca5a5",
              border: "1px solid rgba(239,68,68,.2)",
            }}>{error}</Alert>
          </Collapse>

          <form onSubmit={submit}>
            <Collapse in={mode === "register"} timeout={300}>
              <TextField fullWidth label="Name" placeholder="Your full name" value={name}
                onChange={(e) => setName(e.target.value)} disabled={loading}
                sx={{ mb: 2.5, ...inputSx }}
                InputProps={{ startAdornment: (
                  <InputAdornment position="start"><PersonIcon sx={{ fontSize: 18, color: "#71717a" }} /></InputAdornment>
                )}}
              />
            </Collapse>

            <TextField fullWidth label="Email" type="email" placeholder="you@example.com" value={email}
              onChange={(e) => setEmail(e.target.value)} disabled={loading}
              sx={{ mb: 2.5, ...inputSx }}
              InputProps={{ startAdornment: (
                <InputAdornment position="start"><MailIcon sx={{ fontSize: 18, color: "#71717a" }} /></InputAdornment>
              )}}
            />

            <TextField fullWidth label="Password" type={showPw ? "text" : "password"}
              placeholder={mode === "login" ? "Enter your password" : "At least 8 characters"}
              value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading}
              sx={{ mb: 3, ...inputSx }}
              InputProps={{
                startAdornment: <InputAdornment position="start"><LockIcon sx={{ fontSize: 18, color: "#71717a" }} /></InputAdornment>,
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPw(!showPw)} tabIndex={-1}
                      sx={{ p: 0.5, color: "#a1a1aa" }}>
                      {showPw ? <VisibilityOff sx={{ fontSize: 18 }} /> : <Visibility sx={{ fontSize: 18 }} />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <Button fullWidth type="submit" disabled={loading} sx={{
              textTransform: "none", fontWeight: 700, fontSize: 15, borderRadius: 2, py: 1.5, mb: 3,
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              color: "#fff",
              "&:hover:not(:disabled)": { background: "linear-gradient(135deg, #4f46e5, #7c3aed)" },
              "&:disabled": { opacity: 0.5 },
            }}>
              {loading ? <CircularProgress size={20} sx={{ color: "#fff" }} /> : mode === "login" ? "Sign In" : "Create Account"}
            </Button>
          </form>

          {/* Divider */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,.1)" }} />
            <Typography sx={{ color: "#71717a", fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: ".08em" }}>
              or continue with
            </Typography>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,.1)" }} />
          </Box>

          {/* Social buttons */}
          <Box sx={{ display: "flex", gap: 2 }}>
            <Button fullWidth variant="outlined" onClick={() => {
              window.location.href = `${import.meta.env.VITE_API_BASE || ""}/v1/auth/google/login`;
            }} disabled={loading} sx={{
              textTransform: "none", fontWeight: 500, fontSize: 13, borderRadius: 2, py: 1,
              color: "#d4d4d8", bgcolor: "rgba(255,255,255,.06)",
              borderColor: "rgba(255,255,255,.12)",
              "&:hover:not(:disabled)": { bgcolor: "rgba(255,255,255,.1)", borderColor: "rgba(255,255,255,.2)" },
            }}>
              <Box sx={{ mr: 1 }}>
                <svg width="16" height="16" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                  <path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.02 24.02 0 0 0 0 21.56l7.98-6.19z" />
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                </svg>
              </Box>
              Google
            </Button>
            <Button fullWidth variant="outlined" onClick={() => {
              window.location.href = `${import.meta.env.VITE_API_BASE || ""}/v1/auth/github/login`;
            }} disabled={loading} sx={{
              textTransform: "none", fontWeight: 500, fontSize: 13, borderRadius: 2, py: 1,
              color: "#d4d4d8", bgcolor: "rgba(255,255,255,.06)",
              borderColor: "rgba(255,255,255,.12)",
              "&:hover:not(:disabled)": { bgcolor: "rgba(255,255,255,.1)", borderColor: "rgba(255,255,255,.2)" },
            }}>
              <GitHubIcon sx={{ fontSize: 16, mr: 1 }} />
              GitHub
            </Button>
          </Box>
        </Box>

        {/* Footer */}
        <div style={{ textAlign: "center", marginTop: 24 }}>
          <Typography sx={{ fontSize: 13, color: "#52525b" }}>
            {mode === "login" ? "Don't have an account? " : "Already have an account? "}
            <Box component="span" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
              sx={{ color: "#818cf8", fontWeight: 600, cursor: "pointer", "&:hover": { color: "#a5b4fc" } }}>
              {mode === "login" ? "Sign up" : "Sign in"}
            </Box>
          </Typography>
        </div>
      </div>
    </div>
  );
}
