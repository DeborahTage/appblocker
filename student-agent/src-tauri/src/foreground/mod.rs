//! Foreground application detection.
//!
//! Privacy invariant: only process/executable names are sent to the backend.
//! Window titles may be read locally for the Debug page and are never transmitted.

pub mod normalize;
pub mod provider;

pub use normalize::{display_name_for_process, matches_app_list, normalize_process_name};
pub use provider::{platform_provider, DetectionCapability, ForegroundInfo, ForegroundProvider};
