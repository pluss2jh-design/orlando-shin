export function getSession() {
  return null;
}

export function requireAuth() {
  const session = getSession();
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
}
