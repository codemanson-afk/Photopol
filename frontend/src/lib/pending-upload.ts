/** In-memory handoff: home file picker → /workspace (same SPA session). */
let pending: File | null = null;

export function setPendingUpload(file: File) {
  pending = file;
}

export function takePendingUpload(): File | null {
  const file = pending;
  pending = null;
  return file;
}

export function peekPendingUpload(): File | null {
  return pending;
}
