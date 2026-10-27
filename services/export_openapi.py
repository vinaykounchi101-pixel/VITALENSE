"""CLI Script to Export the Versioned OpenAPI Specification.

Implements IF-API-001 and REPO-006:
Export the OpenAPI 3.1 specification to packages/api-contracts/openapi/v1.json
for contract testing and type generation.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

# Add project root and packages/python-common to path for standalone execution
ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR / "packages" / "python-common" / "src"))
sys.path.insert(0, str(ROOT_DIR))

from services.api.main import create_app


def export_openapi(output_path: Path) -> None:
    """Generate and write the OpenAPI schema JSON."""
    app = create_app()
    openapi_schema = app.openapi()

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(openapi_schema, f, indent=2)

    print(f"OpenAPI schema successfully exported to: {output_path}")


if __name__ == "__main__":
    default_output = (
        ROOT_DIR / "packages" / "api-contracts" / "openapi" / "v1.json"
    )
    target = (
        Path(sys.argv[1]) if len(sys.argv) > 1 else default_output
    )
    export_openapi(target)
