//! Session-scoped WebSocket client with exponential backoff reconnect.
//! Backoff: 1, 2, 4, 8, 16, 30s max. Stops when session ends/expires.

use crate::state::{FocusState, StateSnapshot};
use futures_util::{SinkExt, StreamExt};
use serde_json::json;
use tokio::sync::mpsc;
use tokio_tungstenite::{connect_async, tungstenite::Message};
use tracing::{info, warn};

#[derive(Debug, Clone)]
pub enum WsCommand {
    SendState(StateSnapshot),
    Heartbeat,
    Leave,
    Shutdown,
}

#[derive(Debug, Clone)]
pub enum WsEvent {
    Connecting,
    Connected,
    Disconnected,
    MessageSent {
        kind: String,
        at: chrono::DateTime<chrono::Utc>,
    },
    MessageReceived {
        kind: String,
        at: chrono::DateTime<chrono::Utc>,
    },
    SessionEnded {
        reason: String,
    },
    ConfigUpdate(serde_json::Value),
    Error(String),
}

pub fn backoff_seconds(attempt: u32) -> u64 {
    match attempt {
        0 => 1,
        1 => 2,
        2 => 4,
        3 => 8,
        4 => 16,
        _ => 30,
    }
}

pub async fn run_client(
    ws_url: String,
    session_id: String,
    token: String,
    mut commands: mpsc::Receiver<WsCommand>,
    events: mpsc::Sender<WsEvent>,
) {
    let mut attempt = 0u32;
    let mut latest_state: Option<StateSnapshot> = None;
    loop {
        let _ = events.send(WsEvent::Connecting).await;
        match connect_and_serve(
            &ws_url,
            &session_id,
            &token,
            &mut commands,
            &events,
            &mut latest_state,
        )
        .await
        {
            Ok(StopReason::Shutdown) | Ok(StopReason::SessionEnded) => break,
            Ok(StopReason::Disconnected) | Err(_) => {
                let _ = events.send(WsEvent::Disconnected).await;
                let delay = backoff_seconds(attempt);
                attempt = attempt.saturating_add(1);
                info!(delay, "websocket reconnect scheduled");
                tokio::select! {
                    cmd = commands.recv() => {
                        match cmd {
                            Some(WsCommand::Shutdown) | Some(WsCommand::Leave) | None => break,
                            Some(WsCommand::SendState(state)) => latest_state = Some(state),
                            Some(_) => {}
                        }
                    }
                    _ = tokio::time::sleep(std::time::Duration::from_secs(delay)) => {}
                }
            }
        }
    }
}

enum StopReason {
    Shutdown,
    SessionEnded,
    Disconnected,
}

