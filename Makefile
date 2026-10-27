# =============================================================================
# VitalSense Monorepo Makefile
# =============================================================================
# NOTE FOR WINDOWS USERS:
# These targets can be run using GNU Make (via Git Bash, MSYS2, or chocolatey/winget 'make').
# Equivalent direct PowerShell commands are noted in comments for every target.
# =============================================================================

.DEFAULT_GOAL := help
.PHONY: help info lint format typecheck test clean

help:
	@echo "============================================================================="
	@echo "VitalSense Developer Command Interface"
	@echo "============================================================================="
	@echo "Available targets:"
	@echo "  make info       - Display workspace and toolchain status"
	@echo "  make lint       - Run static analysis and style checkers (Ruff)"
	@echo "  make format     - Automatically format code (Ruff)"
	@echo "  make typecheck  - Run static type checking (Mypy)"
	@echo "  make test       - Run automated test suite (Pytest)"
	@echo "  make clean      - Remove build caches, temp files, and pycache"
	@echo "============================================================================="

info:
	@echo "VitalSense Monorepo Workspace Initialized"
	@echo "Active Specification: VitalSense SRS v1.1.1 (Merged)"
	@echo "Roadmap Phase: Phase 0 Foundation"
	@python --version
	@node -v

# PowerShell equivalent: ruff check .
lint:
	@echo "Running Python static analysis (Ruff)..."
	ruff check .

# PowerShell equivalent: ruff format .
format:
	@echo "Running Python code formatting (Ruff)..."
	ruff format .

# PowerShell equivalent: mypy .
typecheck:
	@echo "Running Python type checking (Mypy)..."
	mypy .

# PowerShell equivalent: pytest
test:
	@echo "Running test suite (Pytest)..."
	pytest

# PowerShell equivalent:
# Get-ChildItem -Path . -Include __pycache__,.pytest_cache,.mypy_cache,.ruff_cache -Recurse -Directory | Remove-Item -Recurse -Force
clean:
	@echo "Cleaning temporary caches..."
	@python -c "import shutil, pathlib; [shutil.rmtree(p, ignore_errors=True) for p in pathlib.Path('.').rglob('__pycache__')]"
	@python -c "import shutil, pathlib; [shutil.rmtree(p, ignore_errors=True) for p in pathlib.Path('.').glob('.*_cache')]"
	@echo "Clean completed."
