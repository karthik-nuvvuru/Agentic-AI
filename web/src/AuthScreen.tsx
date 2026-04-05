import { useState, useCallback, useRef } from "react";
import {
  Alert, Box, Button, CircularProgress, Collapse,
  IconButton, InputAdornment, TextField, Typography,
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

interface AuthScreenProps {
  onSuccess: () => void;
}

type Mode = "login" | "register";

export default function AuthScreen({ onSuccess }: AuthScreenProps) {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim()) { setError("Email is required"); return; }
    if (!password.trim()) { setError("Password is required"); return; }
    if (mode === "register" && password.length < 8) { setError("Password must be at least 8 characters"); return; }
    if (mode === "register" && !name.trim()) { setError("Name is required"); return; }

    setLoading(true);
    try {
      const res = mode === "login"
        ? await apiLogin(email.trim(), password)
        : await apiRegister(email.trim(), password, name.trim());

      sessionStorage.setItem("auth_access_token", res.access_token);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [mode, email, password, name, onSuccess]);

  return (
    <Box className="flex items-center justify-center min-h-screen bg-[#09090b] relative overflow-hidden px-4">
      {/* Subtle background glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[15%] left-[10%] w-[300px] h-[300px] rounded-full bg-[rgba(99,102,241,.08)] blur-[80px] animate-[glow_6s_ease-in-out_infinite]" />
        <div className="absolute bottom-[10%] right-[5%] w-[250px] h-[250px] rounded-full bg-[rgba(139,92,246,.06)] blur-[80px] animate-[glow_6s_ease-in-out_infinite_3s]" />
      </div>

      <Box className="relative z-10 w-full max-w-[420px] animate-[fadeInUp_0.4s_ease-out]">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-[#667eea] to-[#7c3aed] shadow-[0_4px_24px_rgba(99,102,241,.3)] mb-3">
            <AIIcon sx={{ fontSize: 28, color: "#fff" }} />
          </div>
          <Typography
            variant="h5"
            sx={{
              fontWeight: 700, letterSpacing: "-.02em",
              background: "linear-gradient(135deg, #e4e4e7, #a1a1aa)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}
          >
            Agentic AI
          </Typography>
          <Typography variant="body2" sx={{ color: "#71717a", fontSize: ".85rem", mt: 0.5 }}>
            {mode === "login" ? "Welcome back — sign in to continue" : "Create your account to get started"}
          </Typography>
        </div>

        {/* Card */}
        <Box className="bg-[rgba(255,255,255,.025)] border border-[rgba(255,255,255,.06)] rounded-3xl p-6 sm:p-8 backdrop-blur-[12px] shadow-[0_8px_32px_rgba(0,0,0,.3)]">
          {/* Mode toggle */}
          <div className="flex bg-[rgba(255,255,255,.04)] rounded-lg p-0.5 mb-5">
            {(["login", "register"] as Mode[]).map((m) => (
              <Button
                key={m}
                onClick={() => { setMode(m); setError(""); }}
                fullWidth
                disableRipple
                sx={{
                  textTransform: "none", fontWeight: 600, fontSize: ".82rem",
                  borderRadius: 1.5, py: 0.65,
                  color: m === mode ? "#fff" : "#71717a",
                  bgcolor: m === mode ? "rgba(99,102,241,.25)" : "transparent",
                  transition: "all .25s ease-out",
                  "&:hover": { color: "#fff", bgcolor: m === mode ? "rgba(99,102,241,.3)" : "rgba(255,255,255,.03)" },
                  boxShadow: "none",
                }}
              >
                {m === "login" ? "Sign In" : "Sign Up"}
              </Button>
            ))}
          </div>

          {/* Error */}
          <Collapse in={!!error}>
            <Alert
              severity="error"
              variant="filled"
              onClose={() => setError("")}
              sx={{ mb: 3, borderRadius: 2, bgcolor: "rgba(239,68,68,.12)", color: "#fca5a5", border: "1px solid rgba(239,68,68,.15)", boxShadow: "none", "& .MuiAlert-icon": { color: "#f87171" } }}
            >
              {error}
            </Alert>
          </Collapse>

          <form onSubmit={handleSubmit}>
            {/* Name (register only) */}
            <Collapse in={mode === "register"} timeout={250}>
              <TextField
                fullWidth label="Name" placeholder="Your name"
                value={name} onChange={(e) => setName(e.target.value)}
                autoComplete="name" disabled={loading}
                error={!!error && !name}
                InputProps={{
                  startAdornment: <InputAdornment position="start"><PersonIcon sx={{ fontSize: 17, color: "rgba(255,255,255,.25)" }} /></InputAdornment>,
                }}
                sx={{ mb: 2, themeField }}
              />
            </Collapse>

            {/* Email */}
            <TextField
              fullWidth label="Email" type="email" placeholder="you@example.com"
              value={email} onChange={(e) => setEmail(e.target.value)}
              autoComplete="email" disabled={loading}
              error={!!error && !email}
              InputProps={{
                startAdornment: <InputAdornment position="start"><MailIcon sx={{ fontSize: 17, color: "rgba(255,255,255,.25)" }} /></InputAdornment>,
              }}
              sx={{ mb: 2, themeField }}
            />

            {/* Password */}
            <TextField
              fullWidth label="Password"
              type={showPassword ? "text" : "password"}
              placeholder={mode === "login" ? "Enter your password" : "At least 8 characters"}
              value={password} onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              disabled={loading}
              error={!!error && !password}
              InputProps={{
                startAdornment: <InputAdornment position="start"><LockIcon sx={{ fontSize: 17, color: "rgba(255,255,255,.25)" }} /></InputAdornment>,
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPassword(!showPassword)} tabIndex={-1} sx={{ p: 0.5, color: "rgba(255,255,255,.3)" }}>
                      {showPassword ? <VisibilityOff sx={{ fontSize: 17 }} /> : <Visibility sx={{ fontSize: 17 }} />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 2, themeField }}
            />

            {/* Submit */}
            <Button
              fullWidth type="submit" disabled={loading}
              sx={{
                textTransform: "none", fontWeight: 600, fontSize: ".88rem",
                borderRadius: 2, py: 1.3, mb: 3,
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                boxShadow: "0 2px 12px rgba(99,102,241,.3)",
                "&:hover:not(:disabled)": { boxShadow: "0 4px 20px rgba(99,102,241,.4)", transform: "translateY(-1px)" },
                "&:disabled": { background: "linear-gradient(135deg, #4f46e5, #7c3aed)", opacity: 0.7 },
              }}
            >
              {loading ? <CircularProgress size={20} sx={{ color: "#fff" }} /> : mode === "login" ? "Sign In" : "Create Account"}
            </Button>
          </form>

          {/* Divider + Social */}
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1 h-px bg-[rgba(255,255,255,.06)]" />
            <Typography variant="caption" sx={{ color: "text.disabled", fontSize: ".7rem", fontWeight: 500, letterSpacing: ".04em", textTransform: "uppercase" }}>
              Or continue with
            </Typography>
            <div className="flex-1 h-px bg-[rgba(255,255,255,.06)]" />
          </div>

          <div className="flex gap-3">
            <Button
              fullWidth variant="outlined"
              onClick={() => {
                if (import.meta.env.VITE_API_BASE) {
                  window.location.href = `${import.meta.env.VITE_API_BASE}/v1/auth/google/login`;
                } else {
                  window.location.href = `/v1/auth/google/login`;
                }
              }}
              disabled={loading}
              sx={{
                textTransform: "none", fontWeight: 500, fontSize: ".8rem",
                borderRadius: 2, py: 1,
                color: "#d4d4d8", bgcolor: "rgba(255,255,255,.02)",
                borderColor: "rgba(255,255,255,.08)",
                "&:hover:not(:disabled)": { bgcolor: "rgba(255,255,255,.05)", borderColor: "rgba(255,255,255,.15)" },
              }}
            >
              <span className="inline-block mr-2">
                <svg width="16" height="16" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                  <path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.02 24.02 0 0 0 0 21.56l7.98-6.19z" />
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                </svg>
              </span>
              Google
            </Button>
            <Button
              fullWidth variant="outlined"
              onClick={() => {
                if (import.meta.env.VITE_API_BASE) {
                  window.location.href = `${import.meta.env.VITE_API_BASE}/v1/auth/github/login`;
                } else {
                  window.location.href = `/v1/auth/github/login`;
                }
              }}
              disabled={loading}
              sx={{
                textTransform: "none", fontWeight: 500, fontSize: ".8rem",
                borderRadius: 2, py: 1,
                color: "#d4d4d8", bgcolor: "rgba(255,255,255,.02)",
                borderColor: "rgba(255,255,255,.08)",
                "&:hover:not(:disabled)": { bgcolor: "rgba(255,255,255,.05)", borderColor: "rgba(255,255,255,.15)" },
              }}
            >
              <GitHubIcon sx={{ fontSize: 16, mr: 1 }} />
              GitHub
            </Button>
          </div>
        </Box>

        <Typography variant="caption" className="block text-center mt-4 text-zinc-700 text-[.68rem]">
          {mode === "login" ? "Don't have an account? " : "Already have an account? "}
          <Box
            component="span"
            onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
            className="text-[#818cf8] font-semibold cursor-pointer hover:text-[#a5b4fc] transition-colors"
          >
            {mode === "login" ? "Sign up" : "Sign in"}
          </Box>
        </Typography>
      </Box>
    </Box>
  );
}

// Reusable theme field style
const themeField = {
  "& .MuiOutlinedInput-root": {
    borderRadius: 10,
    bgcolor: "rgba(255,255,255,.02)",
    color: "#d4d4d8",
    transition: "all .2s",
    "& fieldset": { borderColor: "rgba(255,255,255,.06)" },
    "&:hover fieldset": { borderColor: "rgba(99,102,241,.2)" },
    "&.Mui-focused fieldset": { borderColor: "#6366f1" },
  },
  "& .MuiInputLabel-root": { color: "#71717a", fontSize: ".85rem" },
  "& .MuiInputLabel-root.Mui-focused": { color: "#818cf8" },
  "& .MuiFormHelperText-root": { fontSize: ".72rem", ml: 0.5 },
};
