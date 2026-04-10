# Project Name: Repo Analyzer

> A production-grade architecture analysis platform that performs deep static analysis on any GitHub repository or local codebase, detects architecture smells, computes quality scores, enforces CI/CD gates, and provides AI-powered architectural insights.

---

## 1. Project Overview

### What problem does this project solve?
Software teams struggle to maintain architectural quality as codebases grow. Code reviews catch bugs but rarely catch **structural decay** — circular dependencies, god modules, tightly coupled layers. By the time architecture debt becomes visible, it costs 10x more to fix. Repo Analyzer automates architectural health monitoring the same way linters automate code style.

### Real-world use case
A team pushes code to GitHub. A webhook triggers Repo Analyzer, which clones the repo, builds a dependency graph, detects 9 types of architecture smells, scores the codebase (0-100), and posts a pass/fail status check on the PR with a detailed comment showing what degraded.

### Target users
- Engineering leads tracking architecture health across reposi  tories
- Developers wanting automated feedback on structural quality
- DevOps teams integrating architecture gates into CI/CD pipelines
- Students and researchers studying static architecture analysis

### High-level architecture
```
GitHub Push/PR → Webhook → BullMQ Job Queue → Analysis Pipeline
                                                    ↓
                              ┌──────────────────────────────────┐
                              │  Phase 1: Scan (file tree)       │
                              │  Phase 2: Graph (imports + AST)  │
                              │  Phase 3: Analysis (smells,      │
                              │           cycles, metrics, score)│
                              │  Phase 4: Summary (health report)│
                              │  Phase 5: Diagrams (PlantUML)    │
                              └──────────────────────────────────┘
                                                    ↓
                              Redis Cache ← PipelineResult → PostgreSQL History
                                                    ↓
                              PR Comment + Commit Status + Notifications
```

---

## 2. System Architecture

### Architecture style: Modular monolith
Not microservices, not a flat monolith. The project uses NestJS modules as bounded contexts — each module owns its domain (auth, analysis, history, copilot) with explicit imports/exports. This gives microservice-like isolation with monolith deployment simplicity.

### Request flow (API call to DB response)

1. **Client** sends `POST /analyze { source: "https://github.com/owner/repo" }`
2. **AnalyzeController** validates input, generates a `jobId`, enqueues a BullMQ job
3. **Returns immediately** with `{ jobId }` (non-blocking)
4. **AnalysisJobProcessor** picks up the job (max 3 concurrent)
5. **Emits SSE events** (`cloning`, `analyzing`, `complete`) via EventEmitter2
6. **AnalyzerService** → clones repo (shallow, single-branch) → runs 5-phase pipeline
7. **Result** → cached in Redis (1h TTL) + persisted to PostgreSQL
8. **Client** polls `GET /analyze/:jobId` or streams `GET /analyze/:jobId/progress` (SSE)
9. **If webhook-triggered**: posts PR comment + sets commit status on GitHub

---

## 3. Tech Stack Breakdown

### NestJS 11
- **What**: TypeScript Node.js framework with dependency injection, modules, and decorators
- **Why in this project**: The modular architecture directly maps to the analysis pipeline phases. DI makes services testable and swappable. Guards/interceptors handle auth cleanly.
- **Why not Express**: Express is unopinionated — building a 30+ service system without DI leads to spaghetti. NestJS enforces structure.

### PostgreSQL (via TypeORM + Prisma)
- **What**: Relational database
- **Why**: Analysis history requires complex queries (time-series aggregation, cursor pagination, URL variant matching). Relational schema enforces data integrity for users, API keys, analysis results.
- **Why two ORMs**: Prisma for user/auth (schema-first, migrations). TypeORM for analysis entities (dynamic queries, raw SQL for aggregation).
- **Why not MongoDB**: The data is inherently relational (users own repos, repos have analyses, analyses have scores).

