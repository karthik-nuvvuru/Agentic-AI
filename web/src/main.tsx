import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";

const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

const darkPalette = {
  primary: { main: "#667eea" },
  background: { default: "#09090b", paper: "rgba(255,255,255,.04)" },
  text: { primary: "#e4e4e7", secondary: "#a1a1aa" },
  divider: "rgba(255,255,255,.08)",
  error: { main: "#f87171" },
  success: { main: "#34d399" },
};

const lightPalette = {
  primary: { main: "#667eea" },
  background: { default: "#f8f9fa", paper: "#ffffff" },
  text: { primary: "#1a1a2e", secondary: "#4a4a68" },
  divider: "#e0e0e8",
  error: { main: "#dc2626" },
  success: { main: "#16a34a" },
};

const theme = createTheme({
  palette: { mode: prefersDark ? "dark" : "light", ...(prefersDark ? darkPalette : lightPalette) },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: ["Inter", "system-ui", "Segoe UI", "Roboto", "Arial"].join(","),
  },
  components: {
    MuiButton: { styleOverrides: { root: { textTransform: "none", fontWeight: 500, borderRadius: 8 } } },
    MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
    MuiSkeleton: { styleOverrides: { root: { bgcolor: prefersDark ? "rgba(128,128,128,.06)" : "rgba(0,0,0,.06)" } } },
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
