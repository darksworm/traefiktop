# traefiktop-rs

A terminal user interface for Traefik written in Rust using [Ratatui](https://ratatui.rs/).

This is a Rust implementation inspired by the original TypeScript/React+Ink version, providing the same functionality with better performance and lower resource usage.

## Features

- 📡 View all Traefik routers with their configuration
- 🔍 Search through routers by name, rule, or service  
- 📊 Hierarchical service view with failover detection
- ✅ Real-time service status indicators (✓/✗)
- 🔄 Auto-refresh data from Traefik API
- ⚡ Fast and lightweight terminal interface
- 🔒 Support for insecure TLS connections
- 🎯 Vim-style navigation (j/k keys)
- 🌳 Tree-structured display matching TypeScript version

## Installation

Make sure you have Rust installed, then:

```bash
git clone <repository>
cd traefiktop-rs
cargo install --path .
```

Or run directly:

```bash
cargo run -- --help
```

## Usage

```bash
# Connect to Traefik on localhost:8080
traefiktop-rs

# Connect to different Traefik instance
traefiktop-rs -a http://traefik.example.com:8080

# Allow insecure TLS connections
traefiktop-rs -a https://traefik.local:8080 --insecure

# Custom refresh interval (30 seconds default)
traefiktop-rs -r 10
```

### Keyboard Shortcuts

- `q` or `Ctrl+C` - Quit
- `r` or `R` - Refresh data
- `/` - Enter search mode
- `↑/↓` or `k/j` - Navigate routers (vim-style)
- `ESC` - Exit search mode

### Command Line Options

- `-a, --api-url <URL>` - Traefik API URL (default: http://localhost:8080)
- `--insecure` - Allow insecure TLS connections
- `-r, --refresh <SECONDS>` - Auto-refresh interval in seconds (default: 30)

## Requirements

- Traefik with API enabled
- Access to Traefik's HTTP API endpoint (usually `:8080/api`)

## Architecture

The application is structured into several modules:

- `types.rs` - Data structures matching Traefik's API
- `api.rs` - HTTP client for Traefik API
- `app.rs` - Application state and rendering logic
- `main.rs` - Entry point and event loop

Built with:

- [Ratatui](https://ratatui.rs/) - Terminal UI framework
- [Crossterm](https://github.com/crossterm-rs/crossterm) - Terminal handling
- [Tokio](https://tokio.rs/) - Async runtime
- [Reqwest](https://github.com/seanmonstar/reqwest) - HTTP client
- [Clap](https://github.com/clap-rs/clap) - Command line parsing

## Development

```bash
# Run in development
cargo run

# Run with logging
RUST_LOG=debug cargo run

# Build release version
cargo build --release

# Run tests
cargo test

# Check code
cargo check
```

## License

MIT License