import GitHubIcon from "@mui/icons-material/GitHub";
import LockOutlineIcon from "@mui/icons-material/LockOutline";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import {
  Alert,
  Box,
  Button,
  Collapse,
  CircularProgress,
  Divider,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
} from "@mui/material";
import { useState, useCallback, useRef, useEffect } from "react";
import { setTokens } from "./auth";

const API = import.meta.env.VITE_API_BASE || "";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface AuthProps {
  onSuccess: (tokens: { access_token: string; refresh_token: string; user: unknown }) => void;
}

type Mode = "login" | "signup";

interface ValidationErrors {
  email?: string;
  password?: string;
  name?: string;
  general?: string;
}

interface FormState {
  email: string;
  password: string;
  name: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function validateEmail(email: string): string | undefined {
  if (!email.trim()) return "Email is required";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Enter a valid email address";
  return;
}

function validatePassword(password: string, mode: Mode): string | undefined {
  if (!password) return "Password is required";
  if (mode === "signup" && password.length < 8) return "Must be at least 8 characters";
  return;
}

function validateName(name: string): string | undefined {
  if (!name.trim()) return "Name is required";
  return;
}

/* ------------------------------------------------------------------ */
/*  Google icon component                                              */
/* ------------------------------------------------------------------ */

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.02 24.02 0 0 0 0 21.56l7.98-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Animated background particles (pure CSS)                           */
/* ------------------------------------------------------------------ */

function BackgroundGlow() {
  return (
    <Box sx={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      <Box
        sx={{
          position: "absolute",
          top: "20%",
          left: "15%",
          width: 300,
          height: 300,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(99,102,241,.12) 0%, transparent 70%)",
          filter: "blur(40px)",
          animation: "glow 6s ease-in-out infinite",
        }}
      />
      <Box
        sx={{
          position: "absolute",
          bottom: "15%",
          right: "10%",
          width: 250,
          height: 250,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(139,92,246,.1) 0%, transparent 70%)",
          filter: "blur(40px)",
          animation: "glow 6s ease-in-out infinite 3s",
        }}
      />
    </Box>
  );
}

/* ------------------------------------------------------------------ */
/*  Auth Screen                                                        */
/* ------------------------------------------------------------------ */

