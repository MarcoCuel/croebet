const displayNameKey = (username: string) =>
  `croebet:demo-display-name:${username.toLowerCase()}`;

export function normalizeDisplayName(value: unknown): string {
  if (typeof value !== "string")
    throw new Error("Informe um nome de 1 a 40 caracteres.");
  const name = value.trim();
  if (
    !name ||
    Array.from(name).length > 40 ||
    /[\u0000-\u001f\u007f]/u.test(name)
  )
    throw new Error("Informe um nome de 1 a 40 caracteres.");
  return name;
}

export function readDisplayName(username: string): string {
  try {
    const saved = localStorage.getItem(displayNameKey(username));
    return saved === null ? username : normalizeDisplayName(saved);
  } catch {
    return username;
  }
}

export function persistDisplayName(username: string, value: string): string {
  const name = normalizeDisplayName(value);
  localStorage.setItem(displayNameKey(username), name);
  return name;
}
