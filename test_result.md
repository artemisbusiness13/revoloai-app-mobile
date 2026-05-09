#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: "Stabilise the EN + RO bilingual experience across UI, chat, interview flow, results, radar chart legends, pricing and legal pages. Do not add other languages yet."

backend:
  - task: "Plumb `lang` into Interview start & answer endpoints"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "main"
          comment: "Added `lang: Optional[str] = 'English'` to InterviewStartRequest AND InterviewAnswerRequest pydantic models. Server already used req.lang in body — without this fix Romanian interviews would have crashed with AttributeError. Smoke-tested via curl: POST /api/interview/start with lang=Romanian returned a Romanian question; POST /api/chat with lang=Romanian returned a Romanian Sofia reply. Confirmed."
        - working: true
          agent: "testing"
          comment: "Comprehensive bilingual EN+RO test suite executed via /app/backend_test.py against the public ingress URL — 6/6 PASS."

  - task: "Demo seed & reset endpoints for preview/showcase mode"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Added POST /api/demo/seed and POST /api/demo/reset. /demo/seed accepts {user_id} and idempotently inserts 3 sample saved_jobs and 2 sample paid purchases (all tagged with is_demo:true). /demo/reset wipes only is_demo:true rows. Both error 400 if user_id missing. Test: (1) seed returns ok=true with counts; (2) GET /api/saved-jobs returns 3 rows; (3) GET /api/purchases returns 2 rows with status='paid'; (4) seed twice yields the same totals (idempotent); (5) reset removes them all. Existing non-demo data should remain untouched after seed/reset."
        - working: true
          agent: "testing"
          comment: "All 7 scenarios (a)-(g) PASS via /app/backend_test.py against the public ingress URL. (a) seed returns ok=true, saved_jobs=3, purchases=2. (b) /api/saved-jobs returns the 3 expected demo rows ('Senior Product Designer' / 'Customer Success Manager' / 'Data Analyst') each with title, company, location and is_demo:true. (c) /api/purchases returns 2 rows w/ status='paid', currency='gbp', amounts [699, 899], avatars {sofia, maya}. (d) Idempotency: 2nd seed returns same counts and DB still holds 3 saved_jobs and 2 purchases (no duplication). (e) reset returns ok=true w/ purchases_removed=2 and saved_jobs_removed=3; subsequent GETs return 0 rows. (f) seed and reset both return HTTP 400 with detail='user_id required' when body is empty. (g) Isolation: after seeding demo_iso_A and inserting a manual non-demo 'My real job', /api/demo/reset removed only the 3 demo rows; the manually-saved 'My real job' remained intact. No issues found."

frontend:
  - task: "EN + RO bilingual stability across all screens (UI, chat, interview, results, radar legends, pricing, legal pages)"
    implemented: true
    working: "NA"
    file: "/app/frontend/lib/i18n.tsx, /app/frontend/lib/translations/{en,ro,types}.ts, /app/frontend/app/{index,chat,interview,results,checkout,jobs}.tsx, /app/frontend/app/legal/[slug].tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Fixes: (1) interview.tsx now passes `lang: langName` to /interview/start and /interview/answer. (2) interview.tsx Tile labels now use t('results.axes.*'). (3) checkout.tsx avatar role/name now use t(`avatars.${key}.role|name`). (4) Hardcoded 'Open' in purchases list now uses t('common.open'). (5) Added new legal/[slug] dynamic route with EN + RO translations for privacy, terms, cookies, deletion. (6) Footer links in index.tsx are now Pressable and route to /legal/[slug]. (7) types.ts extended with the `legal` shape. Verified manually with screenshots in EN and RO."

metadata:
  created_by: "main_agent"
  version: "1.0"
  test_sequence: 6
  run_ui: false

test_plan:
  current_focus: []
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    - agent: "main"
      message: "Added preview/demo mode. Backend: POST /api/demo/seed and POST /api/demo/reset. Please verify: (a) /api/demo/seed with valid user_id returns ok=true and counts {saved_jobs:3, purchases:2}; (b) following /api/saved-jobs?user_id=X returns 3 rows tagged is_demo:true; (c) /api/purchases?user_id=X returns 2 rows with status='paid' tagged is_demo:true; (d) calling /api/demo/seed twice yields the same totals (idempotent — must NOT duplicate rows); (e) /api/demo/reset wipes only the is_demo rows; (f) both endpoints return 400 when user_id missing/empty. Do NOT retest other endpoints — they are out of scope."
    - agent: "testing"
      message: "Backend bilingual EN+RO suite executed successfully via /app/backend_test.py against the public ingress URL. 6/6 tests PASS. The pydantic `lang` plumbing is fully working. No issues found."
    - agent: "testing"
      message: "Demo seed/reset suite executed via /app/backend_test.py against the public ingress URL. All 7 review scenarios (a)-(g) PASS — 10/10 assertions green. /api/demo/seed seeds exactly 3 saved_jobs (Senior Product Designer / Customer Success Manager / Data Analyst, all is_demo:true with title/company/location) and 2 purchases (status=paid, currency=gbp, amounts 899 & 699 in pence, avatars sofia & maya). Idempotency confirmed — re-seeding the same user_id keeps totals at 3 and 2 (no duplication; old demo rows are wiped first). /api/demo/reset returns ok=true with purchases_removed=2 and saved_jobs_removed=3, and subsequent GETs return 0 rows. Both endpoints correctly return HTTP 400 with detail='user_id required' on empty body. Isolation verified: a manually-saved non-demo job 'My real job' for demo_iso_A survives /api/demo/reset while the 3 demo rows are removed. No issues found."