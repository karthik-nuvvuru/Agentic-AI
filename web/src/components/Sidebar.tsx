import {
  Avatar, Box, Button, IconButton, ListItemButton, ListItemText,
  SwipeableDrawer, Typography,
} from "@mui/material";
import {
  Add as AddIcon, Close, DeleteOutline as DeleteOutlineIcon,
  Edit as EditIcon, Logout as LogoutIcon, Search as SearchIcon,
  SmartToy as SmartToyIcon,
} from "@mui/icons-material";
import { useCallback, useMemo, useState } from "react";
import { apiUpdateConversationTitle, apiLogout } from "../services/api";

type Conv = { id: string; title: string; updated_at?: string };

function timeGroup(iso?: string): number {
  const ms = iso ? Date.now() - new Date(iso).getTime() : Infinity;
  if (ms < 86400000) return 0;
  if (ms < 2 * 86400000) return 1;
  if (ms < 7 * 86400000) return 2;
  return 3;
}
const GROUP_LABELS = ["Today", "Yesterday", "Last 7 days", "Older"];

function ConvRow({ conv, active, onSelect, onDelete }: {
  conv: Conv; active: boolean; onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(conv.title);
  const [confirmDel, setConfirmDel] = useState(false);

  const commit = useCallback(async () => {
    setEditing(false);
    if (title.trim() && title !== conv.title) {
      try { await apiUpdateConversationTitle(conv.id, title.trim()); } catch {}
    }
  }, [title, conv.title, conv.id]);

  return (
    <ListItemButton
      dense onClick={() => { if (!editing) onSelect(conv.id); }}
      selected={active}
      sx={{
        borderRadius: 2, mx: 1, my: 0.25, py: 0.75, minHeight: 36,
        bgcolor: active ? "rgba(99,102,241,.12)" : "transparent",
        border: active ? "1px solid rgba(99,102,241,.18)" : "1px solid transparent",
        transition: "all .15s ease",
        "&:hover": { bgcolor: "rgba(255,255,255,.06)", borderColor: "rgba(255,255,255,.06)" },
        "&.Mui-selected": { bgcolor: "rgba(99,102,241,.1)", "&:hover": { bgcolor: "rgba(99,102,241,.15)", borderColor: "rgba(99,102,241,.2)" } },
      }}
    >
      {editing ? (
        <input
          autoFocus value={title}
          onChange={e => setTitle(e.target.value)}
          onBlur={commit} onKeyDown={e => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") { setTitle(conv.title); setEditing(false); }
          }}
          onClick={e => e.stopPropagation()}
          style={{
            width: "100%", background: "rgba(255,255,255,.06)", border: "1px solid rgba(99,102,241,.3)",
            borderRadius: 6, padding: "2px 8px", color: "#e4e4e7", fontSize: 12, outline: "none", fontFamily: "inherit",
          }}
        />
      ) : (
        <>
          <ListItemText
            primary={title}
            primaryTypographyProps={{
              noWrap: true, sx: {
                fontSize: 13, letterSpacing: "-.01em",
                color: active ? "#c4b5fd" : "#d4d4d4", fontWeight: active ? 500 : 400,
              },
            }}
          />
          <Box sx={{
            display: "flex", gap: 0, flexShrink: 0, ml: 0.5,
            opacity: active ? 1 : 0, transition: "opacity .15s",
            ".MuiListItemButton-root:hover &": { opacity: 1 },
          }}>
            {confirmDel ? (
              <IconButton size="small" onClick={e => { e.stopPropagation(); onDelete(conv.id); setConfirmDel(false); }}
                sx={{ p: 0.25, color: "#f87171", minHeight: 26, minWidth: 26 }}>✓</IconButton>
            ) : (
              <>
                <IconButton size="small" onClick={e => { e.stopPropagation(); setEditing(true); }}
                  sx={{ p: 0.25, color: "#71717a", minHeight: 26, minWidth: 26 }}>
                  <EditIcon sx={{ fontSize: 13 }} />
                </IconButton>
                <IconButton size="small" onClick={e => { e.stopPropagation(); setConfirmDel(true); }}
                  sx={{ p: 0.25, color: "#71717a", minHeight: 26, minWidth: 26 }}>
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

function SidebarContent({
  convs, convId, onNew, onSelect, onDelete, onClose, user
}: {
  convs: Conv[]; convId: string | null;
  onNew: () => void; onSelect: (id: string) => void; onDelete: (id: string) => void;
  onClose?: () => void; user?: { email: string; name: string } | null;
}) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(
    () => search ? convs.filter(c => c.title.toLowerCase().includes(search.toLowerCase())) : convs,
    [convs, search]
  );
  const groups = useMemo(() => {
    const g: Conv[][] = [[], [], [], []];
    for (const c of filtered) g[timeGroup(c.updated_at)].push(c);
    return g.filter(a => a.length);
  }, [filtered]);

  const initials = user?.name?.charAt(0).toUpperCase() ?? user?.email?.charAt(0).toUpperCase() ?? "?";

  const handleLogout = async () => {
    await apiLogout();
    localStorage.removeItem("auth_access_token");
    sessionStorage.removeItem("auth_access_token");
    onClose?.();
    window.location.reload();
  };

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Top section: New Chat + search */}
      <Box sx={{ p: 1.5, pb: 1 }}>
        <Button fullWidth variant="outlined" startIcon={<AddIcon sx={{ fontSize: 16 }} />}
          onClick={() => { onNew(); onClose?.(); }}
          sx={{
            textTransform: "none", fontWeight: 600, borderRadius: 2, py: 0.75, fontSize: 13, minHeight: 40,
            bgcolor: "rgba(255,255,255,.06)", color: "#d4d4d4", borderColor: "rgba(255,255,255,.1)",
            transition: "all .15s ease",
            "&:hover": { bgcolor: "rgba(99,102,241,.12)", borderColor: "rgba(99,102,241,.3)", transform: "translateY(-1px)", boxShadow: "0 2px 8px rgba(99,102,241,.15)" },
            "&:active": { transform: "scale(0.97)" },
          }}>
          New Chat
        </Button>
      </Box>

      <Box sx={{ px: 1.5, py: 0.5 }}>
        <Box sx={{
          display: "flex", alignItems: "center", borderRadius: 2, overflow: "hidden",
          bgcolor: "rgba(255,255,255,.04)",
          border: "1px solid transparent",
          transition: "border-color .15s",
          "&:focus-within": { borderColor: "rgba(99,102,241,.4)" },
        }}>
          <SearchIcon sx={{ fontSize: 14, color: "#71717a", ml: 1.5, flexShrink: 0 }} />
          <input
            data-testid="sidebar-search"
            autoFocus={false} type="text" placeholder="Search…"
            value={search} onChange={e => setSearch(e.target.value)}
            style={{
              flex: 1, background: "transparent", border: "none", color: "#e4e4e7",
              fontSize: 12, padding: "8px", outline: "none",
            }}
          />
          {search && (
            <IconButton size="small" onClick={() => setSearch("")}
              sx={{ p: 0.5, color: "#71717a", minHeight: 28, minWidth: 28 }}>
              <Close sx={{ fontSize: 14 }} />
            </IconButton>
          )}
        </Box>
      </Box>

      <Box sx={{ height: 1, mx: 2, my: 1, bgcolor: "rgba(255,255,255,.06)" }} />

      {/* Conversation list */}
      <Box sx={{ flex: 1, overflowY: "auto", overflowX: "hidden", px: 0.5 }}>
        {groups.length === 0 && (
          <Box sx={{ display: "flex", justifyContent: "center", mt: 8, opacity: 0.3, px: 3 }}>
            <Typography sx={{ fontSize: 13, color: "#71717a" }}>
              {search ? "No matching conversations" : "No conversations yet"}
            </Typography>
          </Box>
        )}
        {groups.map((items, gi) => (
          <Box key={gi} sx={{ mb: 1 }}>
            <Typography sx={{ px: 2.5, py: 0.5, color: "#52525b", fontWeight: 600, fontSize: 10, letterSpacing: ".06em", textTransform: "uppercase" }}>
              {GROUP_LABELS[gi]}
            </Typography>
            {items.map(c => (
              <ConvRow key={c.id} conv={c} active={c.id === convId}
                onSelect={id => { onSelect(id); onClose?.(); }} onDelete={onDelete} />
            ))}
          </Box>
        ))}
      </Box>

      {/* User info at bottom — ChatGPT style */}
      <Box sx={{
        borderTop: "1px solid rgba(255,255,255,.06)",
        bgcolor: "rgba(255,255,255,.02)",
        p: 1.5,
      }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            px: 1.5,
            py: 1,
            borderRadius: 2,
            cursor: "default",
            transition: "background .15s",
            "&:hover": { bgcolor: "rgba(255,255,255,.04)" },
          }}
        >
          <Avatar
            sx={{
              width: 32,
              height: 32,
              fontSize: 13,
              fontWeight: 700,
              bgcolor: "rgba(99,102,241,.12)",
              color: "#a5b4fc",
              border: "1.5px solid rgba(99,102,241,.25)",
              flexShrink: 0,
            }}
          >
            {initials}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{
              fontSize: 13,
              fontWeight: 600,
              color: "#e4e4e7",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}>
              {user?.name || "User"}
            </Typography>
            <Typography sx={{
              fontSize: 11,
              color: "#71717a",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}>
              {user?.email}
            </Typography>
          </Box>
          <IconButton
            size="small"
            onClick={handleLogout}
            title="Sign out"
            sx={{
              color: "#71717a",
              "&:hover": { color: "#f87171", bgcolor: "rgba(239,68,68,.08)" },
              transition: "all .15s",
              minHeight: 28,
              minWidth: 28,
            }}
          >
            <LogoutIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
      </Box>
    </Box>
  );
}

export function Sidebar({
  convs, convId, onNew, onSelect, onDelete, open, onClose, onRename: _onRename, user,
}: {
  convs: Conv[]; convId: string | null;
  onNew: () => void; onSelect: (id: string) => void; onDelete: (id: string) => void;
  onRename?: (id: string, title: string) => void; open: boolean; onClose: () => void;
  user?: { email: string; name: string } | null;
}) {
  const content = (
    <SidebarContent
      convs={convs}
      convId={convId}
      onNew={onNew}
      onSelect={onSelect}
      onDelete={onDelete}
      onClose={onClose}
      user={user}
    />
  );

  return (
    <>
      {/* Desktop sidebar */}
      <Box
        sx={{
          width: 260,
          minWidth: 260,
          height: "100vh",
          bgcolor: "#171717",
          display: { xs: "none", sm: "flex" },
          flexDirection: "column",
          borderRight: "1px solid rgba(255,255,255,.06)",
          position: "relative",
          zIndex: 1,
        }}
      >
        {content}
      </Box>

      {/* Mobile drawer */}
      <SwipeableDrawer
        anchor="left"
        open={open}
        onClose={onClose}
        onOpen={() => {}}
        ModalProps={{
          keepMounted: true,
        }}
        PaperProps={{
          sx: {
            width: 280,
            bgcolor: "#171717",
            borderRight: 0,
          },
        }}
      >
        {content}
      </SwipeableDrawer>
    </>
  );
}
