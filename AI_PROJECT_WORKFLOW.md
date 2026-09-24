# AI Project Workflow Guide

> Tài liệu này là **contract vận hành cho AI agents** khi tạo mới, mở rộng, sửa đổi hoặc review một project phần mềm sử dụng **OneSpec + OpenSpec**.
>
> AI MUST đọc tài liệu này trước khi thực hiện bất kỳ thay đổi non-trivial nào trong repository.

---

## 1. Mục tiêu

Workflow này nhằm đảm bảo AI:

- không nhảy trực tiếp từ yêu cầu sang code;
- hiểu requirement trước khi implement;
- dùng spec làm source of truth;
- giữ thay đổi trong đúng scope;
- chia implementation thành task nhỏ, kiểm chứng được;
- không archive khi chưa hoàn tất verification;
- không tự ý thay đổi kiến trúc, API, schema hoặc behavior ngoài phạm vi được phê duyệt;
- để lại trạng thái project rõ ràng cho AI agent hoặc developer tiếp theo.

Luồng chuẩn:

```text
Requirement
  ↓
Context / Codebase Inspection
  ↓
Ambiguity Scan
  ↓
Change Classification
  ↓
Proposal
  ↓
Design
  ↓
Spec Delta
  ↓
Tasks
  ↓
Human Approval
  ↓
Implementation
  ↓
Tests / Lint / Typecheck / Build
  ↓
AI Review
  ↓
Spec Compliance Review
  ↓
Human Acceptance
  ↓
Archive
  ↓
Living Specs Updated
```

---

## 2. Nguyên tắc bắt buộc

### 2.1 Spec before code

Đối với mọi thay đổi non-trivial:

```text
NO APPROVED SPEC
=
NO IMPLEMENTATION
```

AI MUST NOT bắt đầu sửa source code trước khi proposal/spec/design/tasks được tạo và approval gate được đáp ứng.

Ngoại lệ duy nhất là thay đổi `trivial` theo định nghĩa trong tài liệu này.

### 2.2 Scope is a contract

AI MUST:

- chỉ thay đổi code liên quan trực tiếp đến requirement;
- tránh refactor không liên quan;
- tránh đổi naming/style trên diện rộng;
- không nâng dependency nếu không cần thiết;
- không thay public API nếu spec không yêu cầu;
- không sửa behavior cũ ngoài phạm vi change;
- báo rõ nếu phát hiện vấn đề ngoài scope.

AI MUST NOT “tiện thể sửa thêm”.

### 2.3 Existing behavior is evidence

Khi làm việc với project hiện hữu, AI MUST coi:

- source code hiện tại;
- tests;
- OpenSpec specs;
- API contracts;
- database schema;
- configuration;
- CI workflows

là evidence cần đọc trước khi đưa ra design.

AI không được giả định architecture khi repository có thể cung cấp câu trả lời.

### 2.4 Verification over confidence

AI không được kết luận “done” chỉ vì code nhìn có vẻ đúng.

Completion phải dựa trên evidence:

- tests;
- lint;
- typecheck;
- build;
- acceptance criteria;
- spec compliance.

### 2.5 Preserve project consistency

AI MUST ưu tiên:

1. conventions hiện hữu;
2. patterns đã được project sử dụng;
3. framework-native patterns;
4. giải pháp đơn giản nhất thỏa requirement.

Không tạo abstraction mới nếu codebase hiện tại chưa cần.

---

## 3. Phân loại thay đổi

Trước khi bắt đầu, AI MUST phân loại request thành một trong ba nhóm.

### 3.1 Trivial

Ví dụ:

- sửa typo;
- đổi label;
- sửa copy text;
- thay comment;
- điều chỉnh validation message nhỏ;
- sửa config nhỏ không ảnh hưởng architecture.

Có thể dùng fast path:

```text
request
→ inspect
→ implement
→ verify
→ archive/update docs nếu cần
```

Nếu thay đổi ảnh hưởng behavior, API, database hoặc business rule thì KHÔNG còn là trivial.

### 3.2 Normal

Ví dụ:

- thêm endpoint;
- thêm form;
- thêm field;
- thêm webhook;
- thêm background job;
- thêm feature cục bộ;
- thay đổi behavior có giới hạn.

