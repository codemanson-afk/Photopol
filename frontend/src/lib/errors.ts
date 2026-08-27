export function friendlyError(err: unknown): string {
  const code = err && typeof err === "object" && "code" in err ? String((err as { code: string }).code) : "";

  if (code === "insufficient_credits") {
    return "You don’t have enough credits for this. Top up from Credits, then try again.";
  }
  if (code === "guest_limit_images" || code === "guest_limit_jobs" || code === "auth_required_download") {
    return "Sign in or create a free account to continue.";
  }
  if (code === "coming_soon" || code === "unsupported") {
    return "That feature is coming soon. Try Remove Background or Resize for now.";
  }
  if (code === "guest_session_failed" || code === "unauthorized") {
    return "Session expired. Refresh the page and try uploading again.";
  }
  if (code === "ai_insufficient_credit") {
    return "AI provider is out of credit. Try again shortly, or contact support.";
  }
  if (code === "ai_not_configured") {
    return "AI processing isn’t configured yet. Try again later.";
  }
  if (code === "ai_no_foreground") {
    return "Couldn’t find a clear subject in that image. Try a photo with a person or object.";
  }
  if (code === "invalid_upload" || code === "invalid_image") {
    return "That file couldn’t be used. Try JPG, PNG, or WEBP under 10MB.";
  }
  if (code === "file_too_large") {
    return "That image is too large. Use a file under 10MB.";
  }

  // Never surface provider / HTTP jargon to customers
  return "Something went wrong while processing your image. Your credits were not charged.";
}

export function autoProjectName(d = new Date()): string {
  return `Image – ${d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
}
