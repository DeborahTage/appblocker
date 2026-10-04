use crate::config::SessionConfig;
use crate::state::{FocusState, FocusStateMachine};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionMemory {
    pub session_id: String,
    pub token: String,
    pub student_id: String,
    pub student_name: String,
    pub expires_at: DateTime<Utc>,
    pub config: SessionConfig,
    pub api_base: String,
    pub ws_url: String,
}

/// Holds all session-scoped state. Must be cleared immediately on session end.
pub struct SessionRuntime {
    pub memory: Option<SessionMemory>,
    pub machine: FocusStateMachine,
    pub monitoring: bool,
}

impl SessionRuntime {
    pub fn new() -> Self {
        Self {
            memory: None,
            machine: FocusStateMachine::new(),
            monitoring: false,
        }
    }

    pub fn begin(&mut self, memory: SessionMemory) {
        self.memory = Some(memory);
        self.monitoring = true;
        let _ = self.machine.force(FocusState::Waiting);
    }

    /// Immediately stop polling-related flags and clear session memory.
    pub fn end(&mut self) {
        self.monitoring = false;
        self.memory = None;
        let _ = self.machine.force(FocusState::SessionEnded);
    }

    pub fn clear_to_idle(&mut self) {
        self.monitoring = false;
        self.memory = None;
        let _ = self.machine.force(FocusState::Disconnected);
    }

    pub fn is_active(&self) -> bool {
        self.monitoring && self.memory.is_some()
    }
}

impl Default for SessionRuntime {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn clears_memory_on_end() {
        let mut rt = SessionRuntime::new();
        rt.begin(SessionMemory {
            session_id: "s".into(),
            token: "t".into(),
            student_id: "st".into(),
            student_name: "Alex".into(),
            expires_at: Utc::now(),
            config: SessionConfig::default(),
            api_base: "http://localhost:4000/api".into(),
            ws_url: "ws://localhost:4000/ws".into(),
        });
        assert!(rt.is_active());
        rt.end();
        assert!(!rt.is_active());
        assert!(rt.memory.is_none());
        assert_eq!(rt.machine.current(), FocusState::SessionEnded);
    }
}