Workflow:

```text
request
→ inspect
→ ambiguity scan
→ proposal
→ spec delta
→ tasks
→ approval
→ implementation
→ verification
→ review
→ acceptance
→ archive
```

### 3.3 Complex

Ví dụ:

- authentication redesign;
- payment system;
- multi-tenancy;
- data migration lớn;
- event-driven architecture;
- authorization model;
- major performance redesign;
- cross-service change;
- breaking API change.

Workflow:

```text
request
→ deep inspection
→ ambiguity scan
→ architecture exploration
→ proposal
→ design.md
→ spec delta
→ implementation plan
→ tasks
→ approval
→ staged implementation
→ tests
→ architecture review
→ spec compliance
→ human acceptance
→ archive
```

Complex changes SHOULD dùng subagents khi có thể tách domain độc lập.

---

## 4. Cấu trúc repository khuyến nghị

```text
project/
├── src/
├── tests/
├── docs/
├── openspec/
│   ├── specs/
│   │   ├── auth/
│   │   │   └── spec.md
│   │   ├── users/
│   │   │   └── spec.md
│   │   └── billing/
│   │       └── spec.md
│   │
│   └── changes/
│       ├── add-google-oauth/
│       │   ├── proposal.md
│       │   ├── design.md
│       │   ├── tasks.md
│       │   └── specs/
│       │       └── auth/
│       │           └── spec.md
│       │
│       └── archive/
│
├── AGENTS.md
├── AI_PROJECT_WORKFLOW.md
└── README.md
```

### `openspec/specs/`

Chứa behavior hiện tại đã được chấp nhận của hệ thống.

Đây là **living specification**.

### `openspec/changes/`

Chứa các change đang được đề xuất hoặc triển khai.

Mỗi change SHOULD có slug rõ ràng:

```text
add-google-oauth
add-invoice-export
fix-session-refresh
migrate-user-preferences
```

Không dùng tên mơ hồ như:

```text
update-auth
fix-stuff
new-feature
changes
```

---

## 5. Quy trình tạo project mới

Khi AI được yêu cầu tạo project từ đầu, MUST thực hiện theo thứ tự sau.

### Phase 1 — Requirement Discovery

AI phải xác định:

- project giải quyết vấn đề gì;
- user chính là ai;
- core use cases;
- required platforms;
- required integrations;
- persistence requirements;
- authentication requirements;
- security constraints;
- deployment target;
- performance expectations;
- non-goals.

Nếu requirement chưa đầy đủ, AI SHOULD ghi assumption rõ ràng thay vì âm thầm đoán.

### Phase 2 — Architecture Definition

Trước khi scaffold project, AI SHOULD xác định:

```text
runtime
framework
package manager
database
ORM/data layer
auth strategy
API style
testing stack
linting
typechecking
build/deployment
configuration strategy
```

Chỉ chọn công nghệ thật sự cần thiết.

### Phase 3 — Bootstrap Spec

Tạo các initial specs trong:

```text
openspec/specs/
```

Ví dụ:

```text
openspec/specs/auth/spec.md
openspec/specs/users/spec.md
openspec/specs/projects/spec.md
```

### Phase 4 — Project Scaffold

Sau khi architecture được chấp nhận:

- tạo project structure;
- tạo config;
- thiết lập tests;
- thiết lập lint;
- thiết lập typecheck;
- thiết lập build;
- tạo `.env.example`;
- tạo README;
- tạo CI nếu phù hợp.

### Phase 5 — Baseline Verification

AI MUST chạy baseline checks trước feature đầu tiên:

```text
install
lint
typecheck
test
build
```

Project mới chưa đạt baseline xanh thì chưa được coi là initialized hoàn chỉnh.

---

## 6. Quy trình đọc project hiện hữu

Trước mọi normal/complex change, AI MUST đọc project theo thứ tự ưu tiên.

### 6.1 Repository instructions

Đọc nếu tồn tại:

```text
AGENTS.md
CLAUDE.md
CONTRIBUTING.md
README.md
AI_PROJECT_WORKFLOW.md
```

### 6.2 Project configuration

Kiểm tra:

```text
package.json
pyproject.toml
go.mod
Cargo.toml
pom.xml
build.gradle
tsconfig.json
eslint config
test config
docker files
CI workflows
```

