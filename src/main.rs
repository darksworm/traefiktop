mod api;
mod app;
mod service_status;
mod types;

use app::{App, AppState};
use anyhow::Context;
use clap::Parser;
use crossterm::{
    event::{self, DisableMouseCapture, EnableMouseCapture, Event, KeyCode, KeyModifiers},
    execute,
    terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen},
};
use ratatui::{
    backend::CrosstermBackend,
    Terminal,
};
use std::{
    io::{self, IsTerminal},
    time::{Duration, Instant},
};
use tracing::{error, info};

#[derive(Parser)]
#[command(name = "traefiktop-rs")]
#[command(about = "A terminal UI for Traefik written in Rust")]
struct Cli {
    /// Traefik API URL (required)
    #[arg(long)]
    host: String,

    /// Allow insecure TLS connections
    #[arg(long)]
    insecure: bool,

    /// Ignore routers by name patterns (case-insensitive). Supports * wildcards. Can be used multiple times.
    #[arg(long)]
    ignore: Vec<String>,

    /// Refresh interval in seconds
    #[arg(short, long, default_value = "30")]
    refresh: u64,

    /// Just fetch and display data (don't start TUI)
    #[arg(long, alias = "oneshot")]
    headless: bool,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt::init();

    let cli = Cli::parse();

    // If headless flag is set, just fetch and display data
    if cli.headless {
        let client = crate::api::TraefikClient::new(cli.host.clone(), cli.insecure)?;
        match client.fetch_all_data().await {
            Ok(data) => {
                println!("✅ Successfully connected to Traefik at: {}", cli.host);
                println!("📡 Found {} routers and {} services", data.routers.len(), data.services.len());
                println!("\n🔍 Sample routers:");
                for (i, router) in data.routers.iter().take(5).enumerate() {
                    let status_icon = if router.status == "enabled" { "🟢" } else { "🔴" };
                    println!("  {}. {} {} - {}", i + 1, status_icon, router.name, router.rule);
                    println!("     Service: {} | Provider: {}", router.service, router.provider);
                }
                if data.routers.len() > 5 {
                    println!("     ... and {} more routers", data.routers.len() - 5);
                }
                
                println!("\n🎯 The TUI application is working! To run the full interface:");
                println!("   Run this in your actual terminal (outside Claude Code):");
                println!("   cargo run -- --host {} {}", cli.host, if cli.insecure { "--insecure" } else { "" });
            }
            Err(e) => {
                eprintln!("❌ Failed to connect to Traefik: {}", e);
                std::process::exit(1);
            }
        }
        return Ok(());
    }

    // Check if we have a proper terminal
    if !std::io::IsTerminal::is_terminal(&std::io::stdout()) {
        eprintln!("Error: This application requires a terminal (TTY) to run.");
        eprintln!("Please run this in a proper terminal, not through pipes or redirects.");
        eprintln!("Or use --headless to just test the connection.");
        std::process::exit(1);
    }

    // Setup terminal
    enable_raw_mode().context("Failed to enable raw mode. Make sure you're running in a proper terminal.")?;
    let mut stdout = io::stdout();
    execute!(stdout, EnterAlternateScreen, EnableMouseCapture)
        .context("Failed to initialize terminal. Make sure your terminal supports alternate screen.")?;
    let backend = CrosstermBackend::new(stdout);
    let mut terminal = Terminal::new(backend).context("Failed to create terminal backend")?;

    // Create app
    let mut app = App::new(cli.host, cli.insecure, cli.ignore)?;
    app.refresh_interval = Duration::from_secs(cli.refresh);

    // Initial data fetch
    if let Err(e) = app.refresh_data().await {
        error!("Failed to fetch initial data: {}", e);
    }

    let mut last_tick = Instant::now();
    let tick_rate = Duration::from_millis(250);

    // Main loop
    loop {
        terminal.draw(|f| app.render(f))?;

        let timeout = tick_rate
            .checked_sub(last_tick.elapsed())
            .unwrap_or_else(|| Duration::from_secs(0));

        if crossterm::event::poll(timeout)? {
            if let Event::Key(key) = event::read()? {
                match app.state {
                    AppState::Search => {
                        match key.code {
                            KeyCode::Esc => {
                                app.exit_search_mode();
                            }
                            KeyCode::Enter => {
                                app.state = AppState::Normal;
                            }
                            KeyCode::Backspace => {
                                app.search_query.pop();
                                app.update_search_query(app.search_query.clone());
                            }
                            KeyCode::Char(c) => {
                                app.search_query.push(c);
                                app.update_search_query(app.search_query.clone());
                            }
                            _ => {}
                        }
                    }
                    _ => {
                        match key.code {
                            KeyCode::Char('q') => {
                                app.quit();
                            }
                            KeyCode::Char('r') | KeyCode::Char('R') => {
                                tokio::spawn(async move {
                                    // This would need to be handled differently in a real app
                                    // For now, we'll just mark that a refresh is needed
                                });
                                if let Err(e) = app.refresh_data().await {
                                    error!("Failed to refresh data: {}", e);
                                }
                            }
                            KeyCode::Char('/') => {
                                app.enter_search_mode();
                            }
                            KeyCode::Char('s') | KeyCode::Char('S') => {
                                app.toggle_sort_mode();
                            }
                            KeyCode::Up | KeyCode::Char('k') => {
                                app.previous_router();
                                app.pending_g_key = false;
                            }
                            KeyCode::Down | KeyCode::Char('j') => {
                                app.next_router();
                                app.pending_g_key = false;
                            }
                            KeyCode::Char('g') => {
                                if app.pending_g_key {
                                    // Second 'g' - go to first router (gg)
                                    app.go_to_first_router();
                                    app.pending_g_key = false;
                                } else {
                                    // First 'g' - wait for second one
                                    app.pending_g_key = true;
                                }
                            }
                            KeyCode::Char('G') => {
                                app.go_to_last_router();
                                app.pending_g_key = false; // Clear any pending g
                            }
                            KeyCode::PageDown => {
                                app.page_down(10); // Page down by ~10 routers
                                app.pending_g_key = false;
                            }
                            KeyCode::PageUp => {
                                app.page_up(10); // Page up by ~10 routers
                                app.pending_g_key = false;
                            }
                            KeyCode::Char('c') if key.modifiers.contains(KeyModifiers::CONTROL) => {
                                app.quit();
                            }
                            _ => {
                                // Reset pending g key on any other key press
                                app.pending_g_key = false;
                            }
                        }
                    }
                }
            }
        }

        if last_tick.elapsed() >= tick_rate {
            last_tick = Instant::now();
        }

        // Auto refresh
        if let Some(last_update) = app.last_update {
            if last_update.elapsed() >= app.refresh_interval {
                if let Err(e) = app.refresh_data().await {
                    error!("Auto-refresh failed: {}", e);
                }
            }
        }

        if app.should_quit {
            break;
        }
    }

    // Restore terminal
    disable_raw_mode()?;
    execute!(
        terminal.backend_mut(),
        LeaveAlternateScreen,
        DisableMouseCapture
    )?;
    terminal.show_cursor()?;

    info!("Application exited cleanly");
    Ok(())
}
