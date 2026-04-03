import { Box, useTheme } from "@mui/material";
import { useCallback, useRef } from "react";

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

  return (
    <Box
      ref={scrollRef}
      sx={{
        overflowY: "auto",
        height: "calc(100vh - 260px)",
        px: 1,
        scrollBehavior: "smooth",
        "&::-webkit-scrollbar": { width: "6px" },
        "&::-webkit-scrollbar-track": { bgcolor: "transparent" },
        "&::-webkit-scrollbar-thumb": {
          bgcolor: theme.palette.divider,
          borderRadius: "3px",
        },
        "&::-webkit-scrollbar-thumb:hover": { bgcolor: theme.palette.text.secondary },
      }}
    >
      {children}
      <Box sx={{ height: "1px", width: "1px", visibility: "hidden" }} ref={scrollToBottom} />
    </Box>
  );
}