### 6.3 Relevant specs

Đọc:

```text
openspec/specs/**
openspec/changes/**
```

liên quan trực tiếp đến request.

### 6.4 Relevant implementation

Không cần đọc toàn repo.

AI SHOULD tìm:

- entry point;
- domain/module liên quan;
- service;
- controller/router;
- data model;
- tests;
- integration points.

### 6.5 Current conventions

Xác định:

- naming;
- directory structure;
- dependency injection;
- error handling;
- logging;
- validation;
- testing style;
- API response patterns.

Implementation mới MUST theo conventions hiện tại trừ khi change được approve để thay đổi chúng.

---

## 7. Ambiguity Scan

Trước proposal, AI MUST kiểm tra requirement có ambiguity hay không.

Checklist:

```text
□ Actor là ai?
□ Trigger là gì?
□ Expected output là gì?
□ Error behavior là gì?
□ Permission rules là gì?
□ Data persistence cần gì?
□ Existing behavior nào phải giữ nguyên?
□ Backward compatibility có yêu cầu không?
□ Idempotency có cần không?
□ Concurrency có ảnh hưởng không?
□ Failure/retry behavior là gì?
□ Observability có cần không?
```

Nếu thiếu thông tin nhưng vẫn có thể tiếp tục an toàn, AI SHOULD ghi assumptions trong proposal.

Nếu ambiguity ảnh hưởng architecture hoặc correctness, change không được qua approval gate cho tới khi assumption được xác nhận.

---

## 8. Cách viết `proposal.md`

`proposal.md` mô tả **WHY + WHAT**, không phải implementation chi tiết.

Template:

```md
# Change: <change-name>

## Summary

Mô tả ngắn gọn thay đổi.

## Problem

Vấn đề hiện tại là gì?

## Goals

- Goal 1
- Goal 2

## Non-Goals

- Không làm X
- Không thay Y

## User / Business Impact

Ai bị ảnh hưởng và thay đổi behavior nào?

## Proposed Change

Mô tả behavior mới ở mức high-level.

## Compatibility

- Existing behavior được giữ lại:
- Breaking changes:
- Migration requirements:

## Risks

- Risk 1
- Risk 2

## Assumptions

- Assumption 1

## Acceptance Criteria

- [ ] Criterion 1
- [ ] Criterion 2
```

Proposal không nên chứa hàng trăm dòng code.

---

## 9. Cách viết `design.md`

`design.md` tập trung vào **HOW ở mức architecture**.

Chỉ bắt buộc cho change complex hoặc khi implementation có nhiều lựa chọn đáng cân nhắc.

Template:

```md
# Design: <change-name>

## Context

Kiến trúc hiện tại liên quan đến change.

## Constraints

- Constraint 1
- Constraint 2

## Proposed Architecture

Mô tả components và data flow.

## Data Flow

```text
Client
  ↓
API
  ↓
Service
  ↓
Repository
  ↓
Database
```

## Data Model Changes

Mô tả schema/model thay đổi.

## API Changes

Mô tả endpoints/events/contracts mới hoặc thay đổi.

## Error Handling

Mô tả expected failures.

## Security Considerations

- authentication
- authorization
- validation
- secret handling
- abuse considerations

## Alternatives Considered

### Option A

Pros:
- ...

Cons:
- ...

### Option B

Pros:
- ...

Cons:
- ...

## Decision

Lựa chọn được đề xuất và lý do.

## Migration / Rollout

Nếu cần.
```

---

## 10. Cách viết Spec Delta

Spec mô tả **observable behavior**, không mô tả internal implementation.

Ví dụ:

```md
# Authentication Spec Delta

## Added Requirements

### Google OAuth Login

The system SHALL allow a user to authenticate using a supported Google account.

#### Scenario: New Google user

Given no account exists for the verified Google email
When the user completes Google OAuth successfully
Then the system creates a new user account
And creates an OAuth identity link
And starts an authenticated session

#### Scenario: Existing user with same verified email

Given an account exists with the same verified email
When the user authenticates with Google
Then the system links the Google identity to the existing account
And does not create a duplicate user
```

Ưu tiên format:

```text
Requirement
→ Scenario
→ Given
→ When
→ Then
```

