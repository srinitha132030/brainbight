import { Auth0Client } from "@auth0/nextjs-auth0/server";
export const auth0 = new Auth0Client({
  appBaseUrl: process.env.ADMIN_APP_BASE_URL || process.env.APP_BASE_URL || "http://localhost:3001",
  authorizationParameters: process.env.AUTH0_AUDIENCE ? { audience: process.env.AUTH0_AUDIENCE } : undefined,
});
