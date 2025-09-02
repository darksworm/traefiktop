// This is a fake Go file to satisfy GoReleaser build requirements
// The actual binary is built by Rust and copied in post-hooks
package main

import "fmt"

func main() {
	fmt.Println("This should never be executed - binary replaced by Rust version")
}