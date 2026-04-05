import { useCallback, useEffect, useRef, useState } from "react";
import { Box, IconButton } from "@mui/material";
import { styled } from "@mui/material/styles";
import { KeyboardArrowDown as KeyboardArrowDownIcon } from "@mui/icons-material";

const ScrollBox = styled(Box)(({ theme }) => ({
  overflowY: "auto",
  height: "100%",
  scrollBehavior: "smooth",
  "&::-webkit-scrollbar": { width: "4px" },
  "&::-webkit-scrollbar-track": { background: "transparent" },
  "&::-webkit-scrollbar-thumb": {
    background: "rgba(128,128,128,.15)",
    borderRadius: "2px",
  },
  "&::-webkit-scrollbar-thumb:hover": { background: theme.palette.text.secondary },
}));

export function ScrollContainer({ children }: { children: React.ReactNode; isStreaming?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const handleScroll = useCallback(() => {
    if (ref.current) {
      const { scrollHeight, clientHeight, scrollTop } = ref.current;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      setShowScrollButton(distanceFromBottom > 200);
    }
  }, []);

  const scrollToBottom = useCallback(() => {
    if (ref.current) {
      ref.current.scrollTo({ top: ref.current.scrollHeight, behavior: "smooth" });
    }
  }, []);

  // Smart scroll: only auto-scroll if user is near bottom
  const smartScroll = useCallback(() => {
    if (ref.current) {
      const { scrollHeight, clientHeight, scrollTop } = ref.current;
      if (scrollHeight - scrollTop - clientHeight < 200) {
        ref.current.scrollTo({ top: scrollHeight, behavior: "smooth" });
      }
    }
  }, []);

  // Use MutationObserver so we don't re-trigger on every small token update
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new MutationObserver(smartScroll);
    observer.observe(el, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [smartScroll]);

  return (
    <Box sx={{ position: "relative", height: "100%", flex: 1 }}>
      <ScrollBox ref={ref} onScroll={handleScroll}>
        {children}
      </ScrollBox>

      {/* Scroll-to-bottom button — ChatGPT style */}
      {showScrollButton && (
        <IconButton
          onClick={scrollToBottom}
          aria-label="Scroll to bottom"
          sx={{
            position: "absolute",
            bottom: 12,
            left: "50%",
            transform: "translateX(-50%)",
            width: 32,
            height: 32,
            borderRadius: "50%",
            bgcolor: "#27272a",
            border: "1px solid #3f3f46",
            boxShadow: "0 2px 8px rgba(0,0,0,.3)",
            color: "#a1a1aa",
            "&:hover": { bgcolor: "#3f3f46" },
          }}
        >
          <KeyboardArrowDownIcon sx={{ fontSize: 18 }} />
        </IconButton>
      )}
    </Box>
  );
}
