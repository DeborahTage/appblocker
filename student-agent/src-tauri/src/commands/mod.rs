use crate::config::SessionConfig;
use crate::debug::DebugTelemetry;
use crate::foreground::{DetectionCapability, ForegroundInfo};
use crate::session::{SessionMemory, SessionRuntime};
use crate::state::FocusState;
use crate::AppState;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};
use tokio::sync::mpsc;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentStatus {
    pub consented: bool,
    pub focus_state: FocusState,
    pub current_app: Option<String>,
    pub process_name: Option<String>,
    pub window_title: Option<String>,
    pub monitoring: bool,
    pub student_name: Option<String>,
    pub session_id: Option<String>,
    pub domain_matching_supported: bool,
    pub runtime_mode: String,
    pub capability: DetectionCapability,
    pub websocket_status: String,
    pub last_heartbeat_at: Option<DateTime<Utc>>,
    pub last_error: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JoinPayload {
    pub pairing_code: String,
    pub api_base: String,
    pub ws_url: String,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct JoinResponse {
    token: String,
    session_id: String,
    expires_at: DateTime<Utc>,
    config: SessionConfig,
    student: StudentDto,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct StudentDto {
    id: String,
    name: String,
}

#[tauri::command]
pub fn get_status(state: State<'_, AppState>) -> AgentStatus {
    let consented = *state.consented.lock();
    let runtime = state.runtime.lock();
    let snap = runtime.machine.snapshot();
    let debug = state.debug.lock();
    AgentStatus {
        consented,
        focus_state: snap.state,
        current_app: snap.current_app,
        process_name: debug.process_name.clone(),
        window_title: debug.window_title.clone(),
        monitoring: runtime.monitoring,
        student_name: runtime.memory.as_ref().map(|m| m.student_name.clone()),
        session_id: runtime.memory.as_ref().map(|m| m.session_id.clone()),
        domain_matching_supported: false,
        runtime_mode: "native".into(),
        capability: debug.capability.clone(),
        websocket_status: debug.websocket_status.clone(),
        last_heartbeat_at: debug.last_heartbeat_at.clone(),
        last_error: debug.last_error.clone(),
    }
}

#[tauri::command]
pub fn set_consent(state: State<'_, AppState>, agreed: bool) -> Result<(), String> {
    if !agreed {
        return Err("Consent is required".into());
    }
    *state.consented.lock() = true;
    Ok(())
}

#[tauri::command]
pub async fn join_session(
    app: AppHandle,
    state: State<'_, AppState>,
    payload: JoinPayload,
) -> Result<AgentStatus, String> {
    if !*state.consented.lock() {
        return Err("Consent required before joining a session".into());
    }
    let capability = state.provider.lock().capability();
    if !capability.supported {
        let message = capability
            .message
            .unwrap_or_else(|| "Foreground detection is unavailable on this desktop.".into());
        state.debug.lock().error(message.clone());
        return Err(message);
    }
    {
        let runtime = state.runtime.lock();
        if runtime.is_active() {
            return Err("Already in a session".into());
        }
    }

    let url = format!("{}/sessions/join", payload.api_base.trim_end_matches('/'));
    tracing::info!(url, "joining lesson session");
    let client = reqwest::Client::new();
    let res = client
        .post(&url)
        .json(&serde_json::json!({ "pairingCode": payload.pairing_code.trim().to_uppercase() }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        let body = res.text().await.unwrap_or_default();
        return Err(format!("Join failed: {body}"));
    }

    let join: JoinResponse = res.json().await.map_err(|e| e.to_string())?;
    let memory = SessionMemory {
        session_id: join.session_id.clone(),
        token: join.token.clone(),
        student_id: join.student.id,
        student_name: join.student.name,
        expires_at: join.expires_at,
        config: join.config,
        api_base: payload.api_base,
        ws_url: payload.ws_url,
    };

    {
        let mut runtime = state.runtime.lock();
        runtime.begin(memory.clone());
    }
    {
        let mut debug = state.debug.lock();
        debug.current_state = FocusState::Waiting;
        debug.websocket_status = "connecting".into();
        debug.last_error = None;
        debug.log("info", "Lesson joined; native monitoring starting");
    }

    start_session_tasks(app, state.inner().clone(), memory);
    Ok(get_status(state))
}

#[tauri::command]
pub async fn leave_session(state: State<'_, AppState>) -> Result<AgentStatus, String> {
    let ws_tx = state.ws_tx.lock().take();
    let cancel_tx = state.cancel.lock().take();
    if let Some(tx) = ws_tx {
        let _ = tx.send(crate::websocket::WsCommand::Leave).await;
    }
    if let Some(cancel) = cancel_tx {
        let _ = cancel.send(()).await;
    }
    {
        let mut runtime = state.runtime.lock();
        runtime.end();
        runtime.clear_to_idle();
    }
    state.debug.lock().reset_session();
    Ok(get_status(state))
}

#[tauri::command]
pub fn probe_foreground(state: State<'_, AppState>) -> Result<Option<ForegroundInfo>, String> {
    state.provider.lock().current()
}

#[tauri::command]
pub fn get_debug_telemetry(state: State<'_, AppState>) -> DebugTelemetry {
    state.debug.lock().clone()
}

fn start_session_tasks(app: AppHandle, state: AppState, memory: SessionMemory) {
    let (ws_tx, ws_rx) = mpsc::channel(32);
    let (ev_tx, mut ev_rx) = mpsc::channel(32);
    let (cancel_tx, mut cancel_rx) = mpsc::channel::<()>(1);

    *state.ws_tx.lock() = Some(ws_tx.clone());
    *state.cancel.lock() = Some(cancel_tx);

    let ws_url = memory.ws_url.clone();
    let session_id = memory.session_id.clone();
    let token = memory.token.clone();

    tauri::async_runtime::spawn(async move {
        crate::websocket::run_client(ws_url, session_id, token, ws_rx, ev_tx).await;
    });

    let state_for_events = state.clone();
    let app_for_events = app.clone();
    tauri::async_runtime::spawn(async move {
        while let Some(ev) = ev_rx.recv().await {
            match ev {
                crate::websocket::WsEvent::Connecting => {
                    let mut debug = state_for_events.debug.lock();
                    debug.websocket_status = "connecting".into();
                    debug.log("info", "WebSocket connecting");
                    let _ = app_for_events.emit("debug-telemetry", debug.clone());
                }
                crate::websocket::WsEvent::SessionEnded { reason } => {
                    let _ = app_for_events.emit("session-ended", &reason);
                    let cancel_tx = state_for_events.cancel.lock().take();
                    if let Some(cancel) = cancel_tx {
                        let _ = cancel.send(()).await;
                    }
                    state_for_events.runtime.lock().end();
                    state_for_events.runtime.lock().clear_to_idle();
                    *state_for_events.ws_tx.lock() = None;
                    let mut debug = state_for_events.debug.lock();
                    debug.websocket_status = "disconnected".into();
                    debug.log("info", format!("Session ended: {reason}"));
                    let _ = app_for_events.emit("debug-telemetry", debug.clone());
                }
                crate::websocket::WsEvent::ConfigUpdate(cfg) => {
                    if let Ok(parsed) = serde_json::from_value::<SessionConfig>(cfg) {
                        if let Some(mem) = state_for_events.runtime.lock().memory.as_mut() {
                            mem.config = parsed;
                        }
                    }
                }
                crate::websocket::WsEvent::Connected => {
                    let mut debug = state_for_events.debug.lock();
                    debug.websocket_status = "connected".into();
                    debug.log("info", "WebSocket authenticated and connected");
                    let _ = app_for_events.emit("debug-telemetry", debug.clone());
                    let _ = app_for_events.emit("ws-connected", true);
                }
                crate::websocket::WsEvent::Disconnected => {
                    let mut debug = state_for_events.debug.lock();
                    debug.websocket_status = "disconnected".into();
                    debug.log("warn", "WebSocket disconnected; reconnect scheduled");
                    let _ = app_for_events.emit("debug-telemetry", debug.clone());
                    let _ = app_for_events.emit("ws-disconnected", true);
                }
                crate::websocket::WsEvent::MessageSent { kind, at } => {
                    let mut debug = state_for_events.debug.lock();
                    if kind == "heartbeat" {
                        debug.last_heartbeat_at = Some(at);
                    }
                    if kind == "state_change" {
                        debug.last_state_sent_at = Some(at);
                    }
                    debug.log("info", format!("WebSocket sent: {kind}"));
                    let _ = app_for_events.emit("debug-telemetry", debug.clone());
                }
                crate::websocket::WsEvent::MessageReceived { kind, at } => {
                    let mut debug = state_for_events.debug.lock();
                    debug.last_message_received_at = Some(at);
                    debug.log("info", format!("WebSocket received: {kind}"));
                    let _ = app_for_events.emit("debug-telemetry", debug.clone());
                }
                crate::websocket::WsEvent::Error(msg) => {
                    state_for_events.debug.lock().error(msg.clone());
                    let _ = app_for_events.emit("ws-error", msg);
                }
            }
        }
    });

    let state_for_poll = state.clone();
    let app_for_poll = app.clone();
    tauri::async_runtime::spawn(async move {
        let mut heartbeat = 0u32;
        loop {
            tokio::select! {
                _ = cancel_rx.recv() => {
                    break;
                }
                _ = tokio::time::sleep(std::time::Duration::from_secs(2)) => {
                    let active = {
                        let runtime = state_for_poll.runtime.lock();
                        runtime.is_active()
                    };
                    if !active {
                        break;
                    }

                    // Expiry check
                    {
                        let mut runtime = state_for_poll.runtime.lock();
                        if let Some(mem) = runtime.memory.as_ref() {
                            if mem.expires_at <= Utc::now() {
                                runtime.end();
                                runtime.clear_to_idle();
                                let _ = app_for_poll.emit("session-ended", "expired");
                                break;
                            }
                        }
                    }

                    let info = match state_for_poll.provider.lock().current() {
                        Ok(info) => info,
                        Err(error) => {
                            tracing::error!(%error, "foreground detection failed");
                            let mut debug = state_for_poll.debug.lock();
                            debug.error(error.clone());
                            let _ = app_for_poll.emit("detection-error", error);
                            let _ = app_for_poll.emit("debug-telemetry", debug.clone());
                            continue;
                        }
                    };
                    {
                        let mut debug = state_for_poll.debug.lock();
                        if let Some(info) = info.as_ref() {
                            tracing::info!(
                                current_app = info.display_name,
                                process_name = info.process_name,
                                "real foreground application detected"
                            );
                            debug.set_foreground(info);
                            debug.log(
                                "info",
                                format!(
                                    "Foreground detected: {} ({})",
                                    info.display_name, info.process_name
                                ),
                            );
                        } else {
                            debug.clear_foreground();
                            debug.log("warn", "No active foreground window detected");
                        }
                        let _ = app_for_poll.emit("debug-telemetry", debug.clone());
                    }
                    let maybe_snap = {
                        let mut runtime = state_for_poll.runtime.lock();
                        let config = runtime
                            .memory
                            .as_ref()
                            .map(|m| m.config.clone())
                            .unwrap_or_default();
                        runtime.machine.evaluate(info.as_ref(), &config)
                    };

                    if let Some(snap) = maybe_snap {
                        tracing::info!(
                            state = ?snap.state,
                            current_app = snap.current_app,
                            process_name = snap.process_name,
                            "focus state changed"
                        );
                        {
                            let mut debug = state_for_poll.debug.lock();
                            debug.current_state = snap.state;
                            debug.log("info", format!("Focus state changed: {:?}", snap.state));
                            let _ = app_for_poll.emit("debug-telemetry", debug.clone());
                        }
                        let _ = app_for_poll.emit("focus-state", &snap);
                        if snap.state == FocusState::BlockedAppDetected {
                            crate::notifications::notify_blocked_app(
                                snap.current_app.as_deref().unwrap_or("blocked app"),
                            );
                            if let Some(process) = snap.process_name.as_deref() {
                                crate::notifications::handle_blocked_app(process);
                            }
                            let _ = app_for_poll.emit(
                                "blocked-app",
                                snap.current_app.clone().unwrap_or_default(),
                            );
                            use tauri_plugin_notification::NotificationExt;
                            let _ = app_for_poll
                                .notification()
                                .builder()
                                .title("Lesson in progress")
                                .body("Please return to an allowed lesson application.")
                                .show();
                        }
                        let ws_tx = state_for_poll.ws_tx.lock().clone();
                        if let Some(tx) = ws_tx {
                            let _ = tx.send(crate::websocket::WsCommand::SendState(snap)).await;
                        }
                    }

                    heartbeat += 1;
                    if heartbeat % 15 == 0 {
                        let ws_tx = state_for_poll.ws_tx.lock().clone();
                        if let Some(tx) = ws_tx {
                            let _ = tx.send(crate::websocket::WsCommand::Heartbeat).await;
                        }
                    }
                }
            }
        }

        // Ensure idle after loop
        let shutdown_tx = state_for_poll.ws_tx.lock().take();
        if let Some(tx) = shutdown_tx {
            let _ = tx.send(crate::websocket::WsCommand::Shutdown).await;
        }
        state_for_poll.runtime.lock().clear_to_idle();
    });
}

/// Expose SessionRuntime for tests via crate root.
pub type _Runtime = SessionRuntime;
