#!/usr/bin/env bash
# =============================================================================
# The paths a push must touch for the deploy workflow to build an image.
#
#   . ops/image-paths.sh
#   read -r -a IMAGE_PATHS <<<"$(image_paths)"
#
# READ OUT OF THE WORKFLOW, never typed here. There used to be a second copy of
# this list in ops/deploy-now.sh, written from memory, and it had already
# drifted: the workflow also builds for tests/server-e2e, the Dockerfile and the
# lockfile, and the copy knew about none of them. A commit touching only those
# built an image, the server took it, and the checker went looking for an older
# commit and reported the deploy as fine. Two lists cannot be kept in step by
# intention; one list does not need to be.
# =============================================================================

# Prints one path per line, with the `/**` suffix removed so the result is a
# usable git pathspec (`apps/**` matches nothing as a plain pathspec; `apps`
# matches the directory).
image_paths() {
  local root="${1:-.}"
  sed -n '/^  push:/,/^  workflow_dispatch:/p' "${root}/.github/workflows/deploy.yml" |
    sed -n 's/^      - "\([^"]*\)".*/\1/p' |
    sed 's|/\*\*$||'
}
