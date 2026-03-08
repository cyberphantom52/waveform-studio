#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

if [[ -f package-lock.json ]]; then
  npm ci
else
  npm install
fi

if [[ "${VERIFY_PROJECT:-1}" == "1" ]]; then
  npm run lint
  npm run build
fi