Spec SHOULD tập trung vào behavior có thể kiểm chứng.

---

## 11. Cách viết `tasks.md`

Task phải nhỏ, cụ thể và có thể xác nhận hoàn thành.

Không viết:

```md
- Implement authentication
```

Nên viết:

```md
# Tasks

## 1. OAuth configuration

- [ ] Add Google OAuth environment variables
- [ ] Add provider configuration
- [ ] Validate missing configuration on startup

## 2. Persistence

- [ ] Add OAuth identity model
- [ ] Add migration
- [ ] Add uniqueness constraint for provider identity

## 3. Authentication service

- [ ] Resolve existing linked identity
- [ ] Resolve user by verified email
- [ ] Create user when no account exists
- [ ] Link identity to existing user

## 4. API

- [ ] Add Google login route
- [ ] Add callback route
- [ ] Validate OAuth state

## 5. Tests

- [ ] New user flow
- [ ] Existing linked user
- [ ] Existing same-email user
- [ ] Invalid state
- [ ] Provider failure

## 6. Verification

- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Lint passes
- [ ] Typecheck passes
- [ ] Build passes
```

Mỗi task SHOULD tương ứng với một thay đổi dễ review.

---

## 12. Approval Gate

AI MUST NOT implement normal/complex change trước approval.

Approval có thể là một chỉ thị rõ ràng như:

```text
approved
proceed
apply this change
implement the approved proposal
```

Nếu proposal thay đổi đáng kể sau approval, AI MUST coi phần thay đổi đó là chưa được approve.

Các thay đổi sau đây luôn cần explicit approval nếu chưa có trong proposal:

- breaking API change;
- destructive migration;
- auth/security model change;
- cross-service architecture change;
- new paid external service;
- major dependency replacement.

---

## 13. Implementation Rules

Sau approval, AI MUST implement theo `tasks.md`.

### 13.1 Work task-by-task

Luồng:

```text
select task
→ inspect relevant code
→ implement minimal change
→ add/update tests
→ run focused verification
→ mark task complete
→ next task
```

Không implement toàn bộ feature trong một khối lớn nếu có thể chia nhỏ.

### 13.2 Keep the tree coherent

Sau mỗi task, codebase SHOULD vẫn ở trạng thái hợp lý.

Tránh để lại:

- code không compile;
- migration thiếu model;
- endpoint trỏ tới service chưa tồn tại;
- dead code;
- commented-out implementations.

### 13.3 Follow existing patterns

Nếu project đang dùng:

```text
Controller → Service → Repository
```

thì feature mới SHOULD theo pattern đó.

AI không được tự ý đổi sang architecture khác chỉ vì “cleaner”.

### 13.4 Dependencies

Trước khi thêm dependency mới, AI SHOULD kiểm tra:

1. project đã có dependency giải quyết việc này chưa;
2. standard library/framework có hỗ trợ chưa;
3. dependency mới có thật sự cần không.

Nếu thêm dependency:

- ghi lý do;
- dùng phiên bản phù hợp;
- cập nhật lockfile;
- thêm config cần thiết;
- kiểm tra license/security nếu project yêu cầu.

---

## 14. TDD Rules

Với business logic hoặc bug fix có behavior rõ ràng, AI SHOULD dùng TDD.

Flow:

```text
write failing test
→ confirm failure
→ implement minimum code
→ run test
→ refactor
→ run full relevant suite
```

Bug fix SHOULD có regression test nếu có thể tái hiện bằng test.

Không viết test chỉ để tăng coverage.

Tests phải chứng minh requirement.

---

## 15. Sử dụng Subagents

Subagents chỉ nên dùng khi work có thể chia thành phần độc lập.

Ví dụ tốt:

```text
Agent A → backend API
Agent B → frontend UI
Agent C → migration
Agent D → integration tests
```

Ví dụ không tốt:

```text
Agent A sửa service
Agent B đồng thời sửa chính service đó
```

### Rules

Parent agent MUST:

- giữ source of truth từ spec;
- chia ownership rõ;
- tránh agents sửa cùng file nếu có thể;
- review output trước merge;
- chạy verification cuối cùng trên integrated tree.

Subagent output không được coi là trusted cho tới khi parent agent review.

---

