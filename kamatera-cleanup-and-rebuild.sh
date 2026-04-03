#!/bin/bash
# Kamatera Cleanup & Fresh Build Script
# Stops all Manthana services, cleans RAM/storage, provides rebuild commands

set -e

echo "=========================================="
echo "  Manthana Kamatera Cleanup & Rebuild"
echo "=========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    print_error "Please run as root (use sudo)"
    exit 1
fi

# =============================================================================
# PHASE 1: STOP ALL MANTHANA SERVICES
# =============================================================================
echo ""
echo "=========================================="
echo "  PHASE 1: Stopping All Services"
echo "=========================================="
echo ""

# Stop all Manthana Docker containers
print_status "Stopping all Manthana Docker containers..."
if docker ps -q | grep -q .; then
    docker stop $(docker ps -q --filter "name=manthana") 2>/dev/null || true
    docker stop $(docker ps -q --filter "name=searxng") 2>/dev/null || true
    docker stop $(docker ps -q --filter "name=meilisearch") 2>/dev/null || true
    docker stop $(docker ps -q --filter "name=elasticsearch") 2>/dev/null || true
    docker stop $(docker ps -q --filter "name=redis") 2>/dev/null || true
    docker stop $(docker ps -q --filter "name=qdrant") 2>/dev/null || true
    docker stop $(docker ps -q --filter "name=ollama") 2>/dev/null || true
    docker stop $(docker ps -q --filter "name=crawl4ai") 2>/dev/null || true
    docker stop $(docker ps -q --filter "name=traefik") 2>/dev/null || true
    docker stop $(docker ps -q --filter "name=loki") 2>/dev/null || true
    docker stop $(docker ps -q --filter "name=prometheus") 2>/dev/null || true
    print_success "All Manthana containers stopped"
else
    print_warning "No running containers found"
fi

# Stop frontend dev server
print_status "Stopping frontend dev server..."
pkill -f "next dev" 2>/dev/null || true
pkill -f "next-server" 2>/dev/null || true
print_success "Frontend dev server stopped"

# =============================================================================
# PHASE 2: CHECK RESOURCES
# =============================================================================
echo ""
echo "=========================================="
echo "  PHASE 2: Resource Status"
echo "=========================================="
echo ""

print_status "Current RAM Usage:"
free -h | grep -E "(Mem|Swap)"

echo ""
print_status "Current Storage Usage:"
df -h / | tail -1

echo ""
print_status "Docker Disk Usage:"
docker system df

# =============================================================================
# PHASE 3: CLEAN UP STORAGE (Safe Operations)
# =============================================================================
echo ""
echo "=========================================="
echo "  PHASE 3: Cleaning Storage (Safe)"
echo "=========================================="
echo ""

# Clean Python cache files
print_status "Cleaning Python __pycache__ and .pyc files..."
find /opt/manthana -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
find /opt/manthana -type f -name "*.pyc" -delete 2>/dev/null || true
find /opt/manthana -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
print_success "Python cache cleaned"

# Clean npm cache
print_status "Cleaning npm cache..."
npm cache clean --force 2>/dev/null || true
print_success "npm cache cleaned"

# Clean yarn cache if exists
if command -v yarn &> /dev/null; then
    print_status "Cleaning yarn cache..."
    yarn cache clean --all 2>/dev/null || true
    print_success "yarn cache cleaned"
fi

# Clean Docker build cache
print_status "Cleaning Docker build cache..."
docker builder prune -f 2>/dev/null || true
print_success "Docker build cache cleaned"

# Remove dangling Docker images (not used by any container)
print_status "Removing dangling Docker images..."
docker image prune -f 2>/dev/null || true
print_success "Dangling images removed"

# Remove unused Docker volumes (careful - only dangling)
print_status "Removing unused Docker volumes..."
docker volume prune -f 2>/dev/null || true
print_success "Unused volumes removed"

# Clean old logs
print_status "Cleaning old log files..."
find /var/log -type f -name "*.log.*" -mtime +7 -delete 2>/dev/null || true
find /var/log -type f -name "*.gz" -mtime +7 -delete 2>/dev/null || true
journalctl --vacuum-time=7d 2>/dev/null || true
print_success "Old logs cleaned"

# Clean /tmp
print_status "Cleaning /tmp directory..."
find /tmp -type f -atime +3 -delete 2>/dev/null || true
find /tmp -type d -atime +3 -exec rm -rf {} + 2>/dev/null || true
print_success "/tmp cleaned"