### Redis (via ioredis)
- **What**: In-memory key-value store
- **Why**: Analysis results are 50-200KB JSON blobs accessed frequently during the polling phase. Redis provides sub-millisecond reads with automatic TTL expiry (1 hour).
- **Also used for**: BullMQ job queue backend, analysis cache, source tree storage.

### BullMQ
- **What**: Redis-based job queue for Node.js
- **Why**: Repository cloning and analysis takes 10-60 seconds. Without a queue, the API would block. BullMQ provides: concurrency control (max 3), retry logic, progress events, and dead-letter handling.
- **Why not RabbitMQ**: BullMQ uses the same Redis instance as cache — no additional infrastructure.

### Tree-sitter
- **What**: Incremental parsing library supporting 40+ languages
- **Why**: Extracting class names, constructor injection patterns, and module declarations requires AST-level parsing, not regex. Tree-sitter provides fast, correct parsing for 12+ languages with a unified API.
- **Why not TypeScript compiler API**: Only works for TS/JS. Tree-sitter handles Python, Go, Rust, Java, etc.

### OpenAI API
- **What**: Large language model API
- **Why**: The copilot feature uses a 3-step LLM pipeline (planner → analyzer → validator) to answer freeform architecture questions. Graph queries handle deterministic questions without LLM costs.

### Passport.js
- **What**: Authentication middleware
- **Why**: Three auth strategies (JWT, API key, GitHub OAuth) need a unified interface. Passport provides strategy-based auth with NestJS guards.

---

## 4. Core Modules & Features

### Analysis Pipeline (`src/core/pipeline/`)
**Purpose**: Orchestrates the 5-phase analysis process.

**Phase 1 — Scan**: `LocalScannerService` or `GithubScannerService` produces a `FileNode` tree. `LanguageDetectorService` identifies the primary language and framework by file extension distribution.

**Phase 2 — Graph**: `StructuralAnalyzerService` extracts import edges via regex per language. `TreeSitterAnalyzer` extracts class declarations, constructor injection, and module metadata. `GraphMergeService` combines both into a `UnifiedGraph` where structural nodes (file paths) and semantic nodes (class names) coexist.

**Phase 3 — Analysis**: `PackageGraphService` collapses file-level edges into package-level edges. `CycleDetectorService` runs iterative Tarjan's SCC. `SmellDetectorService` applies framework-calibrated thresholds. `ArchitectureScoreService` computes the weighted score.

**Phase 4 — Summary**: `RepoSummaryService` generates a human-readable summary. `ArchitectureHealthService` identifies strengths and weaknesses.

**Phase 5 — Diagrams**: `DiagramPrepService` filters the graph per diagram type. `PlantUmlRendererService` delegates to generators for class, component, and sequence diagrams. Output is valid PlantUML that renders in any PlantUML server.

### Smell Detection (`src/analysis/smells/`)
**9 architecture smells detected**:

| Smell | Severity | Detection Logic |
|-------|----------|-----------------|
| God Module | medium | Fan-out exceeds threshold (NestJS: 8) |
| Hub Dependency | medium | Fan-in exceeds threshold AND fan-out > 1 (excludes infrastructure) |
| Dead Module | low | Zero incoming AND zero outgoing edges |
| Circular Dependency | high | Tarjan's SCC finds cycles in package graph |
| Unstable Abstraction | medium | High instability (I = fanOut/(fanIn+fanOut)) on depended-upon module |
| God File | medium | Single file has too many imports |
| Package Tangle | high | Bidirectional dependency between packages |
| Deep Hierarchy | medium | Module chain depth exceeds threshold |
| Scattered Functionality | low | Same concept spread across too many modules |

Thresholds are **framework-calibrated** — NestJS tolerates more modules than Express because it's designed for larger architectures.

### Scoring Model (`src/analysis/scoring/`)
```
overall = modularity × 0.35 + coupling × 0.35 + smells × 0.30
```

