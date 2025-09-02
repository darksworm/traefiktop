#!/bin/bash
set -e

echo "Installing cross-compilation targets..."

# Add targets for cross-compilation
rustup target add x86_64-unknown-linux-gnu
rustup target add aarch64-unknown-linux-gnu
rustup target add x86_64-apple-darwin
rustup target add aarch64-apple-darwin
rustup target add x86_64-unknown-linux-musl
rustup target add aarch64-unknown-linux-musl

# Install cross for easy cross-compilation
cargo install cross --git https://github.com/cross-rs/cross

echo "Cross-compiling for all targets..."

# Linux GNU targets
echo "Building for x86_64-unknown-linux-gnu..."
cargo build --release --target x86_64-unknown-linux-gnu

echo "Building for aarch64-unknown-linux-gnu..."
cross build --release --target aarch64-unknown-linux-gnu

# macOS targets (only on macOS or with proper setup)
if [[ "$OSTYPE" == "darwin"* ]] || command -v osxcross-clang &> /dev/null; then
    echo "Building for x86_64-apple-darwin..."
    cargo build --release --target x86_64-apple-darwin
    
    echo "Building for aarch64-apple-darwin..."
    cargo build --release --target aarch64-apple-darwin
else
    echo "Skipping macOS targets (not on macOS or osxcross not available)"
    # Create dummy files for GoReleaser
    mkdir -p target/x86_64-apple-darwin/release target/aarch64-apple-darwin/release
    echo "dummy" > target/x86_64-apple-darwin/release/traefiktop
    echo "dummy" > target/aarch64-apple-darwin/release/traefiktop
fi

# Linux musl targets
echo "Building for x86_64-unknown-linux-musl..."
cross build --release --target x86_64-unknown-linux-musl

echo "Building for aarch64-unknown-linux-musl..."
cross build --release --target aarch64-unknown-linux-musl

echo "Cross-compilation complete!"