#!/usr/bin/env bash

set -x
set -e

# Ships current branch to gh-pages, clobbering whatever's currently there

DEPLOYABLE_FILES="index.html breakout.js"
PREVIOUS_REF=$(git rev-parse --abbrev-ref HEAD)

git branch -D gh-pages >/dev/null 2>&1 || true
git checkout --orphan gh-pages master
git rm --cached -r .
git add $DEPLOYABLE_FILES
git commit -m "Build of $(git rev-parse master)"
git push -f git@github.com:harto/breakout.git gh-pages
git clean -df
git checkout $PREVIOUS_REF
