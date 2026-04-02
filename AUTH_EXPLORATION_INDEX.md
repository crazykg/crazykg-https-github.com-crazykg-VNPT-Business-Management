# Backend Authorization Exploration - Document Index

**Generated**: 2026-04-01  
**Focus**: Laravel Gates + Policies pattern for QLCV backend

---

## 📄 Documents Created

### 1. **EXPLORATION_SUMMARY.txt** ⭐ START HERE
**Purpose**: Executive summary with findings and quick checklist  
**Read Time**: 5 minutes  
**Contains**:
- Authorization implementation status
- Key patterns to replicate
- Core files reference table
- Department scope resolution strategies
- Ownership patterns
- Business rule integration
- Quick replication steps (8 numbered steps)
- Common mistakes to avoid
- **Best for**: Getting oriented quickly

---

### 2. **AUTH_QUICK_REFERENCE.md** ⭐ COPY-PASTE TEMPLATE
**Purpose**: 1-minute pattern guide with code templates  
**Read Time**: 10 minutes  
**Contains**:
- **Step 1**: Policy template (ready to copy)
- **Step 2**: Controller usage (ready to copy)
- Permission key naming convention
- Authorization check logic flow diagram
- Department resolution strategies (4 examples)
- Ownership patterns (single/multiple/different actions)
- Business rules integration (status checks)
- Full real-world example (Product model)
- Common mistakes with ✗/✅ examples
- Database table reference
- **Best for**: Implementing new authorization

---

### 3. **AUTHORIZATION_PATTERNS.md** 📚 COMPREHENSIVE REFERENCE
**Purpose**: Complete exploration with full code excerpts  
**Read Time**: 20 minutes  
**Contains**:
- Overview of authorization pattern (lines 1-47)
- V5BaseController foundation (lines 49-65)
- ResolvesDepartmentScopedAccess trait details (lines 67-156)
  - hasPermission() method (lines 19-22)
  - isAllowedByDepartmentScope() complete logic (lines 24-55)
  - Department resolution helpers (lines 57-115)
- **Policy 1**: CustomerRequestCasePolicy (65 lines of code)
  - Multi-owner pattern (4 owner types)
  - Different ownership per action
  - View/Update/Delete methods
- **Policy 2**: ContractPolicy (51 lines)
  - Indirect department resolution via Project
  - Single owner pattern
- **Policy 3**: InvoicePolicy (59 lines)
  - Business rule checks (PAID/CANCELLED/VOID status)
  - Status validation before scope check
- **Policy 4**: CustomerPolicy (63 lines)
  - NO explicit permission key check
  - Complex department resolution via contracts + projects
- UserAccessService methods documentation
- Controller usage examples
- Controllers missing authorization (40+ listed)
- Permission key naming convention
- Authorization decision tree
- Replication checklist
- Key files reference table
- **Best for**: Deep understanding and reference

---

## 🎯 Quick Start Path

### For Implementing New Authorization (15 minutes)

1. **Read**: `EXPLORATION_SUMMARY.txt` (Section 2 & 8)
2. **Copy**: `AUTH_QUICK_REFERENCE.md` (Step 1 & 2 code)
3. **Adapt**: For your model's department resolution + owners
4. **Reference**: `AUTHORIZATION_PATTERNS.md` (Policy 1-4 for patterns)

### For Understanding the Pattern (25 minutes)

1. **Read**: `EXPLORATION_SUMMARY.txt` (All sections)
2. **Study**: `AUTH_QUICK_REFERENCE.md` (Strategies & patterns)
3. **Review**: `AUTHORIZATION_PATTERNS.md` (Full policies)
4. **Note**: Key files in both docs

---

## 🔑 Key Concepts Summary

| Concept | Where to Find | Example |
|---------|---------------|---------|
| **Policy Structure** | Quick Ref: Step 1 | YourModelPolicy.php |
| **Controller Usage** | Quick Ref: Step 2 | Gate::authorize('update', Model) |
| **Permission Keys** | Summary: Section 2 | domain.read, domain.write |
| **Dept Resolution** | Patterns: Policy 1-4 | Strategy 1-4 in Quick Ref |
| **Multi-Owner** | Patterns: CRC Policy | view/update/delete diff logic |
| **Business Rules** | Patterns: Invoice Policy | Status checks before scope |
| **No Permission Key** | Patterns: Customer Policy | Scope/ownership only |
| **UserAccessService** | Patterns: Section 6 | hasPermission(), deptScopes() |
| **Authorization Flow** | Summary: Section 2 | Decision tree diagram |
| **Common Mistakes** | Quick Ref: Bottom | ✗/✅ examples |

---

## 📋 Implementation Checklist

```
□ Read EXPLORATION_SUMMARY.txt (5 min)
□ Read AUTH_QUICK_REFERENCE.md Step 1 (5 min)
□ Create YourModelPolicy.php from template
  □ Add use ResolvesDepartmentScopedAccess
  □ Implement view(), update(), delete()
  □ Implement resolveDepartmentIds()
  □ Adjust ownerUserIds for your model
□ Add permission keys to database
  □ domain.read
  □ domain.write
  □ domain.delete
□ Link permissions to roles
□ Update Controller
  □ Import Gate
  □ Add Gate::authorize() to store/update/destroy
□ Test authorization
```

