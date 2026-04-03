#!/bin/bash
# Production Readiness Verification Script
# Run this before deploying to production

set -e

echo "🔍 Manthana Deep Research - Production Readiness Check"
echo "======================================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASS=0
FAIL=0

# Function to print status
print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ PASS${NC}: $2"
        ((PASS++))
    else
        echo -e "${RED}❌ FAIL${NC}: $2"
        ((FAIL++))
    fi
}

print_warning() {
    echo -e "${YELLOW}⚠️  WARN${NC}: $1"
}

echo "1. Python Syntax Check"
echo "-----------------------"
python3 -m py_compile services/research-service/orchestrator.py 2>/dev/null
print_status $? "orchestrator.py compiles"

python3 -m py_compile services/research-service/main.py 2>/dev/null
print_status $? "main.py compiles"

echo ""
echo "2. Circuit Breakers Present"
echo "---------------------------"
grep -q "research_meilisearch_circuit" services/research-service/orchestrator.py
print_status $? "Meilisearch circuit breaker defined"

grep -q "research_qdrant_circuit" services/research-service/orchestrator.py
print_status $? "Qdrant circuit breaker defined"

grep -q "research_groq_circuit" services/research-service/orchestrator.py
print_status $? "Groq circuit breaker defined"

echo ""
echo "3. Database Migrations"
echo "----------------------"
test -f services/research-service/alembic.ini
print_status $? "alembic.ini exists"

test -f services/research-service/alembic/env.py
print_status $? "alembic/env.py exists"

python3 -m py_compile services/research-service/alembic/versions/*.py 2>/dev/null
print_status $? "Migration files compile"

echo ""
echo "4. Isolation Guarantees"
echo "-----------------------"
# Check no forbidden imports
if grep -r "from services.oracle" services/research-service/ 2>/dev/null; then
    print_status 1 "No oracle imports in research-service"
else
    print_status 0 "No oracle imports in research-service"
fi

if grep -r "from services.web" services/research-service/ 2>/dev/null; then
    print_status 1 "No web imports in research-service"
else
    print_status 0 "No web imports in research-service"
fi

if grep -r "from services.analysis" services/research-service/ 2>/dev/null; then
    print_status 1 "No analysis imports in research-service"
else
    print_status 0 "No analysis imports in research-service"
fi

echo ""
echo "5. Frontend TypeScript"
echo "----------------------"
cd frontend-manthana/manthana
if npx tsc --noEmit 2>/dev/null; then
    print_status 0 "TypeScript compiles without errors"
else
    print_status 1 "TypeScript compiles without errors"
fi
cd ../..

echo ""
echo "6. CI/CD Workflows"
echo "------------------"
test -f .github/workflows/research-contract-tests.yml
print_status $? "Research contract tests workflow exists"

if command -v yamllint &> /dev/null; then
    yamllint .github/workflows/research-contract-tests.yml 2>/dev/null
    print_status $? "Workflow YAML is valid"
else
    print_warning "yamllint not installed, skipping YAML validation"
fi

echo ""
echo "7. Environment Variables"
echo "------------------------"
# Check critical env vars are documented
if grep -q "RESEARCH_DATABASE_URL" services/research-service/config.py; then
    print_status 0 "RESEARCH_DATABASE_URL configured"
else
    print_status 1 "RESEARCH_DATABASE_URL configured"
fi

if grep -q "RESEARCH_GROQ_API_KEY" services/research-service/config.py; then
    print_status 0 "RESEARCH_GROQ_API_KEY configured"
else
    print_status 1 "RESEARCH_GROQ_API_KEY configured"
fi

echo ""
echo "======================================================"
echo "Results: ${GREEN}${PASS} passed${NC}, ${RED}${FAIL} failed${NC}"
echo ""

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}🎉 All checks passed! Production ready.${NC}"
    exit 0
else
    echo -e "${RED}⚠️  Some checks failed. Review before production deployment.${NC}"
    exit 1
fi
