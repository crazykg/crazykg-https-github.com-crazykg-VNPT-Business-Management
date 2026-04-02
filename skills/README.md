# Skills - Ky nang doc code nhanh cho QLCTV5

Thu muc nay chua 11 skills rieng biet cho 11 chuc nang business chinh trong he thong QLCTV5.

## Danh sach Skills

### Skills Chuc Nang (11)

| STT | Skill File | Docs File | Module |
|-----|------------|-----------|--------|
| 1 | `businesses.skill` | `docs/businesses.md` | Quan ly Linh vuc Kinh doanh |
| 2 | `products.skill` | `docs/products.md` | Quan ly San pham |
| 3 | `contracts.skill` | `docs/contracts.md` | Quan ly Hop dong |
| 4 | `customers.skill` | `docs/customers.md` | Quan ly Khach hang (CRM) |
| 5 | `projects.skill` | `docs/projects.md` | Quan ly Du an |
| 6 | `departments.skill` | `docs/departments.md` | Quan ly Phong ban |
| 7 | `employees.skill` | `docs/employees.md` | Quan ly Nhan su |
| 8 | `crc.skill` | `docs/crc.md` | Quan ly Yeu cau Khach hang (CRC) |
| 9 | `fee-collection.skill` | `docs/fee-collection.md` | Quan ly Thu phi |
| 10 | `revenue-mgmt.skill` | `docs/revenue-mgmt.md` | Quan ly Doanh thu |
| 11 | `support-master.skill` | `docs/support-master.md` | Quan ly Danh muc Ho tro |

### Skills He Thong (2)

| STT | Skill File | Muc dich |
|-----|------------|----------|
| 12 | `init-he-thong.skill` | Cap nhat CODE_BASE_HE_THONG.md |
| 13 | `chuc-nang-moi.skill` | Tao chuc nang moi tu A-Z |

### Skills Dung Chung (1)

| STT | Skill File | Muc dich |
|-----|------------|----------|
| 14 | `ui-redesign.skill` | Shared UI redesign workflow dung duoc cho Claude, Codex, Cursor, ChatGPT, Gemini, va cac AI khac |

## Workflow 5 Buoc

Tat ca 11 skills chuc nang deu tuan theo workflow 5 buoc chuan:

### Buoc 1: Thu thap thong tin
- Xac dinh yeu cau tu user
- Neu thieu thong tin, hoi user cung cap chi tiet
- Validate input dau vao

### Buoc 2: Tim kiem va Phan tich
- Doc file docs tuong ung de hieu ro module
- Kiem tra `CODE_BASE_HE_THONG.md` de nam tong quan
- Tim files lien quan (Models, Controllers, Components, Services)
- Xac dinh pham vi cong viec

### Buoc 3: Lap ke hoach
- Tom tat ngan gon nhung gi se lam
- Liet ke cac files se sua doi
- Xac dinh cac rang buoc va quy uoc can tuan thu

### Buoc 4: Thuc thi
- Thuc hien cong viec theo ke hoach
- Tuan thu conventions trong `CLAUDE.md` va `GIT_RULES_WORKFLOWS.md`
- Khong mo rong scope ngoai yeu cau neu chua co xac nhan

### Buoc 5: Bao cao va Hoan tat
- Bao cao tien do sau moi moc chinh
- Khi hoan tat, liet ke:
  - File da sua doi
  - Test/lint da chay (neu co)
  - Cap nhat task list
- Chay skill `init-he-thong` de cap nhat `CODE_BASE_HE_THONG.md`
- Cap nhat file skill neu co thay doi ve files lien quan

## Cach su dung

### Dung skill chuc nang (da co)

Khi lam viec voi module da co skill:

```bash
/<ten-skill>
```

Vi du:
```bash
/contracts.skill
/crc.skill
/customers.skill
```

### Dung chuc-nang-moi.skill (cho module moi)

Khi can tao module/chuc nang moi tu dau:

```bash
/chuc-nang-moi.skill
```

Skill nay se:
1. Hoi thong tin chi tiet ve module can tao
2. Kiem tra xem module da ton tai chua
3. Len ke hoach tao tu A-Z
4. Tao docs truoc
5. Tao Backend + Frontend
6. Tao skill rieng cho module
7. Chay init-he-thong de cap nhat codebase

### Dung init-he-thong.skill

Sau khi code xong bat ky chuc nang nao:

```bash
/init-he-thong.skill
```

De cap nhat `CODE_BASE_HE_THONG.md` voi thay doi moi nhat.

## Tich hop voi init-he-thong

**Luồng cong viec khuyen nghi:**

```
┌─────────────────────────────────────────────────────────────┐
│ 1. User yeu cau feature                                     │
│         ↓                                                   │
│ 2. Kiem tra module da co skill chua?                        │
│         ↓                       ↓                           │
│    DA CO skill              CHUA CO skill                   │
│         ↓                       ↓                           │
│  Dung skill do          Dung chuc-nang-moi.skill           │
│         ↓                       ↓                           │
│  Code theo workflow     Tao tu A-Z (7 buoc)                 │
│         ↓                       ↓                           │
│  /init-he-thong.skill   /init-he-thong.skill                │
└─────────────────────────────────────────────────────────────┘
```

## Commit len Git

De commit cac file skills len branch, chay lenh:
```bash
git add skills/ docs/
git commit -m "feat: Add 11 business skills with 5-step workflow and docs"
git push
```

## Tham chieu

- `CLAUDE.md` - Project conventions
- `GIT_RULES_WORKFLOWS.md` - Git workflow
- `init-he-thong.md` - Setup guide
- `CODE_BASE_HE_THONG.md` - Codebase overview
- `docs/*.md` - Module-specific documentation
- `docs/ui-redesign.md` - Shared UI redesign playbook
