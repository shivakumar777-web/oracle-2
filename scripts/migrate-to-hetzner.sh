#!/bin/bash
# Migrate Manthana from Kamatera to Hetzner
# Usage:
#   On Kamatera: ./scripts/migrate-to-hetzner.sh export
#   On Hetzner:  ./scripts/migrate-to-hetzner.sh import
#   Transfer:   scp /tmp/manthana-migrate.tar.gz root@HETZNER_IP:/tmp/

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BUNDLE_DIR="/tmp/manthana-migrate"
BUNDLE_FILE="/tmp/manthana-migrate.tar.gz"

export_bundle() {
    echo "=== Exporting from Kamatera ==="
    cd "$REPO_ROOT"
    rm -rf "$BUNDLE_DIR" "$BUNDLE_FILE"
    mkdir -p "$BUNDLE_DIR"

    # Required: .env
    if [ -f .env ]; then
        cp .env "$BUNDLE_DIR/"
        echo "  + .env"
    else
        echo "  ! WARNING: .env not found"
    fi

    # Configs
    if [ -d configs ]; then
        cp -r configs "$BUNDLE_DIR/"
        echo "  + configs/"
    fi

    # Frontend auth (user accounts)
    if [ -f frontend-manthana/manthana/auth.db ]; then
        cp frontend-manthana/manthana/auth.db "$BUNDLE_DIR/"
        echo "  + auth.db"
    fi

    # Optional: Meilisearch
    if docker volume inspect manthana_meilisearch-data &>/dev/null; then
        docker run --rm -v manthana_meilisearch-data:/data -v "$BUNDLE_DIR":/out \
            alpine tar czf /out/meilisearch-data.tar.gz -C /data .
        echo "  + meilisearch-data.tar.gz"
    fi

    # Optional: Qdrant
    if docker volume inspect manthana_qdrant-data &>/dev/null; then
        docker run --rm -v manthana_qdrant-data:/data -v "$BUNDLE_DIR":/out \
            alpine tar czf /out/qdrant-data.tar.gz -C /data .
        echo "  + qdrant-data.tar.gz"
    fi

    cd /tmp
    tar czf "$BUNDLE_FILE" manthana-migrate
    rm -rf "$BUNDLE_DIR"
    echo ""
    echo "Done. Bundle: $BUNDLE_FILE"
    echo "Size: $(du -h "$BUNDLE_FILE" | cut -f1)"
    echo ""
    echo "Transfer to Hetzner:"
    echo "  scp $BUNDLE_FILE root@HETZNER_IP:/tmp/"
}

import_bundle() {
    echo "=== Importing on Hetzner ==="
    if [ ! -f "$BUNDLE_FILE" ]; then
        echo "Error: $BUNDLE_FILE not found. Transfer it first:"
        echo "  scp /tmp/manthana-migrate.tar.gz root@HETZNER_IP:/tmp/"
        exit 1
    fi

    cd "$REPO_ROOT"
    rm -rf "$BUNDLE_DIR"
    tar xzf "$BUNDLE_FILE" -C /tmp

    if [ -f "$BUNDLE_DIR/.env" ]; then
        cp "$BUNDLE_DIR/.env" .env
        echo "  + .env restored"
    fi

    if [ -d "$BUNDLE_DIR/configs" ]; then
        cp -r "$BUNDLE_DIR/configs"/* configs/ 2>/dev/null || true
        echo "  + configs restored"
    fi

    if [ -f "$BUNDLE_DIR/auth.db" ]; then
        mkdir -p frontend-manthana/manthana
        cp "$BUNDLE_DIR/auth.db" frontend-manthana/manthana/
        echo "  + auth.db restored"
    fi

    if [ -f "$BUNDLE_DIR/meilisearch-data.tar.gz" ]; then
        docker volume create manthana_meilisearch-data 2>/dev/null || true
        docker run --rm -v manthana_meilisearch-data:/data -v "$BUNDLE_DIR":/in \
            alpine sh -c "cd /data && tar xzf /in/meilisearch-data.tar.gz"
        echo "  + meilisearch-data restored"
    fi

    if [ -f "$BUNDLE_DIR/qdrant-data.tar.gz" ]; then
        docker volume create manthana_qdrant-data 2>/dev/null || true
        docker run --rm -v manthana_qdrant-data:/data -v "$BUNDLE_DIR":/in \
            alpine sh -c "cd /data && tar xzf /in/qdrant-data.tar.gz"
        echo "  + qdrant-data restored"
    fi

    rm -rf "$BUNDLE_DIR"
    echo ""
    echo "Done. Next:"
    echo "  1. Edit .env: DOMAIN, FRONTEND_URL"
    echo "  2. docker compose build && docker compose up -d"
    echo "  3. cd frontend-manthana/manthana && npm install && npm run build && npm run start"
}

case "${1:-}" in
    export) export_bundle ;;
    import) import_bundle ;;
    *)
        echo "Usage: $0 export|import"
        echo "  export - Run on Kamatera to create migration bundle"
        echo "  import - Run on Hetzner to restore from bundle"
        exit 1
        ;;
esac
