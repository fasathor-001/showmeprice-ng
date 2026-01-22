import { getAuthSession } from "./authSession";

export async function getAccessToken(): Promise<string> {
  const token = getAuthSession()?.access_token || "";
  if (!token || token.split(".").length !== 3) {
    throw new Error("Session expired");
  }
  return token;
}
