import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

/* System-preference aware theme detection */
const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

const theme = createTheme({
  palette: {
    mode: prefersDark ? "dark" : "light",
    primary: { main: "#667eea" },
    background: { default: "var(--color-bg)", paper: "var(--color-surface)" },
    text: { primary: "var(--color-text-primary)", secondary: "var(--color-text-secondary)", disabled: "var(--color-text-disabled)" },
    divider: "var(--color-border)",
    error: { main: "#f87171" },
    success: { main: "#34d399" },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: ["Inter", "system-ui", "Segoe UI", "Roboto", "Arial"].join(","),
  },
  components: {
    MuiButton: { styleOverrides: { root: { textTransform: "none", fontWeight: 500, borderRadius: 8 } } },
    MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
    MuiSkeleton: { styleOverrides: { root: { bgcolor: "rgba(128,128,128,.06)" } } },
    MuiListItemButton: { styleOverrides: { root: { minHeight: 44 } } },
    MuiIconButton: { styleOverrides: { root: { minHeight: 36, minWidth: 36 } } },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </React.StrictMode>
);
