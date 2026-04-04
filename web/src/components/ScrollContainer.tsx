import { useCallback, useEffect, useRef } from "react";
import { Box, useTheme } from "@mui/material";
import { styled } from "@mui/material/styles";

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

export function ScrollContainer({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    if (ref.current) {
      const { scrollHeight, clientHeight, scrollTop } = ref.current;
      // Only auto-scroll if user is near bottom (avoids jumping when user scrolls up)
      if (scrollHeight - scrollTop - clientHeight < 200) {
        ref.current.scrollTo({ top: scrollHeight, behavior: "smooth" });
      }
    }
  }, []);

  // Use MutationObserver so we don't re-trigger on every small token update
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new MutationObserver(scrollToBottom);
    observer.observe(el, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [scrollToBottom]);

  return <ScrollBox ref={ref}>{children}</ScrollBox>;
}
