export function looksLikeSmiles(input: string): boolean {
  const value = input.trim();
  if (!value) return false;
  if (/[\s]/.test(value)) return false;
  return /^[B-IK-Za-ik-z0-9@+\-\[\]()=#$:%.\/\\]*$/.test(value);
}

export function normalizeSmiles(input: string): string {
  return input.replace(/\s+/g, '').trim();
}
