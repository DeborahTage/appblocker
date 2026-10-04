pub mod commands;
pub mod config;
pub mod debug;
pub mod foreground;
pub mod notifications;
pub mod session;
pub mod state;
pub mod websocket;

use debug::DebugTelemetry;
use foreground::{platform_provider, ForegroundProvider};
use parking_lot::Mutex;
use session::SessionRuntime;
use std::sync::Arc;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, WindowEvent,
};
use tokio::sync::mpsc;
use websocket::WsCommand;

#[derive(Clone)]
pub struct AppState {
    pub consented: Arc<Mutex<bool>>,
    pub runtime: Arc<Mutex<SessionRuntime>>,
    pub provider: Arc<Mutex<Box<dyn ForegroundProvider>>>,
    pub debug: Arc<Mutex<DebugTelemetry>>,
    pub ws_tx: Arc<Mutex<Option<mpsc::Sender<WsCommand>>>>,
    pub cancel: Arc<Mutex<Option<mpsc::Sender<()>>>>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()),
        )
        .init();

    let provider = platform_provider();
    let capability = provider.capability();
    tracing::info!(
        platform = capability.platform,
        session_type = capability.session_type,
        supported = capability.supported,
        data_source = capability.data_source,
        "foreground detection capability"
    );

    let state = AppState {
        consented: Arc::new(Mutex::new(false)),
        runtime: Arc::new(Mutex::new(SessionRuntime::new())),
        provider: Arc::new(Mutex::new(provider)),
        debug: Arc::new(Mutex::new(DebugTelemetry::new(capability))),
        ws_tx: Arc::new(Mutex::new(None)),
        cancel: Arc::new(Mutex::new(None)),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .manage(state)
        .setup(|app| {
            let status_i =
                MenuItem::with_id(app, "status", "Current Status: Idle", false, None::<&str>)?;
            let time_i = MenuItem::with_id(app, "time", "Session Time: —", false, None::<&str>)?;
            let leave_i = MenuItem::with_id(app, "leave", "Leave Session", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&status_i, &time_i, &leave_i, &quit_i])?;

            let _tray = TrayIconBuilder::new()
                .menu(&menu)
                .tooltip("FocusMentor")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "leave" => {
                        let state = app.state::<AppState>();
                        let state = state.inner().clone();
                        tauri::async_runtime::spawn(async move {
                            let ws_tx = state.ws_tx.lock().take();
                            let cancel_tx = state.cancel.lock().take();
                            if let Some(tx) = ws_tx {
                                let _ = tx.send(WsCommand::Leave).await;
                            }
                            if let Some(cancel) = cancel_tx {
                                let _ = cancel.send(()).await;
                            }
                            state.runtime.lock().clear_to_idle();
                        });
                        let _ = app.emit("session-ended", "student_left");
                    }
                    "quit" => {
                        let state = app.state::<AppState>();
                        let state = state.inner().clone();
                        tauri::async_runtime::spawn(async move {
                            let ws_tx = state.ws_tx.lock().take();
                            let cancel_tx = state.cancel.lock().take();
                            if let Some(tx) = ws_tx {
                                let _ = tx.send(WsCommand::Shutdown).await;
                            }
                            if let Some(cancel) = cancel_tx {
                                let _ = cancel.send(()).await;
                            }
                            state.runtime.lock().clear_to_idle();
                        });
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { .. } = event {
                        if let Some(window) = tray.app_handle().get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                // Hide to tray instead of quitting — monitoring only runs in-session.
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_status,
            commands::set_consent,
            commands::join_session,
            commands::leave_session,
            commands::probe_foreground,
            commands::get_debug_telemetry,
        ])
        .run(tauri::generate_context!())
        .expect("error while running FocusMentor student agent");
}
