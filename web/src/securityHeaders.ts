/**
 * Security headers — applied via Vite <meta> tags in index.html.
 * Also export as a middleware for the FastAPI backend to set on every response.
 */

export const SECURITY_HEADERS = {
  "Content-Security-Policy":
    "default-src 'self'; " +
    "script-src 'self' https://fonts.googleapis.com; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com data:; " +
    "img-src 'self' data: blob:; " +
    "connect-src 'self' https://api.euron.one https://accounts.google.com https://github.com https://api.github.com; " +
    "frame-ancestors 'none'; " +
    "base-uri 'self'; " +
    "form-action 'self'; " +
    "object-src 'none';",

  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-XSS-Protection": "0", // CSP handles this better; disable legacy header
} as const;

/**
 * Apply security headers to a Vite dev response (for vite.config.ts).
 */
export function addSecurityHeadersPlugin() {
  return {
    name: "security-headers",
    configureServer(server: any) {
      server.middlewares.use((_req: any, res: any, next: any) => {
        for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
          res.setHeader(key, value);
        }
        next();
      });
    },
  };
}
