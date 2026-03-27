# Plan: Tao Skill Cho Tung Chuc Nang

**Ngay tao:** 2026-03-27
**Muc tieu:** Bo sung workflow dong bo docs cho tat ca skills chuc nang

---

## Tong Quan

### Van De Hien Tai
- Cac skill files hien tai chi liet ke file references co ban
- Khong co tai lieu chi tiet ve chuc nang trong `docs/`
- Khong co quy trinh dong bo docs sau khi code
- Khong tich hop voi `CODE_BASE_HE_THONG.md`

### Giai Phap
Bo sung workflow 5 buoc cho moi skill:
1. Kiem tra `CODE_BASE_HE_THONG.md` → tao neu chua co
2. Kiem tra `docs/<ten>.md` → tao neu chua co
3. Thuc hien chuc nang duoc yeu cau
4. Cap nhat docs va skill file sau khi code xong
5. Chay `init-he-thong` → cap nhat `CODE_BASE_HE_THONG.md`

---

## Pham Vi Ap Dung

### Danh Sach Skills Can Cap Nhat

| STT | Skill File | Docs File | Module |
|-----|------------|-----------|--------|
| 1 | businesses.skill | docs/businesses.md | Linh vuc kinh doanh |
| 2 | contracts.skill | docs/contracts.md | Hop dong |
| 3 | crc.skill | docs/crc.md | CRC |
| 4 | customers.skill | docs/customers.md | Khach hang |
| 5 | departments.skill | docs/departments.md | Phong ban |
| 6 | employees.skill | docs/employees.md | Nhan vien |
| 7 | fee-collection.skill | docs/fee-collection.md | Thu phi |
| 8 | products.skill | docs/products.md | San pham |
| 9 | projects.skill | docs/projects.md | Du an |
| 10 | revenue-mgmt.skill | docs/revenue-mgmt.md | Quan ly doanh thu |
| 11 | support-master.skill | docs/support-master.md | Ho tro master |

---

## Chi Tiet Cong Viec

### Giai Doan 1: Chuan Bi
- [ ] Doc hieu skill `init-he-thong.md`
- [ ] Kiem tra script `scripts/update-codebase-docs.js`
- [ ] Verify file `CODE_BASE_HE_THONG.md` ton tai
- [ ] Doc tat ca skill files hien co

### Giai Doan 2: Cap Nhat Skill Files
- [ ] businesses.skill - Bo sung workflow 5 buoc
- [ ] contracts.skill - Bo sung workflow 5 buoc
- [ ] crc.skill - Bo sung workflow 5 buoc
- [ ] customers.skill - Bo sung workflow 5 buoc
- [ ] departments.skill - Bo sung workflow 5 buoc
- [ ] employees.skill - Bo sung workflow 5 buoc
- [ ] fee-collection.skill - Bo sung workflow 5 buoc
- [ ] products.skill - Bo sung workflow 5 buoc
- [ ] projects.skill - Bo sung workflow 5 buoc
- [ ] revenue-mgmt.skill - Bo sung workflow 5 buoc
- [ ] support-master.skill - Bo sung workflow 5 buoc

### Giai Doan 3: Tao Docs Files
- [ ] docs/businesses.md
- [ ] docs/contracts.md
- [ ] docs/crc.md
- [ ] docs/customers.md
- [ ] docs/departments.md
- [ ] docs/employees.md
- [ ] docs/fee-collection.md
- [ ] docs/products.md
- [ ] docs/projects.md
- [ ] docs/revenue-mgmt.md
- [ ] docs/support-master.md

### Giai Doan 4: Kiem Tra va Tich Hop
- [ ] Test workflow voi businesses.skill (pilot)
- [ ] Fix issues (neu co)
- [ ] Ap dung cho tat ca skills con lai

---

## Timeline Du Kien

| Giai Doan | Thoi Gian |
|-----------|-----------|
| 1. Chuan bi | 1-2 hours |
| 2. Cap nhat skills | 3-4 hours |
| 3. Tao docs | 4-5 hours |
| 4. Test | 2-3 hours |
| **Tong** | **10-14 hours** |

---

## Definition of Done

- [ ] Tat ca 11 skill files duoc cap nhat
- [ ] Tat ca 11 docs files duoc tao
- [ ] Skill init-he-thong duoc tich hop
- [ ] CODE_BASE_HE_THONG.md duoc cap nhat tu dong
- [ ] Test thanh cong workflow

---

**Nguoi tao:** System
**Trang thai:** Pending