- **Modularity** (0-100): Penalizes high dependency density. Formula: `100 - min(density × 200, 100)`
- **Coupling** (0-100): Penalizes high average fan-out + hotspot (max fan-out). Capped at 40pt hotspot penalty.
- **Smells** (10-100): Diminishing penalties per smell. First smell pays full penalty, subsequent smells pay 75%, 50%, 35%... Cap at 90pt total penalty, floor at 10.

### Quality Gates (`src/gate/`)
8 rules evaluated per analysis:

1. `min-score` — Overall score >= 60 (error)
2. `max-cycles` — Zero circular dependencies (error)
3. `max-smells` — Max 5 smells (warning)
4. `max-avg-fanout` — Average fan-out <= 4 (warning)
5. `min-coupling-score` — Coupling score >= 50 (error)
6. `score-regression` — Max 10pt drop vs baseline (error)
7. `new-critical-smells` — Block new god-module/circular-dependency/package-tangle (error)
8. `cycle-regression` — Cycles must not increase (error)

Output includes a **grade** (A-F), **violations** with suggestions, and a **PlantUML annotation block** for diagram embedding.

### History & Trends (`src/history/`)
- **Cursor-based pagination** for history queries (scalable to 10k+ analyses)
- **Theil-Sen estimator** for trend direction — resistant to outliers
- **Per-metric trends** — independent trend computation for modularity, coupling, smells, cycles
- **Time-bucketed aggregation** — daily/weekly/monthly averages for long-range trends
- **Module-level trends** — per-module smell count evolution over time
- **Regression detection** — configurable thresholds (warning: 5pt drop, critical: 15pt drop)
- **Deep diff** — module-level changes, hotspot changes, cycle changes between two analyses

### GitHub Integration (`src/github/`, `src/webhooks/`)
- **Webhook receiver**: Handles `push` (default branch) and `pull_request` (opened/synchronize) events with HMAC-SHA256 verification
- **PR comments**: Posts markdown summary with metrics table, violations, suggestions. Updates existing comment instead of creating duplicates (bot marker: `<!-- repo-analyzer-bot -->`)
- **Commit status**: Sets `success`/`failure` on PR head SHA as `repo-analyzer/architecture-gate`

### Copilot / Chat (`src/copilot/`)
Two modes:
1. **Deterministic queries** (zero-cost, zero-latency): `GraphQueryEngine` handles violations, dependencies, cycles, god-modules, dead-modules
2. **LLM-powered chat** (OpenAI): 3-step pipeline:
   - **Planner**: Identifies what data is needed
   - **Analyzer**: Extracts evidence from analysis results
   - **Validator**: Synthesizes a coherent, verified answer

### Graph Explorer (`src/api/graph.controller.ts`)
6 traversal endpoints:
- Summary statistics (node/edge counts, top modules)
- Outgoing dependencies of any module
- Incoming dependents of any module
- Shortest path between two modules (BFS)
- Impact radius — what breaks if module X changes (reverse transitive closure)
- Module listing with fan-in/fan-out stats

### Report & Sharing (`src/report/`)
3 export formats: JSON (machine), Markdown (human), HTML (self-contained dark-themed report).
Shareable links: `POST /report/share` creates a token → `GET /report/shared/:token` serves HTML publicly (no auth).

---

## 5. Database Design

### Prisma Schema (Users & Auth)

**User** → has many **ApiKey**, has many **Repo**
- Email + password hash (bcrypt) for local auth
- GitHub ID + encrypted access token for OAuth
- Role field for future RBAC

**ApiKey** → belongs to User (cascade delete)
- SHA-256 hash stored (not the raw key)
- Prefix for identification (`sk_prod_abc...`)
- Active flag for soft-disable

### TypeORM Entities (Analysis Data)

**AnalysisResultEntity** — The core history table
- Indexed on `repoUrl` for fast lookups with URL variant matching
- Scalar metric columns for indexed queries (overallScore, cycleCount, etc.)
- `fullResult` TEXT column stores the entire PipelineResult as JSON (for deep diffs)

**RepoTargetEntity** — Quality goals per repository
- Unique index on `repoUrl`
- Stores target score, max smells, max cycles

