use serde::{Deserialize, Serialize};

/// In-memory session config. Cleared when the session ends.
/// Domain fields are accepted for API compatibility but unused on Windows MVP.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SessionConfig {
    pub allowed_apps: Vec<String>,
    pub blocked_apps: Vec<String>,
    pub allowed_domains: Vec<String>,
    pub blocked_domains: Vec<String>,
    #[serde(default)]
    pub enable_session_summary: bool,
    #[serde(default = "default_retention")]
    pub summary_retention_hours: u32,
}

fn default_retention() -> u32 {
    24
}

/// Domain matching is intentionally unsupported — we never read window titles/URLs.
pub const DOMAIN_MATCHING_SUPPORTED: bool = false;
