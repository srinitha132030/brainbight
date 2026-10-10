import { auth0 } from "../auth0";
import { Dashboard } from "./ui";
export default async function Home() {
  const authConfigured = Boolean(process.env.AUTH0_DOMAIN && process.env.AUTH0_SECRET && !process.env.AUTH0_DOMAIN.startsWith("your-"));
  const session = authConfigured ? await auth0.getSession() : null;
  const user = session?.user;
  const userRoles = user?.["https://brainbight.app/roles"];
  const allowed = authConfigured && Array.isArray(userRoles) && userRoles.includes("admin");
  return <Dashboard name={user?.name || user?.email || "there"} email={user?.email || ""} authenticated={Boolean(user)} allowed={allowed} />;
}
