import {
  Box,
  Button,
  IconButton,
  ListItemButton,
  ListItemText,
  TextField,
  Typography,
  SwipeableDrawer,
} from "@mui/material";
import {
  Add as AddIcon,
  DeleteOutline as DeleteOutlineIcon,
  Edit as EditIcon,
  Search as SearchIcon,
  Close,
} from "@mui/icons-material";
import { useCallback, useMemo, useState, useEffect } from "react";
import { apiUpdateConversationTitle } from "../services/api";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
type Conv = { id: string; title: string; updated_at?: string };

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
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
  onRename,
}: {
  conv: Conv;
  active: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(conv.title);
  const [confirmDel, setConfirmDel] = useState(false);

  const commit = useCallback(async () => {
    setEditing(false);
    if (title.trim() && title !== conv.title) {
      try {
        await apiUpdateConversationTitle(conv.id, title.trim());
        onRename(conv.id, title.trim());
      } catch { /* silent */ }
    }
  }, [title, conv.title, conv.id, onRename]);

  return (
    <div
      className={`group/conv px-2 mx-1.5 my-0.5 rounded-lg cursor-pointer transition-all duration-150 flex items-center gap-1 min-h-[36px] ${
        active ? "bg-[var(--color-active-bg)]" : "hover:bg-[var(--color-hover-bg)]"
      }`}
      onClick={() => { if (!editing) onSelect(conv.id); }}
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
            if (e.key === "Escape") { setTitle(conv.title); setEditing(false); }
          }}
          fullWidth
          sx={{
            "& .MuiOutlinedInput-root": {
              fontSize: "0.75rem", padding: "2px 8px",
              color: "text.primary", backgroundColor: "rgba(255,255,255,.04)",
              "& fieldset": { borderColor: "transparent" },
            },
          }}
        />
      ) : (
        <>
          <ListItemText
            primary={title}
            primaryTypographyProps={{
              noWrap: true,
              sx: {
                fontSize: "0.76rem", letterSpacing: "-0.01em",
                color: active ? "var(--color-active-text)" : "text.primary",
                fontWeight: active ? 500 : 400,
              },
            }}
          />
          <Box
            sx={{
              display: "flex", gap: 0, flexShrink: 0, ml: 0.5,
              opacity: active ? 0.7 : 0,
              ".group/conv:hover &": { opacity: 0.7 },
            }}
          >
            {confirmDel ? (
              <IconButton
                size="small"
                onClick={(e) => { e.stopPropagation(); onDelete(conv.id); setConfirmDel(false); }}
                sx={{ p: 0.25, color: "#f87171", minHeight: 26, minWidth: 26 }}
              >
                ✓
              </IconButton>
            ) : (
              <>
                <IconButton
                  size="small"
                  onClick={(e) => { e.stopPropagation(); setEditing(true); }}
                  sx={{ p: 0.25, color: "text.disabled", minHeight: 26, minWidth: 26 }}
                >
                  <EditIcon sx={{ fontSize: 13 }} />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={(e) => { e.stopPropagation(); setConfirmDel(true); }}
                  sx={{ p: 0.25, color: "text.disabled", minHeight: 26, minWidth: 26 }}
                >
                  <DeleteOutlineIcon sx={{ fontSize: 13 }} />
                </IconButton>
              </>
            )}
          </Box>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sidebar content (reused in both desktop and mobile drawer)          */
/* ------------------------------------------------------------------ */
function SidebarContent({
  convs,
  convId,
  onNew,
  onSelect,
  onDelete,
  onRename,
  onClose,
}: {
  convs: Conv[];
  convId: string | null;
  onNew: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onClose?: () => void;
}) {
  const [search, setSearch] = useState("");
  const inputRef = document.createElement("div"); // dummy

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
    <div className="flex flex-col h-full">
      {/* New chat button */}
      <div className="px-2.5 pt-2.5 pb-1.5">
        <Button
          fullWidth
          variant="outlined"
          startIcon={<AddIcon sx={{ fontSize: 16 }} />}
          onClick={() => { onNew(); onClose?.(); }}
          sx={{
            textTransform: "none", fontWeight: 600, borderRadius: 2,
            py: 0.75, fontSize: "0.8rem", minHeight: 40,
            bgcolor: "var(--color-btn-bg)", color: "text.primary",
            borderColor: "var(--color-btn-border)", transition: "all 0.15s",
            "&:hover": { bgcolor: "var(--color-btn-bg-hover)", color: "text.primary", borderColor: "var(--color-btn-border-hover)" },
          }}
        >
          New Chat
        </Button>
      </div>

      {/* Search */}
      <div className="px-2.5 py-0.5">
        {search ? (
          <div className="flex items-center bg-[var(--color-search-bg)] rounded-lg overflow-hidden border border-transparent focus-within:border-[var(--color-border-focus)] transition-colors">
            <SearchIcon sx={{ fontSize: 14, color: "text.disabled", ml: 1.5 }} />
            <input
              autoFocus
              type="text"
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-[0.75rem] px-2 py-1.5 text-[var(--color-text-primary)] outline-none placeholder:text-[rgba(255,255,255,.25)]"
            />
            <IconButton size="small" onClick={() => setSearch("")} sx={{ p: 0.5, color: "text.disabled", minHeight: 28, minWidth: 28 }}>
              <Close sx={{ fontSize: 14 }} />
            </IconButton>
          </div>
        ) : (
          <button
            onClick={() => setSearch("")}
            className="flex items-center gap-1.5 w-full px-2.5 py-1.5 rounded-lg text-[0.75rem] bg-[var(--color-search-bg)] text-[rgba(255,255,255,.25)] hover:bg-[var(--color-hover-bg)] transition-colors"
          >
            <SearchIcon sx={{ fontSize: 14 }} />
            Search conversations…
          </button>
        )}
      </div>

      <div className="h-px mx-2.5 my-1 bg-[var(--color-border)]" />

      {/* Grouped list */}
      <div className="flex-1 overflow-y-auto">
        {groups.length === 0 && (
          <div className="flex justify-center mt-8 opacity-30 px-3">
            <Typography sx={{ fontSize: "0.78rem", color: "text.disabled", textAlign: "center" }}>
              {search ? "No matching conversations" : "No conversations yet"}
            </Typography>
          </div>
        )}

        {groups.map((items, gi) => (
          <div key={gi} className="mb-1">
            <div className="px-2.5 py-1 text-[0.58rem] font-semibold text-zinc-500 uppercase tracking-wider">
              {GROUP_LABELS[gi]}
            </div>
            {items.map((c) => (
              <ConvRow
                key={c.id}
                conv={c}
                active={c.id === convId}
                onSelect={(id) => { onSelect(id); onClose?.(); }}
                onDelete={onDelete}
                onRename={onRename}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sidebar (desktop + mobile)                                         */
/* ------------------------------------------------------------------ */
export function Sidebar({
  convs,
  convId,
  onNew,
  onSelect,
  onDelete,
  onRename,
  open,
  onClose,
}: {
  convs: Conv[];
  convId: string | null;
  onNew: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <>
      {/* Desktop — always visible */}
      <div className="hidden sm:flex w-[260px] flex-shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-sidebar-bg)]">
        <SidebarContent
          convs={convs} convId={convId} onNew={onNew} onSelect={onSelect}
          onDelete={onDelete} onRename={onRename}
        />
      </div>

      {/* Mobile — drawer */}
      <SwipeableDrawer
        anchor="left" open={open} onClose={onClose} onOpen={() => {}}
        PaperProps={{ sx: { width: 260, bgcolor: "var(--color-sidebar-bg)", borderRight: 0 } }}
      >
        <SidebarContent
          convs={convs} convId={convId} onNew={onNew} onSelect={onSelect}
          onDelete={onDelete} onRename={onRename} onClose={onClose}
        />
      </SwipeableDrawer>
    </>
  );
}
