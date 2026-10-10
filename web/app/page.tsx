import { Hero } from "./ui";
import { auth0, isAuthConfigured } from "../auth0";
export default async function Home() {
  const session = isAuthConfigured ? await auth0.getSession() : null;
  return <Hero authenticated={Boolean(session?.user)} />;
}