## 16. Quality Gates

Change chưa hoàn thành nếu chưa qua các gate liên quan.

### Gate 1 — Requirement

```text
□ Requirement rõ ràng
□ Scope rõ
□ Non-goals rõ
□ Acceptance criteria rõ
```

### Gate 2 — Design

```text
□ Architecture phù hợp project
□ Data flow rõ
□ API/schema impacts rõ
□ Security implications đã xem xét
□ Backward compatibility đã xem xét
```

### Gate 3 — Implementation

```text
□ Tất cả tasks hoàn thành
□ Không có unrelated refactor
□ Không có dead code
□ Không có placeholder/TODO quan trọng
```

### Gate 4 — Verification

Chạy các checks phù hợp:

```text
unit tests
integration tests
lint
typecheck
build
migration validation
security checks
```

AI MUST báo chính xác command nào fail.

Không được nói “all checks pass” nếu chưa chạy.

### Gate 5 — Spec Compliance

AI MUST đối chiếu implementation với:

```text
proposal.md
design.md
spec delta
tasks.md
acceptance criteria
```

Checklist:

```text
□ Mỗi requirement đã được implement
□ Mỗi scenario có behavior phù hợp
□ Không có behavior ngoài spec
□ Backward compatibility giữ đúng
□ Error cases đúng
```

### Gate 6 — Human Acceptance

Với normal/complex changes, human acceptance SHOULD xảy ra trước archive.

---

## 17. Failure Handling

Khi verification fail, AI MUST:

1. dừng tuyên bố completion;
2. xác định failure liên quan change hay pre-existing;
3. ghi evidence;
4. sửa nếu nằm trong scope;
5. rerun affected checks.

Nếu failure có sẵn từ trước:

```text
Pre-existing failure:
<command>

Observed:
<error>

Relation to current change:
No direct relation found.
```

AI không được sửa pre-existing issue ngoài scope trừ khi nó chặn change và việc sửa được chấp nhận.

---

## 18. Scope Creep Prevention

Trong quá trình implement, AI có thể phát hiện issue khác.

Ví dụ:

```text
- duplicated auth logic
- legacy endpoint
- old dependency
- unrelated flaky test
```

AI SHOULD ghi lại:

```text
Follow-up candidate:
<description>
```

Nhưng MUST NOT tự động mở rộng change.

Nếu issue mới là prerequisite bắt buộc, AI phải:

```text
identify dependency
→ explain why required
→ update proposal/tasks
→ obtain approval if scope materially changes
```

---

## 19. Completion Checklist

Trước khi nói “done”, AI MUST xác nhận:

```text
□ Requirement đã được hiểu đúng
□ Proposal đã được approve
□ Tasks hoàn thành
□ Tests đã được thêm/cập nhật
□ Unit tests pass
□ Integration tests pass nếu áp dụng
□ Lint pass
□ Typecheck pass nếu áp dụng
□ Build pass
□ Database migrations verified nếu áp dụng
□ Acceptance criteria pass
□ Spec compliance review pass
□ Không có unrelated changes
□ Documentation được cập nhật nếu cần
□ Human acceptance đã có nếu workflow yêu cầu
```

Nếu một mục không áp dụng, ghi `N/A`.

---

## 20. Archive Rules

Chỉ archive change khi:

```text
implementation complete
AND verification complete
AND spec compliance complete
AND acceptance complete
```

Archive SHOULD:

- chuyển change vào khu vực archive theo convention của OneSpec/OpenSpec;
- cập nhật living specs;
- giữ traceability từ change tới spec cuối cùng.

Không archive change chỉ để “dọn folder”.

---

## 21. Ví dụ Workflow — Google OAuth

User request:

```text
Add Google OAuth login.

Requirements:
- keep email/password login
- create account for new Google user
- link existing account by verified email
- add tests
```

### Step 1 — Inspect

AI đọc:

```text
existing auth spec
auth routes
auth service
user model
session logic
auth tests
```

### Step 2 — Ambiguity Scan

AI xác định:

```text
What happens when Google email is unverified?
Can one user link multiple Google identities?
What is the unique provider key?
```

### Step 3 — Create Change

```text
openspec/changes/add-google-oauth/
├── proposal.md
├── design.md
├── tasks.md
└── specs/
    └── auth/
        └── spec.md
```

