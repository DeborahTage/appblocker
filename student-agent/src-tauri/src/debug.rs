use crate::foreground::{DetectionCapability, ForegroundInfo};
use crate::state::FocusState;
use chrono::{DateTime, Utc};
use serde::Serialize;
use std::collections::VecDeque;

const MAX_LOG_ENTRIES: usize = 200;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DebugLogEntry {
    pub timestamp: DateTime<Utc>,
    pub level: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DebugTelemetry {
    pub capability: DetectionCapability,
    pub current_foreground_application: Option<String>,
    pub process_name: Option<String>,
    /// Local-only debug value. Never serialized into a WebSocket payload.
    pub window_title: Option<String>,
    pub current_state: FocusState,
    pub websocket_status: String,
    pub last_heartbeat_at: Option<DateTime<Utc>>,
    pub last_state_sent_at: Option<DateTime<Utc>>,
    pub last_message_received_at: Option<DateTime<Utc>>,
    pub last_error: Option<String>,
    pub logs: VecDeque<DebugLogEntry>,
}

impl DebugTelemetry {
    pub fn new(capability: DetectionCapability) -> Self {
        Self {
            capability,
            current_foreground_application: None,
            process_name: None,
            window_title: None,
            current_state: FocusState::Disconnected,
            websocket_status: "disconnected".into(),
            last_heartbeat_at: None,
            last_state_sent_at: None,
            last_message_received_at: None,
            last_error: None,
            logs: VecDeque::new(),
        }
    }

    pub fn set_foreground(&mut self, info: &ForegroundInfo) {
        self.current_foreground_application = Some(info.display_name.clone());
        self.process_name = Some(info.process_name.clone());
        self.window_title = info.window_title.clone();
    }

    pub fn clear_foreground(&mut self) {
        self.current_foreground_application = None;
        self.process_name = None;
        self.window_title = None;
    }

    pub fn log(&mut self, level: &str, message: impl Into<String>) {
        self.logs.push_back(DebugLogEntry {
            timestamp: Utc::now(),
            level: level.into(),
            message: message.into(),
        });
        while self.logs.len() > MAX_LOG_ENTRIES {
            self.logs.pop_front();
        }
    }

    pub fn error(&mut self, message: impl Into<String>) {
        let message = message.into();
        self.last_error = Some(message.clone());
        self.log("error", message);
    }

    pub fn reset_session(&mut self) {
        self.current_foreground_application = None;
        self.process_name = None;
        self.window_title = None;
        self.current_state = FocusState::Disconnected;
        self.websocket_status = "disconnected".into();
        self.last_heartbeat_at = None;
        self.last_state_sent_at = None;
        self.last_message_received_at = None;
        self.last_error = None;
        self.log("info", "Session telemetry cleared");
    }
}
