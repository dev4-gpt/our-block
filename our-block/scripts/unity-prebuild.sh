#!/usr/bin/env bash
set -euo pipefail
# Unity Build Automation runs this from the repository checkout.
cd "$(dirname "$0")/../.."
if [ ! -f our-block/unity/Packages/manifest.json ]; then
  echo 'Run from the repository root.' >&2
  exit 1
fi
# Content is committed from npm run export:unity; no Node installation needed on builders.
test -s our-block/unity/Assets/Resources/Content.json
# Enable the Input System before editor script compilation, not during export.
settings=our-block/unity/ProjectSettings/ProjectSettings.asset
if [ ! -f "$settings" ]; then
  cat > "$settings" <<'YAML'
%YAML 1.1
%TAG !u! tag:unity3d.com,2011:
--- !u!129 &1
PlayerSettings:
  m_ObjectHideFlags: 0
  companyName: Our Block
  productName: OUR BLOCK
  activeInputHandler: 2
YAML
fi