---

## 📁 File Locations

**In Backend**:
- Core Trait: `app/Policies/Concerns/ResolvesDepartmentScopedAccess.php`
- Service: `app/Support/Auth/UserAccessService.php`
- Example Policies: `app/Policies/{Customer,Contract,Invoice}Policy.php`
- Example Controller: `app/Http/Controllers/Api/V5/CustomerController.php`

**In /Downloads/QLCV/**:
- This Index: `AUTH_EXPLORATION_INDEX.md` (you are here)
- Summary: `EXPLORATION_SUMMARY.txt` ⭐ START
- Quick Ref: `AUTH_QUICK_REFERENCE.md` ⭐ TEMPLATE
- Full Ref: `AUTHORIZATION_PATTERNS.md` ⭐ DEEP DIVE

---

## 🎓 Learning Path

### Path 1: I just need to implement it quickly
1. EXPLORATION_SUMMARY.txt (Section 8: Quick Replication Steps)
2. AUTH_QUICK_REFERENCE.md (Step 1 & 2)
3. Copy CustomerRequestCasePolicy.php as template
4. Done in 15 minutes ✓

### Path 2: I want to understand the pattern
1. EXPLORATION_SUMMARY.txt (All sections)
2. AUTH_QUICK_REFERENCE.md (All sections)
3. AUTHORIZATION_PATTERNS.md (Sections 1-5)
4. Review existing policies in backend
5. Done in 30 minutes ✓

### Path 3: I need to handle complex cases
1. AUTHORIZATION_PATTERNS.md (All sections)
2. Review all 4 policy implementations
3. Review UserAccessService methods
4. Study department resolution strategies in Quick Ref
5. Consider business rule integration examples
6. Done in 45 minutes ✓

---

## ⚙️ Permission Key Database Setup

```sql
-- 1. Add permission keys
INSERT INTO permissions (perm_key, perm_name, is_active) VALUES
  ('domain.read', 'View Domain Resource', 1),
  ('domain.write', 'Create/Edit Domain Resource', 1),
  ('domain.delete', 'Delete Domain Resource', 1);

-- 2. Link to roles (example: role_id = 1 is manager)
INSERT INTO role_permission (role_id, permission_id)
SELECT 1, id FROM permissions 
WHERE perm_key IN ('domain.read', 'domain.write', 'domain.delete');

-- 3. Verify assignment
SELECT r.role_code, p.perm_key
FROM roles r
JOIN role_permission rp ON r.id = rp.role_id
JOIN permissions p ON rp.permission_id = p.id
WHERE r.id = 1;
```

---

## ❓ FAQ

**Q: Where do I add authorization?**  
A: In the Policy class, use hasPermission() + isAllowedByDepartmentScope()

**Q: How do I call authorization from controller?**  
A: Gate::authorize('action', Model::findOrFail($id));

**Q: What if my resource doesn't have a direct dept_id?**  
A: Use Strategy 2-4 (via related model, multiple relations, or query)

**Q: How do I add business rules (like status checks)?**  
A: Add early-return before isAllowedByDepartmentScope() (see InvoicePolicy)

**Q: Do I need to list all owner IDs?**  
A: Yes, for every user who should have access. See CustomerRequestCasePolicy for 4 types.

**Q: Can I skip hasPermission() check?**  
A: Sometimes, but best practice is to include it. See CustomerPolicy for exception.

**Q: Are policies auto-discovered?**  
A: Yes, Laravel auto-discovers policies in app/Policies/

**Q: What if the user is admin?**  
A: isAllowedByDepartmentScope() returns true automatically for admins.

---

## 🔗 Cross-References

**From EXPLORATION_SUMMARY.txt:**
- Section 2: Key patterns (Permission naming, Auth flow)
- Section 3: Core files (UserAccessService, Trait)
- Section 4: Dept resolution strategies
- Section 5: Ownership patterns
- Section 8: Replication steps (numbered 1-4)

**From AUTH_QUICK_REFERENCE.md:**
- "Department Resolution Strategies" → 4 examples
- "Ownership Patterns" → Single/Multiple/Different actions
- "With Business Rules" → Status checks
- "Full Real-World Example" → Complete Product example
- "Common Mistakes" → ✗/✅ pairs

**From AUTHORIZATION_PATTERNS.md:**
- Section 3: Trait implementation (78 lines)
- Section 4: All 4 policy implementations (238 lines total)
- Section 5: Controller examples (33 lines)
- Section 6: UserAccessService methods (12 methods)

---

## 📞 Support

Need clarification? Check:
1. **Quick answer**: EXPLORATION_SUMMARY.txt (FAQ section not in this file)
2. **Code example**: AUTH_QUICK_REFERENCE.md (has 15+ examples)
3. **Deep explanation**: AUTHORIZATION_PATTERNS.md (full implementations)
4. **Real code**: `backend/app/Policies/` (see actual policy files)

---

**Last Updated**: 2026-04-01  
**Status**: Complete  
**Readiness**: Production-ready patterns documented