# =============================================================================
# PHASE 4: FREE UP RAM
# =============================================================================
echo ""
echo "=========================================="
echo "  PHASE 4: Freeing RAM"
echo "=========================================="
echo ""

# Clear page cache (safe - only clears cached disk data)
print_status "Clearing page cache..."
sync
echo 1 > /proc/sys/vm/drop_caches
print_success "Page cache cleared"

# Clear dentries and inodes (safe)
print_status "Clearing dentries and inodes..."
sync
echo 2 > /proc/sys/vm/drop_caches
print_success "Dentries and inodes cleared"

# Clear all caches (safe)
print_status "Clearing all caches..."
sync
echo 3 > /proc/sys/vm/drop_caches
print_success "All caches cleared"

# =============================================================================
# PHASE 5: STORAGE STATUS AFTER CLEANUP
# =============================================================================
echo ""
echo "=========================================="
echo "  PHASE 5: Resource Status After Cleanup"
echo "=========================================="
echo ""

print_status "RAM Usage After Cleanup:"
free -h | grep -E "(Mem|Swap)"

echo ""
print_status "Storage Usage After Cleanup:"
df -h / | tail -1

echo ""
print_status "Docker Usage After Cleanup:"
docker system df

# =============================================================================
# FRESH BUILD COMMANDS
# =============================================================================
echo ""
echo "=========================================="
echo "  FRESH BUILD COMMANDS (Copy & Run)"
echo "=========================================="
echo ""

cat << 'EOF'

# -------------------------------------------------
# 1. BUILD WEB SERVICE (Backend)
# -------------------------------------------------
cd /opt/manthana/services/web-service

# Option A: Build with Docker (recommended for production)
docker build -t manthana-web:latest \
  --build-arg SERVICE_VERSION=2.0.0 \
  -f Dockerfile .

# Option B: Run locally for development
# pip install -r requirements.txt
# python main.py

# -------------------------------------------------
# 2. BUILD FRONTEND
# -------------------------------------------------
cd /opt/manthana/frontend-manthana/manthana

# Install dependencies (if needed)
npm ci

# Build for production
npm run build

# Start production server
npm start

# OR run development server
# npm run dev

# -------------------------------------------------
# 3. START ALL SERVICES (Docker Compose)
# -------------------------------------------------
cd /opt/manthana

# Start infrastructure services first
docker compose up -d redis meilisearch searxng elasticsearch qdrant ollama

# Wait for infrastructure
sleep 10

# Start databases
docker compose up -d web-db oracle-db research-db analysis-db

# Wait for databases
sleep 5

# Start all Manthana services (excluding n8n)
docker compose up -d \
  manthana-web \
  manthana-oracle \
  manthana-ai-router \
  manthana-api \
  manthana-ayurveda \
  manthana-brain \
  manthana-cancer \
  manthana-drug \
  manthana-ecg \
  manthana-eye \
  manthana-imaging-utils \
  manthana-indexer \
  manthana-nlp \
  manthana-pathology \
  manthana-radiology \
  manthana-segmentation

# Start monitoring (optional)
docker compose up -d loki prometheus traefik

# -------------------------------------------------
# 4. VERIFY SERVICES
# -------------------------------------------------
docker compose ps

# Check logs
docker compose logs -f manthana-web

# -------------------------------------------------
# 5. N8N (KEEP AS STUB - DO NOT START)
# -------------------------------------------------
# n8n is kept as a stub and NOT started per requirements
# The container is defined in docker-compose.yml but
# should remain stopped to save resources
#
# To start n8n later (not recommended):
# docker compose up -d n8n

EOF

echo ""
echo "=========================================="
echo "  Cleanup Complete!"
echo "=========================================="
echo ""
print_success "All services stopped"
print_success "RAM and storage cleaned"
print_success "Fresh build commands provided above"
echo ""
print_status "Next steps:"
echo "  1. Review the build commands above"
echo "  2. Run the commands you need for fresh builds"
echo "  3. Use 'docker compose up -d' to start services"
echo ""

# Final resource status
echo "Final Resource Status:"
echo "---------------------"
echo "RAM:"
free -h | grep -E "Mem|Swap" | awk '{print "  " $0}'
echo ""
echo "Storage:"
df -h / | tail -1 | awk '{print "  " $0}'
