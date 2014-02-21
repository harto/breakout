#!/usr/bin/env bash

set -x
set -e

# Clobber gh-pages with files from current tree

DEPLOYABLE_FILES=$@
SHA=$(git rev-parse HEAD)
PREV_BRANCH=$(git rev-parse --abbrev-ref HEAD)

# Prepare pristine gh-pages branch
git branch -D gh-pages >/dev/null 2>&1 || true
git checkout --orphan gh-pages master
git rm --cached -r .

# Commit deployable files
git add $DEPLOYABLE_FILES

# Clobber remote gh-pages
git commit -m "Build $SHA"
git push -f git@github.com:harto/breakout.git gh-pages

# Return to previous branch
git clean -df
git checkout $PREV_BRANCH