export default function AuthScreen({ onSuccess }: AuthProps) {
  const [mode, setMode] = useState<Mode>("login");
  const [form, setForm] = useState<FormState>({ email: "", password: "", name: "" });
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [socialLoading, setSocialLoading] = useState<"google" | "github" | null>(null);

  const formRef = useRef<HTMLFormElement>(null);
  const animFrameRef = useRef(0);
  const [fadeKey, setFadeKey] = useState(0);

  const handleChange = useCallback(
    (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setForm((prev) => ({ ...prev, [field]: value }));
      setErrors((prev) => ({ ...prev, [field]: undefined, general: undefined }));
    },
    []
  );

  const switchMode = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    setMode((prev) => (prev === "login" ? "signup" : "login"));
    setErrors({});
    setFadeKey((k) => k + 1);
    animFrameRef.current = requestAnimationFrame(() => {
      // focus first field after transition
      const firstInput = formRef.current?.querySelector("input:not([type='password'])") as HTMLInputElement | null;
      firstInput?.focus();
    });
  }, []);

  useEffect(() => {
    return () => cancelAnimationFrame(animFrameRef.current);
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      const emailError = validateEmail(form.email);
      const passwordError = validatePassword(form.password, mode);
      const nameError = mode === "signup" ? validateName(form.name) : undefined;

      if (emailError || passwordError || nameError) {
        setErrors({ email: emailError, password: passwordError, name: nameError });
        return;
      }

      setLoading(true);
      setErrors({});

      try {
        const endpoint = mode === "login" ? "/v1/auth/login" : "/v1/auth/register";
        const body: Record<string, string> = { email: form.email.trim(), password: form.password };
        if (mode === "signup") body.name = form.name.trim();

        const res = await fetch(`${API}${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          setErrors({ general: errData?.detail || errData?.message || `HTTP ${res.status} — authentication failed` });
          setLoading(false);
          return;
        }

        const data = await res.json();
        setTokens(data.access_token, data.refresh_token);
        onSuccess({ access_token: data.access_token, refresh_token: data.refresh_token, user: data.user });
      } catch {
        setErrors({ general: "Network error. Please try again." });
      } finally {
        setLoading(false);
      }
    },
    [form, mode, onSuccess]
  );

  const handleSocialLogin = useCallback(
    async (provider: "google" | "github") => {
      setSocialLoading(provider);
      setErrors({});
      try {
        const res = await fetch(`${API}/v1/auth/${provider}/login`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.authorization_url) {
          window.location.href = data.authorization_url;
        } else {
          setErrors({ general: `Could not start ${provider} authentication` });
        }
      } catch {
        setErrors({ general: `Failed to connect to ${provider}. Please try again.` });
      } finally {
        setSocialLoading(null);
      }
    },
    []
  );

  const primaryLabel = mode === "login" ? "Sign In" : "Create Account";

  return (
    <Box
      sx={{
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "#09090b",
        position: "relative",
        animation: "fadeIn .5s ease-out",
        px: 2,
      }}
    >
      <BackgroundGlow />

      <Box
        sx={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          maxWidth: 420,
          animation: "fadeInUp .5s ease-out",
        }}
      >
        {/* Logo */}
        <Box sx={{ textAlign: "center", mb: 4 }}>
          <Box
            sx={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 56,
              height: 56,
              borderRadius: "16px",
              backgroundImage: "linear-gradient(135deg,#6366f1,#8b5cf6)",
              boxShadow: "0 4px 24px rgba(99,102,241,.3)",
              mb: 2,
            }}
          >
            <SmartToyIcon sx={{ fontSize: 28, color: "#fff" }} />
          </Box>
          <Typography
            variant="h5"
            sx={{
              fontWeight: 700,
              letterSpacing: "-.02em",
              background: "linear-gradient(135deg,#e4e4e7,#a1a1aa)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Agentic AI
          </Typography>
          <Typography variant="body2" sx={{ color: "#71717a", fontSize: ".85rem", mt: 0.5 }}>
            {mode === "login" ? "Welcome back — sign in to continue" : "Create your account to get started"}
          </Typography>
        </Box>

        {/* Card */}
        <Box
          sx={{
            bgcolor: "rgba(255,255,255,.025)",
            border: "1px solid rgba(255,255,255,.06)",
            borderRadius: 3,
            p: { xs: 3, sm: 4 },
            backdropFilter: "blur(12px)",
            boxShadow: "0 8px 32px rgba(0,0,0,.3)",
          }}
        >
          {/* Mode toggle */}
          <Box
            sx={{
              display: "flex",
              bgcolor: "rgba(255,255,255,.04)",
              borderRadius: 2,
              p: "3px",
              mb: 3,
            }}
          >
            {(["login", "signup"] as Mode[]).map((m) => {
              const active = m === mode;
              return (
                <Button
                  key={m}
                  onClick={switchMode}
                  fullWidth
                  size="small"
                  disableRipple
                  sx={{
                    textTransform: "none",
                    fontWeight: 600,
                    fontSize: ".82rem",
                    borderRadius: 1.5,
                    py: 0.75,
                    color: active ? "#fff" : "#71717a",
                    bgcolor: active ? "rgba(99,102,241,.2)" : "transparent",
                    transition: "all .25s ease-out",
                    "&:hover": { color: active ? "#fff" : "#a1a1aa", bgcolor: active ? "rgba(99,102,241,.25)" : "rgba(255,255,255,.02)" },
                  }}
                >
                  {m === "login" ? "Sign In" : "Sign Up"}
                </Button>
              );
            })}
          </Box>

          {/* Error alert */}
          <Collapse in={!!errors.general}>
            <Alert
              severity="error"
              variant="filled"
              sx={{
                mb: 2,
                borderRadius: 2,
                bgcolor: "rgba(239,68,68,.1)",
                color: "#fca5a5",
                border: "1px solid rgba(239,68,68,.15)",
                fontFamily: "inherit",
                boxShadow: "none",
                "& .MuiAlert-icon": { color: "#f87171" },
              }}
              onClose={() => setErrors((p) => ({ ...p, general: undefined }))}
            >
              {errors.general}
            </Alert>
          </Collapse>

          {/* Form */}
          <form ref={formRef} onSubmit={handleSubmit}>
            {/* Name (signup only) */}
            <Collapse in={mode === "signup"} timeout={300}>
              <TextField
                key={`name-${fadeKey}`}
                fullWidth
                label="Name"
                placeholder="Your full name"
                value={form.name}
                onChange={handleChange("name")}
                error={!!errors.name}
                helperText={errors.name}
                disabled={loading}
                autoComplete="name"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PersonOutlineIcon sx={{ fontSize: 18, color: "text.disabled" }} />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  mb: 2,
                  "& .MuiOutlinedInput-root": {
                    borderRadius: 2,
                    bgcolor: "rgba(255,255,255,.02)",
                    color: "#d4d4d8",
                    transition: "all .2s",
                    "& fieldset": { borderColor: "rgba(255,255,255,.06)", transition: "border-color .2s" },
                    "&:hover fieldset": { borderColor: "rgba(99,102,241,.25)" },
                    "&.Mui-focused fieldset": { borderColor: "#6366f1", borderWidth: 1 },
                    "&.Mui-error fieldset": { borderColor: "rgba(239,68,68,.3)" },
                  },
                  "& .MuiInputLabel-root": { color: "#71717a", fontSize: ".85rem" },
                  "& .MuiInputLabel-root.Mui-focused": { color: "#818cf8" },
                  "& .MuiFormHelperText-root": { fontSize: ".72rem", ml: 0.5 },
                }}
              />
            </Collapse>

            {/* Email */}
            <TextField
              fullWidth
              label="Email"
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={handleChange("email")}
              error={!!errors.email}
              helperText={errors.email}
              disabled={loading}
              autoComplete="email"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <MailOutlineIcon sx={{ fontSize: 18, color: "text.disabled" }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                mb: 2,
                "& .MuiOutlinedInput-root": {
                  borderRadius: 2,
                  bgcolor: "rgba(255,255,255,.02)",
                  color: "#d4d4d8",
                  transition: "all .2s",
                  "& fieldset": { borderColor: "rgba(255,255,255,.06)", transition: "border-color .2s" },
                  "&:hover fieldset": { borderColor: "rgba(99,102,241,.25)" },
                  "&.Mui-focused fieldset": { borderColor: "#6366f1", borderWidth: 1 },
                  "&.Mui-error fieldset": { borderColor: "rgba(239,68,68,.3)" },
                },
                "& .MuiInputLabel-root": { color: "#71717a", fontSize: ".85rem" },
                "& .MuiInputLabel-root.Mui-focused": { color: "#818cf8" },
                "& .MuiFormHelperText-root": { fontSize: ".72rem", ml: 0.5 },
              }}
            />

            {/* Password */}
            <TextField
              fullWidth
              label="Password"
              type={showPassword ? "text" : "password"}
              placeholder={mode === "login" ? "Enter your password" : "At least 8 characters"}
              value={form.password}
              onChange={handleChange("password")}
              error={!!errors.password}
              helperText={errors.password}
              disabled={loading}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockOutlineIcon sx={{ fontSize: 18, color: "text.disabled" }} />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword((p) => !p)}
                      edge="end"
                      size="small"
                      sx={{ p: 0.5, color: "text.disabled", "&:hover": { color: "text.secondary" } }}
                      tabIndex={-1}
                    >
                      {showPassword ? <VisibilityOff sx={{ fontSize: 18 }} /> : <Visibility sx={{ fontSize: 18 }} />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{
                mb: 1.5,
                "& .MuiOutlinedInput-root": {
                  borderRadius: 2,
                  bgcolor: "rgba(255,255,255,.02)",
                  color: "#d4d4d8",
                  transition: "all .2s",
                  "& fieldset": { borderColor: "rgba(255,255,255,.06)", transition: "border-color .2s" },
                  "&:hover fieldset": { borderColor: "rgba(99,102,241,.25)" },
                  "&.Mui-focused fieldset": { borderColor: "#6366f1", borderWidth: 1 },
                  "&.Mui-error fieldset": { borderColor: "rgba(239,68,68,.3)" },
                },
                "& .MuiInputLabel-root": { color: "#71717a", fontSize: ".85rem" },
                "& .MuiInputLabel-root.Mui-focused": { color: "#818cf8" },
                "& .MuiFormHelperText-root": { fontSize: ".72rem", ml: 0.5 },
              }}
            />

            {/* Forgot password (login only) */}
            {mode === "login" && (
              <Box sx={{ textAlign: "right", mb: 2.5 }}>
                <Button
                  size="small"
                  onClick={() => setErrors({ general: "Forgot password is not yet implemented" })}
                  sx={{
                    textTransform: "none",
                    fontSize: ".75rem",
                    fontWeight: 500,
                    color: "#818cf8",
                    p: 0,
                    minWidth: "auto",
                    "&:hover": { color: "#a5b4fc" },
                  }}
                >
                  Forgot password?
                </Button>
              </Box>
            )}

            {/* Submit button */}
            <Button
              fullWidth
              type="submit"
              disabled={loading}
              sx={{
                textTransform: "none",
                fontWeight: 600,
                fontSize: ".88rem",
                borderRadius: 2,
                py: 1.3,
                mb: 2.5,
                backgroundImage: "linear-gradient(135deg,#6366f1,#8b5cf6)",
                boxShadow: "0 2px 12px rgba(99,102,241,.3)",
                transition: "all .2s",
                "&:hover": {
                  boxShadow: "0 4px 20px rgba(99,102,241,.4)",
                  transform: "translateY(-1px)",
                },
                "&:active": { transform: "translateY(0)" },
                "&:disabled": {
                  backgroundImage: "linear-gradient(135deg,#4f46e5,#7c3aed)",
                  opacity: 0.7,
                  boxShadow: "none",
                },
              }}
            >
              {loading ? <CircularProgress size={20} sx={{ color: "#fff" }} /> : primaryLabel}
            </Button>
          </form>

          {/* Divider */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2.5 }}>
            <Box sx={{ flex: 1, height: 1, bgcolor: "rgba(255,255,255,.06)" }} />
            <Typography variant="caption" sx={{ color: "text.disabled", fontSize: ".7rem", fontWeight: 500, letterSpacing: ".04em", textTransform: "uppercase" }}>
              Or continue with
            </Typography>
            <Box sx={{ flex: 1, height: 1, bgcolor: "rgba(255,255,255,.06)" }} />
          </Box>

          {/* Social buttons */}
          <Box sx={{ display: "flex", gap: 1.5 }}>
            <Button
              fullWidth
              variant="outlined"
              onClick={() => handleSocialLogin("google")}
              disabled={socialLoading !== null || loading}
              startIcon={<GoogleIcon />}
              sx={{
                textTransform: "none",
                fontWeight: 500,
                fontSize: ".8rem",
                borderRadius: 2,
                py: 1.1,
                color: "#d4d4d8",
                bgcolor: "rgba(255,255,255,.02)",
                borderColor: "rgba(255,255,255,.08)",
                transition: "all .2s",
                "&:hover": { bgcolor: "rgba(255,255,255,.05)", borderColor: "rgba(255,255,255,.15)", color: "#fff" },
                "&:disabled": { color: "#3f3f46", borderColor: "rgba(255,255,255,.04)" },
              }}
            >
              Google
            </Button>
            <Button
              fullWidth
              variant="outlined"
              onClick={() => handleSocialLogin("github")}
              disabled={socialLoading !== null || loading}
              startIcon={<GitHubIcon sx={{ fontSize: 18 }} />}
              sx={{
                textTransform: "none",
                fontWeight: 500,
                fontSize: ".8rem",
                borderRadius: 2,
                py: 1.1,
                color: "#d4d4d8",
                bgcolor: "rgba(255,255,255,.02)",
                borderColor: "rgba(255,255,255,.08)",
                transition: "all .2s",
                "&:hover": { bgcolor: "rgba(255,255,255,.05)", borderColor: "rgba(255,255,255,.15)", color: "#fff" },
                "&:disabled": { color: "#3f3f46", borderColor: "rgba(255,255,255,.04)" },
              }}
            >
              GitHub
            </Button>
          </Box>

          {/* Footer text */}
          <Typography
            variant="caption"
            sx={{
              display: "block",
              textAlign: "center",
              mt: 2.5,
              color: "#52525b",
              fontSize: ".72rem",
            }}
          >
            {mode === "login"
              ? "Don't have an account? "
              : "Already have an account? "}
            <Box
              component="span"
              onClick={switchMode}
              sx={{
                color: "#818cf8",
                fontWeight: 600,
                cursor: "pointer",
                transition: "color .15s",
                "&:hover": { color: "#a5b4fc" },
              }}
            >
              {mode === "login" ? "Sign up" : "Sign in"}
            </Box>
          </Typography>
        </Box>

        {/* Bottom tagline */}
        <Typography
          variant="caption"
          sx={{
            display: "block",
            textAlign: "center",
            mt: 3,
            color: "#3f3f46",
            fontSize: ".68rem",
            letterSpacing: ".02em",
          }}
        >
          Secure authentication powered by JWT
        </Typography>
      </Box>
    </Box>
  );
}
