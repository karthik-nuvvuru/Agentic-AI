import { Box, useTheme } from "@mui/material";
import { useCallback, useEffect, useRef } from "react";

interface ScrollContainerProps {
  children: React.ReactNode;
}

export function ScrollContainer({ children }: ScrollContainerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const theme = useTheme();

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [scrollToBottom, children]);

  return (
    <Box
      ref={scrollRef}
      sx={{
        overflowY: "auto",
        height: "calc(100vh - 120px)",
        scrollBehavior: "smooth",
        "&::-webkit-scrollbar": { width: "4px" },
        "&::-webkit-scrollbar-track": { bgcolor: "transparent" },
        "&::-webkit-scrollbar-thumb": {
          bgcolor: "rgba(255,255,255,.05)",
          borderRadius: "2px",
        },
        "&::-webkit-scrollbar-thumb:hover": { bgcolor: theme.palette.text.secondary },
      }}
    >
      {children}
    </Box>
  );
}