**SharedReportEntity** — Shareable report snapshots
- Unique index on `shareToken`
- HTML content stored directly (self-contained, no external deps)
- Optional expiration date

### Why PostgreSQL?
- Time-series queries for trends (GROUP BY date buckets)
- URL variant matching with `IN` clauses
- ACID compliance for user data integrity
- JSON queries for future fullResult field analysis

---

## 6. Authentication & Security

### Three authentication strategies

1. **JWT (Email/Password)**
   - Registration: email + password → bcrypt hash → store
   - Login: verify hash → sign JWT with `{ sub, email, role }` → 7-day expiry
   - Guard: `JwtAuthGuard` extracts Bearer token, validates signature

2. **API Key (Programmatic)**
   - Generation: random key → SHA-256 hash stored, raw key returned once
   - Validation: custom Passport strategy checks `X-API-Key` header or `api_key` query param
   - Use case: CI/CD pipelines, automated scripts

3. **GitHub OAuth 2.0**
   - Scopes: `repo` + `user`
   - Token storage: AES-256-GCM encrypted in DB
   - Account linking: matches by email or creates new account

### Security measures
- **Rate limiting**: 10 requests/minute per IP (ThrottlerGuard)
- **Webhook verification**: HMAC-SHA256 on GitHub payloads
- **Token encryption**: AES-256-GCM for stored GitHub tokens (not plaintext)
- **Password hashing**: bcrypt with auto-generated salt
- **CORS**: Configurable allowed origins
- **File size limits**: 2MB per file, 50K files max per repo

---

## 7. Performance & Scalability

### Caching strategy
- **Redis** for hot analysis results (1-hour TTL)
- Keys: `analysis:result:{jobId}`, `analysis:meta:{jobId}`, `analysis:source-tree:{jobId}`
- Badge endpoint: 1-hour `Cache-Control` header

### Queue-based processing
- **BullMQ** with 3 concurrent workers
- Non-blocking API: `POST /analyze` returns immediately with `jobId`
- Progress tracking via SSE (Server-Sent Events)
- Job cleanup: keeps last 100 completed, 50 failed

