#!/bin/bash

# pgTAP Test Runner for RLS Policies and Database Functions
# This script runs comprehensive pgTAP tests for the billing integration system

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧪 Starting Comprehensive Database Tests...${NC}"

# Check if Supabase is running
if ! curl -s http://localhost:54321/health > /dev/null; then
    echo -e "${RED}Error: Supabase is not running. Please start it with 'supabase start'${NC}"
    exit 1
fi

# Database connection details
DB_HOST="localhost"
DB_PORT="54322"
DB_NAME="postgres"
DB_USER="postgres"
DB_PASSWORD="postgres"

# Check if pgTAP is installed
echo -e "${YELLOW}Checking pgTAP installation...${NC}"
PGTAP_CHECK=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pgtap');" 2>/dev/null || echo "f")

if [ "$PGTAP_CHECK" = " f" ]; then
    echo -e "${YELLOW}Installing pgTAP extension...${NC}"
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "CREATE EXTENSION IF NOT EXISTS pgtap;" || {
        echo -e "${RED}Failed to install pgTAP. Make sure you have the pgtap extension available.${NC}"
        echo -e "${YELLOW}You may need to install it with: apt-get install postgresql-contrib${NC}"
        echo -e "${YELLOW}On macOS with Homebrew: brew install pgtap${NC}"
        echo -e "${YELLOW}On Ubuntu/Debian: apt-get install postgresql-contrib${NC}"
        exit 1
    }
fi

# Create tests schema if it doesn't exist
echo -e "${YELLOW}Setting up test environment...${NC}"
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "CREATE SCHEMA IF NOT EXISTS tests;"

# Function to run a test file and check results
run_test_file() {
    local test_file="$1"
    local test_name="$2"
    
    echo -e "${YELLOW}Running $test_name...${NC}"
    
    local test_result
    test_result=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$test_file" 2>&1)
    
    if echo "$test_result" | grep -q "All tests successful"; then
        echo -e "${GREEN}✅ $test_name passed!${NC}"
        return 0
    else
        echo -e "${RED}❌ $test_name failed:${NC}"
        echo "$test_result"
        return 1
    fi
}

# Track overall test results
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Run RLS Policy Tests
echo -e "\n${BLUE}=== RLS Policy Tests ===${NC}"
if run_test_file "$(dirname "$0")/database_test.sql" "RLS Policy Tests"; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

# Run Database Function Tests
echo -e "\n${BLUE}=== Database Function Tests ===${NC}"
if run_test_file "$(dirname "$0")/functions_test.sql" "Database Function Tests"; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

# Print summary
echo -e "\n${BLUE}=== Test Summary ===${NC}"
echo -e "Total test suites: $TOTAL_TESTS"
echo -e "${GREEN}Passed: $PASSED_TESTS${NC}"
if [ $FAILED_TESTS -gt 0 ]; then
    echo -e "${RED}Failed: $FAILED_TESTS${NC}"
fi

# Exit with appropriate code
if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "\n${GREEN}🎉 All database tests passed successfully!${NC}"
    echo -e "${GREEN}RLS policies are properly configured and database functions work correctly.${NC}"
    exit 0
else
    echo -e "\n${RED}💥 Some tests failed. Please review the output above.${NC}"
    exit 1
fi