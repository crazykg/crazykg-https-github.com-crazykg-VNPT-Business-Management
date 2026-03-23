# Plan Review Report — CSDL Quản Lý Use Case

> **Generated:** 2026-03-21
> **Reviewed files:**
> - Plan: `CSDL_QuanLyUseCase.md`
> - SQL: `CSDL_QuanLyUseCase.sql`
> **Reviewers:** Claude Code + Codex CLI (peer debate)
> **Thread ID:** `019d0e7d-05be-7761-885e-72fb7e52b12f`

---

## Final Verdict: ✅ APPROVE

**Codex confirmed:** "No remaining findings. Re-read confirms the archive-table DDL now exists in the SQL file, and the current plan/SQL pair is consistent with the stated acceptance criteria."

---

## Debate Summary

| Round | Duration | Issues Found | Issues Fixed | Verdict |
|-------|----------|-------------|-------------|---------|
| **R1** | 131s | 7 (ISSUE-1→7) | — | REVISE |
| **R2** | 122s | 4 (ISSUE-8→11) | 7 (1→7 fixed) | REVISE |
| **R3** | 131s | 3 (ISSUE-12→14) | 4 (8→11 fixed) | REVISE |
| **R4** | 89s | 1 (ISSUE-15) | 3 (12→14 fixed) | REVISE |
| **R5** | 37s | 1 (ISSUE-16) | 1 (15 fixed) | REVISE |
| **R6** | 37s | **0** | 1 (16 fixed) | **APPROVE** |

**Total debate time:** ~547s (~9 min)
**Total issues raised:** 16
**Total issues resolved:** 16

---

## Issue Tracker — All 16 Issues

### Accepted & Fixed (16/16)

| # | Title | Severity | Category | Round Found | Resolution |
|---|-------|----------|----------|-------------|------------|
| 1 | Cross-project ownership not enforced | high | correctness | R1 | Added §6: 3-tier enforcement (Laravel + triggers + composite keys) |
| 2 | v_project_overview fan-out join | high | correctness | R1 | Rewritten with separate subqueries in plan & SQL |
| 3 | No explicit deletion policy | high | architecture | R1 | Added §7: table-by-table deletion policy |
| 4 | Audit trail undefined | medium | architecture | R1 | Added §8: Laravel Service Layer audit pattern |
| 5 | Incomplete Excel-to-SQL mapping | medium | scope | R1 | Added §9: complete column mapping + special row handling |
| 6 | Free-text classification columns | medium | architecture | R1 | Added §10: lookup tables with current vs target migration plan |
| 7 | FULLTEXT search missing | low | risk | R1 | Added §11: 2-phase strategy (B-tree → FULLTEXT at 10K threshold) |
| 8 | SQL view not updated to match plan | high | correctness | R2 | Synchronized SQL v_project_overview with plan |
| 9 | Lookup table schema contradicts base schema | high | architecture | R2 | Annotated as "current VARCHAR / target FK" throughout |
| 10 | Audit log CASCADE contradicts immutability | high | correctness | R2 | Changed FK to RESTRICT in plan & SQL |
| 11 | Header references wrong SQL file | low | scope | R2 | Updated link to ./CSDL_QuanLyUseCase.sql |
| 12 | SET NULL impossible with NOT NULL column | medium | sequencing | R3 | Removed SET NULL; archive-first procedure only |
| 13 | Actor FK CASCADE contradicts RESTRICT policy | medium | architecture | R3 | Changed actor FK to RESTRICT in SQL |
| 14 | Subsystem header pattern doesn't match Excel | low | scope | R3 | Fixed: "I"/"II" (no dot) for subsystems, "I.1" for groups |
| 15 | Archive table referenced but undefined | low | sequencing | R4 | Added §7.3 with full archive table schema & retention policy |
| 16 | Archive table in plan but not in SQL | medium | sequencing | R5 | Added CREATE TABLE to SQL file |

### Disputed (0/16)

None — all issues were accepted and fixed.

---

## Acceptance Criteria Verification

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Hierarchy: Project → Subsystem → Function Group → Use Case + direct project_id | ✅ |
| 2 | All Excel columns (A-J) mapped | ✅ |
| 3 | N:N actor relationship with role differentiation | ✅ |
| 4 | document_content LONGTEXT on all main tables | ✅ |
| 5 | Proper indexes for common query patterns | ✅ |
| 6 | Views for common queries (3 views) | ✅ |
| 7 | Soft delete support (SoftDeletes trait) | ✅ |
| 8 | Audit trail with immutability guarantee | ✅ |

---

## Key Design Decisions Made During Review

1. **Audit log immutability** — FK uses RESTRICT, not CASCADE. Force-delete requires archiving first.
2. **Lookup tables** — Current schema uses VARCHAR (v1), target migration to FK-based lookup tables (v2) clearly documented.
3. **Cross-project ownership** — 3-tier enforcement: Laravel validation (primary), optional DB triggers (secondary), composite indexes (tertiary).
4. **Search strategy** — B-tree indexes for <10K use cases, FULLTEXT when dataset grows.
5. **Actor deletion** — RESTRICT policy prevents orphaned role links.
