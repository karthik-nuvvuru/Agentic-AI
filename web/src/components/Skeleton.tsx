import { Box, Skeleton, Stack, TextField } from "@mui/material";

/* ------------------------------------------------------------------ */
/*  Skeleton for the message area while loading history                */
/* ------------------------------------------------------------------ */
export function ChatSkeleton() {
  return (
    <Stack spacing={4} sx={{ px: 3, py: 4 }}>
      <Stack direction="row" spacing={2} justifyContent="flex-end" sx={{ maxWidth: "70%", ml: "auto" }}>
        <Skeleton variant="rounded" width={200} height={40} sx={{ borderRadius: "18px 4px 18px 18px", bgcolor: "rgba(99,102,241,.15)" }} />
      </Stack>
      <Stack direction="row" spacing={2} sx={{ maxWidth: "75%" }}>
        <Skeleton variant="circular" width={28} height={28} />
        <Stack spacing={1} sx={{ flex: 1 }}>
          <Skeleton variant="text" width="90%" height={16} />
          <Skeleton variant="text" width="75%" height={16} />
          <Skeleton variant="text" width="60%" height={16} />
        </Stack>
      </Stack>
      <Stack direction="row" spacing={2} justifyContent="flex-end" sx={{ maxWidth: "70%", ml: "auto" }}>
        <Skeleton variant="rounded" width={240} height={50} sx={{ borderRadius: "18px 4px 18px 18px", bgcolor: "rgba(99,102,241,.15)" }} />
      </Stack>
      <Stack direction="row" spacing={2} sx={{ maxWidth: "75%" }}>
        <Skeleton variant="circular" width={28} height={28} />
        <Stack spacing={1} sx={{ flex: 1 }}>
          <Skeleton variant="text" width="85%" height={16} />
          <Skeleton variant="text" width="70%" height={16} />
          <Skeleton variant="text" width="50%" height={16} />
        </Stack>
      </Stack>
    </Stack>
  );
}

/* ------------------------------------------------------------------ */
/*  Skeleton rows for the sidebar while loading conversations          */
/* ------------------------------------------------------------------ */
export function SidebarSkeletons() {
  return (
    <Stack sx={{ px: 1.5, py: 1 }} spacing={0.5}>
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton
          key={i}
          variant="rounded"
          width="100%"
          height={32}
          sx={{ borderRadius: 1.5, bgcolor: "rgba(128,128,128,.06)" }}
          animation={i % 2 === 0 ? "wave" : "pulse"}
        />
      ))}
    </Stack>
  );
}
