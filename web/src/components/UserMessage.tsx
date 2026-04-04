import { Box } from "@mui/material";

type CM = { content: string; files?: string[] };

export default function UserMessage({ m }: { m: CM }) {
  return (
    <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 5 }}>
      <Box sx={{ maxWidth: "70%", minWidth: 0 }}>
        {m.files?.map((f, i) => (
          <Box
            key={i}
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.5,
              px: 1,
              py: 0.3,
              borderRadius: 1,
              mr: 1,
              mb: 0.75,
              bgcolor: "var(--color-chip-bg)",
              border: "1px solid var(--color-chip-border)",
              fontSize: "0.62rem",
              fontWeight: 500,
              color: "text.secondary",
            }}
          >
            {f}
          </Box>
        ))}
        <Box
          sx={{
            px: 3,
            py: 1.8,
            borderRadius: "18px 4px 18px 18px",
            backgroundImage: "var(--gradient-user-bubble)",
            color: "#fff",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            lineHeight: 1.6,
            fontSize: "0.9rem",
            boxShadow: "var(--shadow-user-bubble)",
            letterSpacing: "-0.01em",
          }}
        >
          {m.content}
        </Box>
      </Box>
    </Box>
  );
}
