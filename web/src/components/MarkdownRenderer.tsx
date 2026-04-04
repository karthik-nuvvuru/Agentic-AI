import type { Components } from "react-markdown";
import { Box, Button, Stack, Typography } from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { useState } from "react";

/* ------------------------------------------------------------------ */
/*  Citation badge + popover                                           */
/* ------------------------------------------------------------------ */
interface CitationBadgeProps {
  idx: number;
  onClick: () => void;
}

function CitationBadge({ idx, onClick }: CitationBadgeProps) {
  return (
    <Box
      component="span"
      onClick={onClick}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 18,
        height: 18,
        borderRadius: 1,
        fontSize: "0.55rem",
        fontWeight: 700,
        color: "var(--color-link)",
        bgcolor: "var(--color-citation-bg)",
        border: "1px solid var(--color-citation-border)",
        cursor: "pointer",
        transition: "all 0.15s",
        verticalAlign: "super",
        lineHeight: 1,
        ml: 0.2,
        userSelect: "none",
        "&:hover": {
          bgcolor: "var(--color-citation-hover-bg)",
        },
      }}
    >
      {idx}
    </Box>
  );
}

/* ------------------------------------------------------------------ */
/*  Code block with copy button                                        */
/* ------------------------------------------------------------------ */
interface CodeBlockProps {
  language?: string;
  code: string;
}

function CodeBlock({ language, code }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Box
      sx={{
        my: 1.5,
        borderRadius: 2,
        overflow: "hidden",
        border: "1px solid var(--color-code-border)",
        bgcolor: "var(--color-code-bg)",
      }}
    >
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{
          px: 2,
          py: 0.6,
          borderBottom: "1px solid var(--color-code-border)",
          bgcolor: "var(--color-code-header)",
        }}
      >
        <Typography
          sx={{
            color: "text.disabled",
            fontWeight: 600,
            fontSize: "0.65rem",
            letterSpacing: ".05em",
            textTransform: "uppercase",
          }}
        >
          {language || "code"}
        </Typography>
        <Button
          size="small"
          onClick={handleCopy}
          sx={{
            fontSize: "0.65rem",
            fontWeight: 600,
            textTransform: "none",
            p: 0.2,
            minWidth: "auto",
            color: copied ? "success.main" : "text.disabled",
            "&:hover": { bgcolor: "rgba(128,128,128,.06)" },
          }}
        >
          <ContentCopyIcon sx={{ fontSize: 13, mr: copied ? 0 : 0.4 }} />
          {copied ? "Copied" : "Copy"}
        </Button>
      </Stack>
      <Box
        component="pre"
        sx={{
          m: 0,
          p: 2,
          overflowX: "auto",
          fontSize: ".78rem",
          lineHeight: 1.7,
          fontFamily: "var(--font-mono)",
          color: "var(--color-code-text)",
          "& code": {
            fontFamily: "var(--font-mono)",
            bg: "transparent !important",
            padding: 0,
          },
          "&::-webkit-scrollbar": { height: 3 },
          "&::-webkit-scrollbar-thumb": {
            bgcolor: "rgba(128,128,128,.1)",
            borderRadius: 2,
          },
        }}
      >
        <code className={language ? `language-${language}` : undefined}>{code}</code>
      </Box>
    </Box>
  );
}

/* ------------------------------------------------------------------ */
/*  react-markdown components map                                      */
/* ------------------------------------------------------------------ */
export const mdComponents: Components = {
  p: ({ children, ...props }) => (
    <Typography component="p" sx={{ my: 0.5, lineHeight: 1.75, fontSize: "0.9rem" }} {...(props as any)}>
      {children}
    </Typography>
  ),
  code: ({ className, children, ...props }: any) => {
    const match = /language-(\w+)/.exec(className || "");
    // Only render as standalone block if it's inside a pre
    if (match) {
      return <CodeBlock language={match[1]} code={String(children).replace(/\n$/, "")} />;
    }
    return (
      <Box component="code" sx={{ px: 0.5, py: 0.1, borderRadius: 0.5, fontSize: "0.8em", bgcolor: "var(--color-inline-code-bg)", color: "var(--color-inline-code-text)", fontFamily: "var(--font-mono)" }}>
        {children}
      </Box>
    );
  },
  ul: ({ children, ...props }) => <ul style={{ paddingLeft: "1.5em", marginTop: 4, marginBottom: 4 }} {...(props as any)}>{children}</ul>,
  ol: ({ children, ...props }) => <ol style={{ paddingLeft: "1.5em", marginTop: 4, marginBottom: 4 }} {...(props as any)}>{children}</ol>,
  li: ({ children, ...props }) => <Typography component="li" sx={{ lineHeight: 1.7, fontSize: "0.9rem" }} {...(props as any)}>{children}</Typography>,
  a: ({ href, children }) => (
    <Box component="a" href={href} target="_blank" rel="noopener" sx={{ color: "var(--color-link)", textDecoration: "underline", textUnderlineOffset: 2 }}>
      {children}
    </Box>
  ),
  blockquote: ({ children }) => (
    <Box
      sx={{
        borderLeft: "3px solid var(--color-citation-border)",
        pl: 2,
        py: 0.5,
        my: 1,
        color: "text.secondary",
        "& > *": { color: "inherit" },
      }}
    >
      {children}
    </Box>
  ),
  table: ({ children }) => (
    <Box sx={{ overflowX: "auto", my: 1 }}>
      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "0.85rem" }}>{children}</table>
    </Box>
  ),
  th: ({ children }) => (
    <th style={{ border: "1px solid var(--color-border)", padding: "8px 12px", fontWeight: 600, textAlign: "left" }}>{children}</th>
  ),
  td: ({ children }) => (
    <td style={{ border: "1px solid var(--color-border)", padding: "8px 12px" }}>{children}</td>
  ),
};

/* ------------------------------------------------------------------ */
/*  Citation source list                                               */
/* ------------------------------------------------------------------ */
export const CitationSource = ({ idx, source }: { idx: number; source: string }) => (
  <Box sx={{ px: 1, py: 0.2, borderRadius: 0.5, fontSize: "0.62rem", fontWeight: 600, bgcolor: "rgba(99,102,241,.06)", color: "#818cf8", border: "1px solid rgba(99,102,241,.08)", animation: "chipIn .25s ease-out" }}>
    [{idx}] {source}
  </Box>
);