### Step 4 — Approval

Human review:

```text
proposal
design
spec
tasks
```

Sau đó:

```text
approved
```

### Step 5 — Implementation

AI thực hiện lần lượt:

```text
provider config
→ persistence
→ service
→ routes
→ tests
```

### Step 6 — Verification

```text
unit tests
integration tests
lint
typecheck
build
```

### Step 7 — Compliance Review

So sánh implementation với spec:

```text
new user
existing linked user
same-email account linking
invalid state
provider failure
```

### Step 8 — Acceptance + Archive

Sau human acceptance:

```text
archive change
→ update living auth spec
```

---

# Instructions for AI Agents

Phần này là **policy bắt buộc**.

AI agent làm việc trong repository này MUST tuân thủ các quy tắc sau.

## A. Startup Contract

Trước khi thay đổi code:

```text
1. Read AI_PROJECT_WORKFLOW.md
2. Read repository-level agent instructions
3. Inspect relevant current specs
4. Inspect relevant implementation and tests
5. Classify the change
```

Không được skip các bước này cho normal/complex work.

## B. Planning Contract

Đối với normal/complex changes, AI MUST:

```text
create proposal
create/update spec delta
create design when architecture is affected
create tasks
wait for approval
```

AI MUST NOT implement trước approval.

## C. Execution Contract

Sau approval:

```text
implement only approved scope
follow tasks.md
prefer small coherent changes
add tests with behavior changes
preserve existing conventions
avoid unrelated refactors
```

## D. Verification Contract

Trước completion, AI MUST chạy các checks phù hợp:

```text
test
lint
typecheck
build
```

và các project-specific checks khác.

AI MUST NOT claim checks passed without executing them.

## E. Truthfulness Contract

AI MUST:

- phân biệt giữa “observed”, “inferred” và “assumed”;
- báo failure chính xác;
- không giấu failing tests;
- không nói implementation hoàn tất khi còn blocker;
- không fabricate command output;
- không giả vờ đã đọc file chưa đọc.

## F. Scope Contract

AI MUST NOT:

```text
perform unrelated refactors
rename unrelated APIs
upgrade unrelated dependencies
change formatting across unrelated files
rewrite working modules without requirement
```

Nếu phát hiện improvement ngoài scope, ghi lại như follow-up.

## G. Spec Contract

Implementation MUST satisfy spec.

Nếu source code và approved spec mâu thuẫn:

```text
STOP
→ identify conflict
→ do not silently choose one
→ resolve before continuing
```

## H. Completion Contract

AI chỉ được dùng từ:

```text
done
complete
finished
ready
```

khi completion checklist đã được đánh giá.

Nếu còn failure:

```text
Implementation status: incomplete
```

và ghi rõ blocker.

---

## 22. Status Format cho AI

Khi báo tiến độ, AI SHOULD dùng format ngắn:

```md
## Status

Change: add-google-oauth
Phase: implementation
Completed: 8/12 tasks

### Passed
- auth unit tests
- OAuth service tests
- lint

### Pending
- callback integration test
- full build

### Blockers
- none
```

Completion report:

```md
## Completion

Change: add-google-oauth

### Implemented
- Google OAuth login
- new-user creation
- existing-account linking

### Verification
- Unit tests: PASS
- Integration tests: PASS
- Lint: PASS
- Typecheck: PASS
- Build: PASS

### Spec Compliance
PASS

### Remaining
None
```

---

## 23. Decision Priority

Khi có nhiều nguồn instruction, AI SHOULD ưu tiên theo thứ tự:

```text
1. System / platform safety rules
2. Explicit current user instruction
3. Repository agent instructions
4. AI_PROJECT_WORKFLOW.md
5. Approved OpenSpec change
6. Living specs
7. Existing implementation conventions
8. General best practices
```

Nếu có conflict nghiêm trọng giữa các nguồn trong repository, AI phải làm rõ conflict thay vì tự ý chọn.

---

## 24. Golden Rule

```text
UNDERSTAND
BEFORE
DESIGN

DESIGN
BEFORE
IMPLEMENT

VERIFY
BEFORE
DECLARE DONE

SPEC
IS
THE CONTRACT
```