async fn connect_and_serve(
    ws_url: &str,
    session_id: &str,
    token: &str,
    commands: &mut mpsc::Receiver<WsCommand>,
    events: &mpsc::Sender<WsEvent>,
    latest_state: &mut Option<StateSnapshot>,
) -> Result<StopReason, Box<dyn std::error::Error + Send + Sync>> {
    let (ws, _) = connect_async(ws_url).await?;
    let (mut write, mut read) = ws.split();

    let join = json!({
        "type": "join_session",
        "sessionId": session_id,
        "token": token,
        "clientType": "native_student_agent",
    });
    write.send(Message::Text(join.to_string().into())).await?;
    info!(session_id, "websocket join_session sent");
    let _ = events
        .send(WsEvent::MessageSent {
            kind: "join_session".into(),
            at: chrono::Utc::now(),
        })
        .await;

    loop {
        tokio::select! {
            msg = read.next() => {
                match msg {
                    Some(Ok(Message::Text(text))) => {
                        if let Ok(value) = serde_json::from_str::<serde_json::Value>(&text) {
                            let ty = value.get("type").and_then(|v| v.as_str()).unwrap_or("");
                            info!(message_type = ty, "websocket message received");
                            let _ = events
                                .send(WsEvent::MessageReceived {
                                    kind: ty.to_string(),
                                    at: chrono::Utc::now(),
                                })
                                .await;
                            match ty {
                                "join_ack" => {
                                    attempt_send_latest(&mut write, latest_state, events).await?;
                                    let _ = events.send(WsEvent::Connected).await;
                                }
                                "session_end" => {
                                    let reason = value
                                        .get("reason")
                                        .and_then(|v| v.as_str())
                                        .unwrap_or("ended")
                                        .to_string();
                                    let _ = events.send(WsEvent::SessionEnded { reason }).await;
                                    return Ok(StopReason::SessionEnded);
                                }
                                "config_update" => {
                                    if let Some(cfg) = value.get("config").cloned() {
                                        let _ = events.send(WsEvent::ConfigUpdate(cfg)).await;
                                    }
                                }
                                "error" => {
                                    let message = value
                                        .get("message")
                                        .and_then(|v| v.as_str())
                                        .unwrap_or("error")
                                        .to_string();
                                    let _ = events.send(WsEvent::Error(message)).await;
                                }
                                _ => {}
                            }
                        }
                    }
                    Some(Ok(Message::Close(_))) | None => return Ok(StopReason::Disconnected),
                    Some(Err(err)) => {
                        warn!(?err, "websocket read error");
                        return Ok(StopReason::Disconnected);
                    }
                    _ => {}
                }
            }
            cmd = commands.recv() => {
                match cmd {
                    Some(WsCommand::SendState(snap)) => {
                        *latest_state = Some(snap.clone());
                        let payload = json!({
                            "type": "state_change",
                            "state": focus_state_str(snap.state),
                            "currentApp": snap.current_app,
                            "processName": snap.process_name,
                            "timestamp": chrono::Utc::now().to_rfc3339(),
                        });
                        write
                            .send(Message::Text(payload.to_string().into()))
                            .await?;
                        info!(
                            state = focus_state_str(snap.state),
                            current_app = snap.current_app,
                            process_name = snap.process_name,
                            "websocket state_change sent"
                        );
                        let _ = events
                            .send(WsEvent::MessageSent {
                                kind: "state_change".into(),
                                at: chrono::Utc::now(),
                            })
                            .await;
                    }
                    Some(WsCommand::Heartbeat) => {
                        let payload = json!({
                            "type": "heartbeat",
                            "timestamp": chrono::Utc::now().to_rfc3339(),
                        });
                        write
                            .send(Message::Text(payload.to_string().into()))
                            .await?;
                        info!("websocket heartbeat sent");
                        let _ = events
                            .send(WsEvent::MessageSent {
                                kind: "heartbeat".into(),
                                at: chrono::Utc::now(),
                            })
                            .await;
                    }
                    Some(WsCommand::Leave) => {
                        let _ = write
                            .send(Message::Text(json!({"type":"leave_session"}).to_string().into()))
                            .await;
                        return Ok(StopReason::Shutdown);
                    }
                    Some(WsCommand::Shutdown) | None => return Ok(StopReason::Shutdown),
                }
            }
        }
    }
}

async fn attempt_send_latest<S>(
    write: &mut S,
    latest_state: &Option<StateSnapshot>,
    events: &mpsc::Sender<WsEvent>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>>
where
    S: futures_util::Sink<Message> + Unpin,
    S::Error: std::error::Error + Send + Sync + 'static,
{
    let Some(snapshot) = latest_state else {
        return Ok(());
    };
    let payload = json!({
        "type": "state_change",
        "state": focus_state_str(snapshot.state),
        "currentApp": snapshot.current_app,
        "processName": snapshot.process_name,
        "timestamp": chrono::Utc::now().to_rfc3339(),
    });
    write
        .send(Message::Text(payload.to_string().into()))
        .await?;
    info!("latest real state sent after websocket join acknowledgement");
    let _ = events
        .send(WsEvent::MessageSent {
            kind: "state_change".into(),
            at: chrono::Utc::now(),
        })
        .await;
    Ok(())
}

fn focus_state_str(state: FocusState) -> &'static str {
    match state {
        FocusState::Disconnected => "Disconnected",
        FocusState::Waiting => "Waiting",
        FocusState::OnTask => "OnTask",
        FocusState::Away => "Away",
        FocusState::BlockedAppDetected => "BlockedAppDetected",
        FocusState::SessionEnded => "SessionEnded",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn backoff_caps_at_30() {
        assert_eq!(backoff_seconds(0), 1);
        assert_eq!(backoff_seconds(5), 30);
        assert_eq!(backoff_seconds(100), 30);
    }
}
