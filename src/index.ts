#!/usr/bin/env node
// src/index.ts
// Aegis CLI entry point

const command = process.argv[2];

switch (command) {
  case "init":
    console.log("aegis init — not yet implemented");
    break;
  case "start":
    console.log("aegis start — not yet implemented");
    break;
  case "status":
    console.log("aegis status — not yet implemented");
    break;
  case "stop":
    console.log("aegis stop — not yet implemented");
    break;
  default:
    console.log("Usage: aegis <init|start|status|stop>");
    console.log("Run 'aegis init' to get started.");
    process.exit(1);
}