### Optimizations
- **Shallow clone**: `git clone --depth 1 --single-branch` (clone only what's needed)
- **LRU file cache**: 5000 entries in structural analyzer (avoids re-reading files)
- **Fast pre-check**: Skip files without import-like keywords before running regex
- **Type-only edge filtering**: `import type` statements don't create runtime dependency edges
- **Cursor pagination**: O(log n) history queries instead of OFFSET
- **Diminishing penalties**: Prevents score collapse from many minor smells

---

## 8. Advanced Concepts Used

### Event-Driven Architecture
The system uses `EventEmitter2` (NestJS event module) for decoupled communication:
- `analysis.progress` — job processor emits, SSE endpoint streams to client
- `analysis.regression` — regression detector emits, notification services listen
- This allows adding new listeners (e.g., Discord notifications) without modifying the emitter.

### Server-Sent Events (SSE)
`GET /analyze/:jobId/progress` opens a long-lived HTTP connection. The server pushes `JobProgressEvent` objects as the analysis progresses (5% → 30% → 100%). The client receives real-time updates without polling.

### Background Job Processing (BullMQ)
Analysis is CPU-intensive (AST parsing, graph algorithms). Running it synchronously would block the event loop. BullMQ moves this to a separate processor loop with:
- **Concurrency control**: Max 3 simultaneous analyses
- **Retry logic**: Configurable attempts
- **Dead-letter queue**: Failed jobs preserved for debugging

### Tarjan's Strongly Connected Components (Iterative)
Cycle detection uses an iterative variant of Tarjan's algorithm (not recursive) to handle repos with 15,000+ files without hitting Node.js's 10,000-frame call stack limit. Uses an explicit stack on the heap instead.

### Theil-Sen Estimator for Trend Detection
Instead of ordinary least squares (sensitive to outliers), trends are computed using the median of consecutive slopes. A single anomalous analysis run won't skew the overall trend direction.

### Tree-sitter AST Parsing
12 languages parsed using tree-sitter's incremental parser. Each language has custom extraction logic for classes, constructor parameters, module declarations, and dependency injection patterns. The parser produces a concrete syntax tree (CST) that maps directly to source positions.

### Graph Theory Algorithms
- **BFS shortest path**: For the graph explorer's path finder
- **Reverse transitive closure**: For impact analysis (what breaks if X changes)
- **Connected components**: For edge-cluster grouping in class diagrams
- **Fan-in/fan-out degree centrality**: For scoring and cross-cutting detection

---

## 9. Important Keywords (Viva-Ready)

- **JWT (JSON Web Token)**: Stateless authentication token containing encoded claims (sub, email, role), signed with a secret, verified on each request without database lookup
- **Dependency Injection (DI)**: Design pattern where services receive their dependencies through the constructor rather than creating them, enabling testability and loose coupling
- **ACID Properties**: Atomicity, Consistency, Isolation, Durability — guarantees that database transactions are processed reliably
- **Indexing**: Database optimization that creates a sorted data structure (B-tree) for fast lookups — used on `repoUrl` and `shareToken` columns
- **Event Loop**: Node.js's single-threaded execution model — async I/O operations are delegated to the OS while the main thread handles callbacks
- **WebSocket vs SSE**: WebSocket is bidirectional; SSE is server-to-client only. This project uses SSE for progress updates (simpler, HTTP-based, auto-reconnect)
- **Tarjan's Algorithm**: Graph algorithm that finds all strongly connected components (cycles) in O(V+E) time
- **BFS (Breadth-First Search)**: Graph traversal that explores all neighbors at current depth before moving deeper — used for shortest path finding
- **Theil-Sen Estimator**: Robust statistical method for trend estimation — takes median of all pairwise slopes, resistant to up to 29% outliers
- **Fan-In / Fan-Out**: Fan-in = how many modules depend on this one; Fan-out = how many modules this one depends on
- **Static Analysis**: Analyzing code without executing it — examining structure, imports, dependencies, patterns
- **Architecture Smell**: A structural pattern that indicates potential maintainability or scalability problems (like code smells but at the module/package level)
- **Dependency Density**: Ratio of actual dependencies to maximum possible dependencies — measures how interconnected a codebase is
- **HMAC-SHA256**: Hash-based message authentication code — used to verify webhook payloads weren't tampered with
- **AES-256-GCM**: Authenticated encryption algorithm — used to encrypt stored GitHub OAuth tokens
- **Rate Limiting**: Restricting the number of requests a client can make in a time window to prevent abuse
- **Cursor-Based Pagination**: Using a pointer (cursor) to the last seen item instead of OFFSET for scalable pagination
- **PlantUML**: Text-based diagram specification language — this project generates PlantUML code programmatically from dependency graphs
- **ETL Pipeline**: Extract-Transform-Load pattern — the 5-phase analysis pipeline follows this: extract (scan), transform (analyze), load (cache + persist)

---

## 10. Viva Questions & Answers

### Basic Questions

**Q: What does your project do in one sentence?**
A: It's an automated architecture analysis platform that scans GitHub repositories, detects structural smells like circular dependencies and god modules, scores the codebase on a 0-100 scale, and integrates with CI/CD to block merges that degrade architecture quality.

**Q: Why NestJS and not Express?**
A: The project has 30+ services with complex dependency chains. NestJS provides dependency injection, modular architecture, and built-in support for guards, interceptors, and queues. Express would require building all of this from scratch, leading to unstructured code — ironically the same problem this tool detects.

**Q: How does the analysis work at a high level?**
A: Five phases: (1) Clone/scan the repo to build a file tree. (2) Extract imports (regex) and semantic relationships (tree-sitter AST) to build a dependency graph. (3) Run graph algorithms — cycle detection, smell classification, metric computation, scoring. (4) Generate a health report with strengths/weaknesses. (5) Produce PlantUML diagrams.

**Q: What is an architecture smell?**
A: A structural pattern that indicates potential maintainability problems at the module level. For example, a "god module" that depends on everything, or a "circular dependency" where A depends on B and B depends on A, making them impossible to test or deploy independently.

### Intermediate Questions

**Q: How does the scoring model work?**
A: Three dimensions, each 0-100: Modularity (penalizes high dependency density), Coupling (penalizes high average fan-out and hotspot fan-out), and Smells (diminishing penalties per smell, floor at 10). The overall score is a weighted average: modularity 35%, coupling 35%, smells 30%. Thresholds are calibrated per framework — NestJS tolerates more modules than Express.

**Q: Why do you use both Prisma and TypeORM?**
A: Prisma handles user/auth data where schema-first design and migrations are essential. TypeORM handles analysis entities where we need dynamic QueryBuilder queries for time-series aggregation, cursor pagination, and complex WHERE clauses with URL variants. Using one ORM for both would mean either losing Prisma's type safety or TypeORM's query flexibility.

**Q: How do you handle long-running analysis without blocking the API?**
A: BullMQ job queue. The API endpoint enqueues a job and returns a `jobId` immediately. A separate processor (max 3 concurrent) picks up jobs and runs the analysis pipeline. The client either polls `GET /analyze/:jobId` or streams progress via Server-Sent Events. Results are cached in Redis for fast retrieval.

**Q: How does the GitHub PR integration work?**
A: A webhook receives push/PR events from GitHub (verified with HMAC-SHA256). The controller enqueues an analysis job with PR metadata (number, head SHA). After analysis completes, the job processor evaluates quality gates, posts a markdown comment on the PR with a metrics table and violations, and sets the commit status to pass/fail. Bot comments are idempotent — updates existing comment instead of creating duplicates.

**Q: What is the Theil-Sen estimator and why use it?**
A: It computes the median of consecutive slopes in a time series. Unlike ordinary least squares regression which is sensitive to outliers, Theil-Sen can tolerate up to 29% of data points being anomalous. This matters because a single failed analysis run (e.g., on a half-merged branch) shouldn't flip the trend direction from "improving" to "degrading".

### Advanced Questions

**Q: How do you avoid false positive circular dependencies from type-only imports?**
A: TypeScript's `import type { X }` is a compile-time-only construct — it creates no runtime dependency. The import extractor tags each edge with `typeOnly: boolean` by checking if the full import statement matches `import type` or `export type`. The package graph builder skips `typeOnly` edges before building the module-level dependency graph, so the cycle detector never sees phantom cycles.

**Q: How does the diminishing penalty model work and why is it better than linear?**
A: Linear penalties stack additively — 9 smells at 15 points each = 135, capped at 100, giving a score of 0. This is misleading because 0 also means "no data". Diminishing returns apply multipliers: 1.0, 0.75, 0.50, 0.35, 0.25... for successive smells. The same 9 smells produce ~62 points of penalty instead of 135, giving a score of 38 — still bad, but distinguishable from "no data". The floor is 10, not 0.

**Q: How does the infrastructure module exclusion work?**
A: Modules like `common` (logger, config) or `cache` exist to be consumed by many — high fan-in is their purpose, not a smell. The detector identifies infrastructure modules by a simple heuristic: fan-in above the hub threshold BUT fan-out ≤ 1. These are leaf providers, not domain hubs. They're excluded from hub-dependency detection without any hardcoded name lists.

**Q: Explain the diagram generation strategy.**
A: Three strategies replace what was originally hardcoded: (1) **Class diagrams** group by source directory (extracted from `filePath` on each node) with edge-cluster BFS fallback when paths are unavailable. Cross-cutting services are detected by fan-in/fan-out ratio (mean+1sigma, fanOut<=1) and folded into a note. (2) **Component diagrams** use hybrid classification — minimal keyword matching primary, topological layering (source/sink/middle) as tiebreaker. Missing modules are added via directory-scan fallback. (3) **Sequence diagrams** detect async processors via orphan-root graph analysis — nodes with outgoing edges but no incoming from the controller subgraph.

**Q: How does cursor-based pagination work and why not OFFSET?**
A: OFFSET-based pagination (`SKIP 100 LIMIT 20`) requires the database to scan and discard 100 rows before returning 20 — O(n) per page. Cursor pagination uses a WHERE clause: `WHERE analyzedAt < :cursor ORDER BY analyzedAt DESC LIMIT 21` (fetch one extra to determine `hasMore`). This is O(log n) because it uses the index. The cursor is the `analyzedAt` timestamp of the last seen item.

---

## 11. Why Decisions Were Made

### Why modular monolith (not microservices)?
The analysis pipeline phases are tightly coupled — Phase 3 needs Phase 2's output immediately. Network calls between microservices would add latency and complexity for no benefit. NestJS modules provide the same isolation guarantees with shared-memory performance.

### Why PostgreSQL (not MongoDB)?
Analysis history is inherently relational: users own repos, repos have analyses, analyses have scores. Time-series trend queries (GROUP BY week, aggregate scores) are natural in SQL. MongoDB would require complex aggregation pipelines for what PostgreSQL does with standard GROUP BY.

### Why Redis for both cache AND queue?
Single infrastructure dependency instead of two (Redis + RabbitMQ). BullMQ uses Redis natively. Analysis results are JSON blobs with TTL — a perfect fit for Redis. One fewer service to deploy, monitor, and scale.

### Why tree-sitter (not regex-only)?
Regex can extract `import` paths but can't understand class declarations, constructor parameters, or module metadata. Tree-sitter gives us a full AST in ~5ms per file, enabling semantic analysis (which classes inject which services) alongside structural analysis (which files import which files).

### Trade-offs accepted
- **Two ORMs**: Added complexity but each ORM is used where it excels
- **Full JSON in DB**: `fullResult` column is large (~100KB per analysis) but enables deep diffs without recomputing
- **Shallow clones only**: Misses git history for churn analysis but reduces clone time from minutes to seconds

---

## 12. Challenges & Solutions

### Challenge: False positive circular dependencies
**Problem**: `import type { PipelineResult }` in TypeScript creates a compile-time-only reference, but the structural analyzer treated it as a real dependency edge, causing phantom cycles.
**Solution**: Tagged edges with `typeOnly: boolean` at the import extraction level. The package graph builder skips these edges before cycle detection runs.

### Challenge: Smell score collapsing to 0
**Problem**: Linear penalties — each smell subtracts 10-25 points. A repo with 9 smells would score 0 (same as "no data"), making the metric meaningless.
**Solution**: Diminishing returns — each subsequent smell applies a decreasing multiplier (100%, 75%, 50%...). Total penalty capped at 90, floor at 10.

### Challenge: Infrastructure modules flagged as hubs
**Problem**: `common` (logger) imported by 8 modules is its purpose, not a smell. The detector over-reported.
**Solution**: Detect infrastructure modules dynamically: high fan-in + low fan-out (≤ 1) = service provider. Skip from hub detection. No hardcoded lists needed.

### Challenge: Component diagram showing only 15 of 25 modules
**Problem**: Semantic module analysis only found modules with `@Module` decorators. Modules connected only via file-level imports were excluded.
**Solution**: Directory-scan fallback — after building the semantic diagram, check for missing `src/*` directories and add them with file-level import edges.

### Challenge: Trend queries returning stale data
**Problem**: `ORDER BY analyzedAt ASC LIMIT 30` returns the oldest 30 records, not the newest. Today's analyses were beyond the limit.
**Solution**: Changed to `ORDER BY analyzedAt DESC LIMIT 30` then `.reverse()` — gets the newest N in chronological order.

---

## 13. Future Improvements

### Scalability
- **Horizontal scaling**: Separate API and worker containers (partially done via `RUN_QUEUE_PROCESSOR` flag)
- **Multi-repo dashboard**: Aggregate health scores across an organization's repositories
- **Streaming analysis**: Process files as they're cloned instead of waiting for full clone

### Features
- **PR diff analysis**: Analyze only the changed files in a PR, not the entire repo
- **Custom smell rules**: Let users define their own architectural rules (e.g., "module X should never depend on module Y")
- **Interactive graph visualization**: D3.js or Cytoscape.js frontend for exploring the dependency graph
- **Multi-language semantic analysis**: Deeper AST analysis for Python, Go, Java (currently strongest for TypeScript/NestJS)

### Performance
- **Incremental analysis**: Cache the graph between runs and only re-analyze changed files
- **WASM tree-sitter**: Run tree-sitter in WebAssembly for browser-based analysis
- **Analysis result compression**: gzip the `fullResult` JSON before storage

---

## 14. API Explanation

### Core Analysis Flow

```
POST /analyze
  Body: { source: "https://github.com/owner/repo", branch?: "main", subdir?: "packages/core" }
  Response: { jobId: "uuid" }

GET /analyze/:jobId/progress  (SSE stream)
  Events: { status: "cloning", progress: 5 }
          { status: "analyzing", progress: 30 }
          { status: "complete", progress: 100 }

GET /analyze/:jobId
  Response: Full PipelineResult (score, smells, cycles, diagrams, metrics, health, ...)

GET /analyze/:jobId/report?format=html
  Response: Self-contained HTML report (attachment download)
```

### Graph Explorer

```
GET /graph/:jobId
  → { nodeCount, edgeCount, topFanOut: [...], topFanIn: [...] }

GET /graph/:jobId/impact?module=UsersService&depth=3
  → { affected: [{ id, fanIn, fanOut }, ...] }

GET /graph/:jobId/path?from=AnalyzeController&to=PrismaService
  → { path: ["AnalyzeController", "AnalyzerService", "UsersService", "PrismaService"], length: 3 }
```

### History & Trends

```
GET /history?repoUrl=https://github.com/owner/repo&limit=20&cursor=2025-04-09T...
  → { items: [...], nextCursor: "2025-04-08T...", hasMore: true }

GET /history/trend?repoUrl=...&limit=30
  → { trend: "improving", metricTrends: { overall, modularity, coupling, smells, cycles, smellCount }, points: [...] }

GET /history/diff?from=uuid1&to=uuid2
  → { delta: { overallScore: +5, ... }, moduleChanges: [...], hotspotChanges: [...], cycleChanges: [...] }
```

---

## 15. Key Takeaways (Revision Section)

- **Architecture**: Modular monolith with NestJS, 5-phase analysis pipeline, event-driven job processing
- **Core flow**: POST /analyze → BullMQ → 5 phases → Redis cache + PostgreSQL → Poll/SSE
- **Scoring**: 3 dimensions (modularity 35%, coupling 35%, smells 30%), diminishing smell penalties, framework-calibrated thresholds
- **9 smell types**: god-module, hub-dependency, dead-module, circular-dependency, unstable-abstraction, god-file, package-tangle, deep-hierarchy, scattered-functionality
- **Auth**: JWT + API Key + GitHub OAuth, three Passport strategies
- **Real-time**: SSE for progress, EventEmitter2 for internal events
- **CI/CD gates**: 8 rules, grade A-F, GitHub commit status + PR comments
- **Graph algorithms**: Tarjan's SCC (cycles), BFS (paths), reverse transitive closure (impact), degree centrality (scoring)
- **Trend analysis**: Theil-Sen estimator, per-metric trends, diminishing returns scoring, cursor pagination
- **Key optimizations**: Shallow clone, LRU cache, type-only edge filtering, diminishing penalties, cursor pagination
- **Database**: PostgreSQL (relational queries + time-series), Redis (cache + queue), two ORMs for different use cases
- **Diagrams**: Directory-based grouping, hybrid topological classification, orphan-root async detection — all strategy-driven, no hardcoded lists
