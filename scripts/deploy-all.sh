#!/bin/bash
# Deploy pipeline: develop → preprod → main → Lovable → back to develop
# Usage: npm run deploy:all
# Add --skip-lovable to skip Lovable sync
# Add --dry-run to preview what would happen

set -e

YELLOW='\033[1;33m'
GREEN='\033[1;32m'
RED='\033[1;31m'
NC='\033[0m'

SKIP_LOVABLE=false
DRY_RUN=false

for arg in "$@"; do
  case $arg in
    --skip-lovable) SKIP_LOVABLE=true ;;
    --dry-run) DRY_RUN=true ;;
  esac
done

# Must be on develop
BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null)
if [ "$BRANCH" != "develop" ]; then
  echo -e "${RED}ERROR: You must be on 'develop' branch (currently on '$BRANCH')${NC}"
  exit 1
fi

# Must have clean working tree
if [ -n "$(git status --porcelain)" ]; then
  echo -e "${RED}ERROR: You have uncommitted changes. Commit and push first.${NC}"
  git status --short
  exit 1
fi

# Must be pushed
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/develop 2>/dev/null || echo "none")
if [ "$LOCAL" != "$REMOTE" ]; then
  echo -e "${RED}ERROR: Local develop is ahead of origin. Push first: git push origin develop${NC}"
  exit 1
fi

if [ "$DRY_RUN" = true ]; then
  echo -e "${YELLOW}DRY RUN — would deploy these commits to preprod → main → Lovable:${NC}"
  git log origin/main..develop --oneline
  exit 0
fi

echo -e "${YELLOW}=== Deploying develop → preprod → main ===${NC}"
echo ""

# Step 1: preprod
echo -e "${GREEN}[1/5] Merging develop → preprod...${NC}"
git checkout preprod
git merge develop
git push origin preprod

# Step 2: main
echo -e "${GREEN}[2/5] Merging preprod → main (PRODUCTION)...${NC}"
read -p "$(echo -e ${YELLOW}Deploy to PRODUCTION? [y/N]: ${NC})" confirm
if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
  echo -e "${RED}Aborted. You're on preprod — run 'git checkout develop' to go back.${NC}"
  exit 1
fi
git checkout main
git merge preprod
git push origin main

# Step 3: Lovable
if [ "$SKIP_LOVABLE" = false ]; then
  echo -e "${GREEN}[3/5] Syncing to Lovable...${NC}"
  npm run update:lovable
else
  echo -e "${YELLOW}[3/5] Skipping Lovable sync (--skip-lovable)${NC}"
fi

# Step 4: Back to develop
echo -e "${GREEN}[4/5] Switching back to develop...${NC}"
git checkout develop

# Done
echo ""
echo -e "${GREEN}[5/5] Done! All deployed and back on develop.${NC}"
