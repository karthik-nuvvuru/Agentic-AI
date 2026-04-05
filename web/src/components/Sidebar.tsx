import {
  Box,
  Button,
  IconButton,
  ListItemButton,
  ListItemText,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditIcon from "@mui/icons-material/Edit";
import SearchIcon from "@mui/icons-material/Search";
import { useCallback, useMemo, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
type Conv = { id: string; title: string; updated_at?: string };

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function timeAgo(iso?: string): number {
  if (!iso) return Infinity;
  const age = Date.now() - new Date(iso).getTime();
  return age;
}

function timeGroup(iso?: string): number {
  const ms = iso ? Date.now() - new Date(iso).getTime() : Infinity;
  const day = 86400000;
  if (ms < day) return 0;
  if (ms < 2 * day) return 1;
  if (ms < 7 * day) return 2;
  return 3;
}

const GROUP_LABELS = ["Today", "Yesterday", "Last 7 days", "Older"];

/* ------------------------------------------------------------------ */
/*  One conversation row                                               */
/* ------------------------------------------------------------------ */
function ConvRow({
  conv,
  active,
  onSelect,
  onDelete,
}: {
  conv: Conv;
  active: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(conv.title);
  const [confirmDel, setConfirmDel] = useState(false);

  const commit = useCallback(() => {
    setEditing(false);
    if (title.trim() && title !== conv.title) {
      /* TODO: fire PUT /v1/conversations/{id}/title */
    }
  }, [title, conv.title]);

  return (
    <ListItemButton
      dense
      onClick={() => {
        if (!editing) onSelect(conv.id);
      }}
      selected={active}
      sx={{
        borderRadius: 1.5,
        mx: 0.5,
        my: 0.1,
        py: 0.6,
        transition: "all 0.15s",
        bgcolor: active ? "var(--color-active-bg)" : "transparent",
        "&:hover": { bgcolor: "var(--color-hover-bg)" },
        pr: editing ? 1 : 2,
        minHeight: 44,
      }}
    >
      {editing ? (
        <TextField
          autoFocus
          size="small"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setTitle(conv.title);
              setEditing(false);
            }
          }}
          sx={{
            "& .MuiOutlinedInput-root": {
              fontSize: "0.72rem",
              padding: "2px 8px",
              color: "text.primary",
              backgroundColor: "var(--color-bg-elevated)",
              "& fieldset": { borderColor: "transparent" },
            },
            input: { fontFamily: "var(--font-sans)" },
          }}
          fullWidth
        />
      ) : (
        <>
          <ListItemText
            primary={title}
            primaryTypographyProps={{
              noWrap: true,
              sx: {
                fontSize: "0.78rem",
                letterSpacing: "-0.01em",
                color: active ? "var(--color-active-text)" : "text.primary",
                fontWeight: active ? 500 : 400,
              },
            }}
          />
          <Box sx={{ display: "flex", gap: 0, flexShrink: 0, ml: 0.5 }}>
            {confirmDel ? (
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(conv.id);
                  setConfirmDel(false);
                }}
                sx={{ p: 0.3, color: "#f87171", minWidth: 28, height: 28 }}
              >
                ✓
              </IconButton>
            ) : (
              <>
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditing(true);
                  }}
                  sx={{ p: 0.3, color: "text.disabled", opacity: active ? 0.7 : 0, transition: "opacity 0.15s", minWidth: 28, height: 28 }}
                >
                  <EditIcon sx={{ fontSize: 13 }} />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmDel(true);
                  }}
                  sx={{ p: 0.3, color: "text.disabled", opacity: active ? 0.7 : 0, transition: "opacity 0.15s", minWidth: 28, height: 28 }}
                >
                  <DeleteOutlineIcon sx={{ fontSize: 13 }} />
                </IconButton>
              </>
            )}
          </Box>
        </>
      )}
    </ListItemButton>
  );
}

/* ------------------------------------------------------------------ */
/*  Sidebar                                                            */
/* ------------------------------------------------------------------ */
export function Sidebar({
  convs,
  convId,
  onNew,
  onSelect,
  onDelete,
}: {
  convs: Conv[];
  convId: string | null;
  onNew: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(
    () => (search ? convs.filter((c) => c.title.toLowerCase().includes(search.toLowerCase())) : convs),
    [convs, search]
  );

  const groups = useMemo(() => {
    const g: Conv[][] = [[], [], [], []];
    for (const c of filtered) g[timeGroup(c.updated_at)].push(c);
    return g.filter((a) => a.length);
  }, [filtered]);

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* New chat */}
      <Box sx={{ p: 1.5 }}>
        <Button
          fullWidth
          variant="outlined"
          startIcon={<AddIcon sx={{ fontSize: 17 }} />}
          onClick={onNew}
          sx={{
            textTransform: "none",
            fontWeight: 600,
            borderRadius: 2,
            py: 0.85,
            fontSize: "0.8rem",
            minHeight: 44,
            bgcolor: "var(--color-btn-bg)",
            color: "text.primary",
            borderColor: "var(--color-btn-border)",
            transition: "all 0.15s",
            "&:hover": {
              bgcolor: "var(--color-btn-bg-hover)",
              color: "text.primary",
              borderColor: "var(--color-btn-border-hover)",
            },
          }}
        >
          New Chat
        </Button>
      </Box>

      <Box sx={{ height: 1, mx: 1.5, mb: 0.5, bgcolor: "var(--color-border)" }} />

      {/* Search */}
      <Box sx={{ px: 1.5, py: 0.5 }}>
        <TextField
          size="small"
          placeholder="Search conversations…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: <SearchIcon sx={{ fontSize: 14, color: "text.disabled", mr: 0.5 }} />,
          }}
          sx={{
            "& .MuiOutlinedInput-root": {
              fontSize: "0.75rem",
              borderRadius: 2,
              bgcolor: "var(--color-search-bg)",
              minHeight: 36,
              "& fieldset": { borderColor: "transparent" },
              "&:hover fieldset": { borderColor: "var(--color-border)" },
              "&.Mui-focused fieldset": { borderColor: "var(--color-border-focus)" },
            },
          }}
          fullWidth
        />
      </Box>

      <Box sx={{ height: 1, mx: 1.5, my: 0.5, bgcolor: "var(--color-border)" }} />

      {/* Grouped list */}
      <Box sx={{ flex: 1, overflowY: "auto" }}>
        {groups.length === 0 && (
          <Box sx={{ display: "flex", justifyContent: "center", mt: 8, opacity: 0.3, px: 3 }}>
            <Typography sx={{ fontSize: "0.78rem", color: "text.disabled", textAlign: "center" }}>
              {search ? "No matching conversations" : "No conversations yet"}
            </Typography>
          </Box>
        )}

        {groups.map((items, gi) => (
          <Box key={gi} sx={{ mb: 0.5 }}>
            <Typography sx={{ px: 2, py: 0.5, color: "text.disabled", fontWeight: 600, fontSize: "0.58rem", letterSpacing: ".06em", textTransform: "uppercase" }}>
              {GROUP_LABELS[gi]}
            </Typography>
            {items.map((c) => (
              <ConvRow
                key={c.id}
                conv={c}
                active={c.id === convId}
                onSelect={onSelect}
                onDelete={onDelete}
              />
            ))}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
