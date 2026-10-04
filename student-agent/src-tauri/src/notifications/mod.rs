use tracing::info;

/// Show a native notification when a blocked app is detected.
/// Does not force-close or terminate any process.
pub fn notify_blocked_app(app_name: &str) {
    info!(app_name, "blocked app notification requested");
    // Actual OS notification is dispatched from Tauri command layer via plugin.
}

/// Placeholder for future soft-intervention review.
/// MUST NOT terminate processes or force-close windows.
pub fn handle_blocked_app(process_name: &str) {
    // TODO: Future review — optional gentle nudge policies only.
    // Never kill processes, never inject input, never force-close windows.
    let _ = process_name;
}
