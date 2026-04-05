#!/bin/bash

# Test runner script for Agentic AI Chat App
# Provides easy commands for running different test suites

set -e

echo "🧪 Agentic AI Chat App - Test Runner"
echo "===================================="

# Ensure we're in the web directory
cd "$(dirname "$0")/.."

# Function to show usage
show_help() {
  echo "Usage: $0 [command]"
  echo ""
  echo "Commands:"
  echo "  all          Run all tests"
  echo "  ui           Run UI tests only"
  echo "  ux           Run UX tests only"
  echo "  chat         Run chat functionality tests"
  echo "  sidebar      Run sidebar tests only"
  echo "  input        Run input area tests only"
  echo "  visual       Run visual regression tests"
  echo "  performance  Run performance tests"
  echo "  headed       Run tests in headed mode (visible browser)"
  echo "  debug        Run tests in debug mode"
  echo "  report       Show last test report"
  echo "  video        Run tests with video recording"
  echo "  help         Show this help"
  echo ""
  echo "Examples:"
  echo "  $0 all"
  echo "  $0 ux"
  echo "  $0 visual -- --grep=\"visual snapshot\""
  exit 1
}

# Check if argument provided
if [ $# -eq 0 ]; then
  show_help
fi

COMMAND="$1"
shift

case "$COMMAND" in
  all)
    echo "🚀 Running all tests..."
    npm test -- "$@"
    ;;
  ui)
    echo "🎨 Running UI tests..."
    npm run test:ui -- "$@"
    ;;
  ux)
    echo "👁️  Running UX tests..."
    npm run test:ux -- "$@"
    ;;
  chat)
    echo "💬 Running chat tests..."
    npm run test:chat -- "$@"
    ;;
  sidebar)
    echo "📋 Running sidebar tests..."
    npm run test:sidebar -- "$@"
    ;;
  input)
    echo "⌨️  Running input tests..."
    npm run test:input -- "$@"
    ;;
  visual)
    echo "👁️‍🗨️  Running visual regression tests..."
    npm run test:visual -- "$@"
    ;;
  performance)
    echo "⚡ Running performance tests..."
    npm run test:performance -- "$@"
    ;;
  headed)
    echo "👓 Running tests in headed mode..."
    npm run test:headed -- "$@"
    ;;
  debug)
    echo "🐛 Running tests in debug mode..."
    npm run test:debug -- "$@"
    ;;
  report)
    echo "📊 Showing test report..."
    npm run test:report
    ;;
  video)
    echo "📹 Running tests with video recording..."
    npm run test:video -- "$@"
    ;;
  help)
    show_help
    ;;
  *)
    echo "❌ Unknown command: $COMMAND"
    show_help
    ;;
esac

echo "✅ Test run completed!"