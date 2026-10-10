import { Auth0Client } from "@auth0/nextjs-auth0/server";

export const isAuthConfigured = Boolean(process.env.AUTH0_DOMAIN && process.env.AUTH0_SECRET && !process.env.AUTH0_DOMAIN.startsWith("your-"));
export const auth0 = new Auth0Client({
  authorizationParameters: process.env.AUTH0_AUDIENCE ? { audience: process.env.AUTH0_AUDIENCE } : undefined,
});
