# Plan: Thêm tính năng Tag cho yêu cầu khách hàng

**Date:** 2026-04-08  
**Author:** VNPT Business Management Team  
**Priority:** High  
**Estimated Complexity:** Medium (3-4 days)

---

## 1. MỤC TIÊU

Thêm tính năng **gắn thẻ (tag)** cho yêu cầu khách hàng với các yêu cầu:

1. ✅ Có thể thêm nhiều tag cho 1 yêu cầu
2. ✅ Có thể tạo tag mới trực tiếp khi thêm yêu cầu
3. ✅ Tag có thể chọn màu sắc
4. ✅ Tag được lưu trong database để tái sử dụng cho các yêu cầu khác
5. ✅ Tìm kiếm & autocomplete tag khi nhập

---

## 2. THIẾT KẾ DATABASE

### **2.1. Bảng `tags`** - Lưu danh sách tag có thể tái sử dụng

```sql
CREATE TABLE `tags` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL UNIQUE COMMENT 'Tên tag (duy nhất)',
  `color` VARCHAR(20) DEFAULT 'blue' COMMENT 'Mã màu: blue, red, green, yellow, purple, pink, orange, teal, gray',
  `description` VARCHAR(255) DEFAULT NULL COMMENT 'Mô tả tag (optional)',
  `usage_count` INT UNSIGNED DEFAULT 0 COMMENT 'Số lần tag được sử dụng (denormalized cho performance)',
  `created_by` BIGINT UNSIGNED DEFAULT NULL COMMENT 'Người tạo tag',
  `updated_by` BIGINT UNSIGNED DEFAULT NULL COMMENT 'Người cập nhật tag',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` TIMESTAMP NULL COMMENT 'Soft delete',
  
  INDEX `idx_tags_name` (`name`),
  INDEX `idx_tags_color` (`color`),
  INDEX `idx_tags_usage` (`usage_count`),
  
  CONSTRAINT `fk_tags_created_by` 
    FOREIGN KEY (`created_by`) REFERENCES `internal_users`(`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_tags_updated_by` 
    FOREIGN KEY (`updated_by`) REFERENCES `internal_users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='Danh mục tag cho yêu cầu khách hàng';
```

### **2.2. Bảng `customer_request_case_tags`** - Pivot table (N-N relationship)

```sql
CREATE TABLE `customer_request_case_tags` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `request_case_id` BIGINT UNSIGNED NOT NULL COMMENT 'Yêu cầu',
  `tag_id` BIGINT UNSIGNED NOT NULL COMMENT 'Tag',
  `attached_by` BIGINT UNSIGNED DEFAULT NULL COMMENT 'Người gắn tag',
  `attached_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời điểm gắn tag',
  
  UNIQUE KEY `uq_case_tag` (`request_case_id`, `tag_id`),
  INDEX `idx_case_tags_case` (`request_case_id`),
  INDEX `idx_case_tags_tag` (`tag_id`),
  
  CONSTRAINT `fk_case_tags_case` 
    FOREIGN KEY (`request_case_id`) REFERENCES `customer_request_cases`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_case_tags_tag` 
    FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_case_tags_attached_by` 
    FOREIGN KEY (`attached_by`) REFERENCES `internal_users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='Liên kết tag với yêu cầu khách hàng';
```

---

## 3. WORKFLOW TAG

### **3.1. Thêm tag khi tạo yêu cầu mới**

```
User nhập tên tag
    ↓
Hệ thống tìm kiếm tag đã tồn tại (autocomplete)
    ↓
  ┌─ Có tag tồn tại? ──Yes──→ Hiển thị để user chọn
  │                              ↓
  │                           User click chọn
  │                              ↓
  └─No──→ Hiển thị nút "Tạo tag mới: [tên tag]"
                               ↓
                           User chọn màu (hoặc mặc định)
                               ↓
                           Tạo tag mới + chọn luôn
```

### **3.2. Thêm tag khi chỉnh sửa yêu cầu**

Tương tự như trên, nhưng:
- Hiển thị các tag hiện tại của request
- Có thể xóa tag cũ
- Có thể thêm tag mới

### **3.3. Quản lý tag (CRUD)**

- **Tạo tag:** Tự động khi user nhập tag mới trong form yêu cầu
- **Xem tag:** Có thể xem danh sách tag trong Settings/Quản lý tag
- **Sửa tag:** Đổi tên, đổi màu, thêm mô tả
- **Xóa tag:** Soft delete (vẫn giữ lịch sử)

---

## 4. CHI TIẾT TRIỂN KHAI

### **GIAI ĐOẠN 1: DATABASE MIGRATION**

#### File: `database/sql-patches/2026-04-08_add_request_tags/`

##### 4.1. File: `2026-04-08_01_create_tags_tables.sql`

```sql
-- Tạo bảng tags và customer_request_case_tags
-- Date: 2026-04-08

SET NAMES utf8mb4;

-- 1. Bảng tags
CREATE TABLE IF NOT EXISTS `tags` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL UNIQUE COMMENT 'Tên tag',
  `color` VARCHAR(20) DEFAULT 'blue' COMMENT 'Mã màu tag',
  `description` VARCHAR(255) DEFAULT NULL COMMENT 'Mô tả',
  `usage_count` INT UNSIGNED DEFAULT 0 COMMENT 'Số lần sử dụng',
  `created_by` BIGINT UNSIGNED DEFAULT NULL,
  `updated_by` BIGINT UNSIGNED DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` TIMESTAMP NULL,
  
  INDEX `idx_tags_name` (`name`),
  INDEX `idx_tags_color` (`color`),
  
  CONSTRAINT `fk_tags_created_by` 
    FOREIGN KEY (`created_by`) REFERENCES `internal_users`(`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_tags_updated_by` 
    FOREIGN KEY (`updated_by`) REFERENCES `internal_users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='Danh mục tag cho yêu cầu khách hàng';

-- 2. Bảng pivot customer_request_case_tags
CREATE TABLE IF NOT EXISTS `customer_request_case_tags` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `request_case_id` BIGINT UNSIGNED NOT NULL,
  `tag_id` BIGINT UNSIGNED NOT NULL,
  `attached_by` BIGINT UNSIGNED DEFAULT NULL,
  `attached_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE KEY `uq_case_tag` (`request_case_id`, `tag_id`),
  INDEX `idx_case_tags_case` (`request_case_id`),
  INDEX `idx_case_tags_tag` (`tag_id`),
  
  CONSTRAINT `fk_case_tags_case` 
    FOREIGN KEY (`request_case_id`) REFERENCES `customer_request_cases`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_case_tags_tag` 
    FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_case_tags_attached_by` 
    FOREIGN KEY (`attached_by`) REFERENCES `internal_users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='Liên kết tag với yêu cầu';

-- 3. Seed một số tag mẫu
INSERT INTO `tags` (`name`, `color`, `description`, `created_at`, `updated_at`) VALUES
('Bug', 'red', 'Lỗi phần mềm', NOW(), NOW()),
('Feature', 'blue', 'Tính năng mới', NOW(), NOW()),
('Enhancement', 'green', 'Cải tiến tính năng', NOW(), NOW()),
('Urgent', 'orange', 'Yêu cầu khẩn cấp', NOW(), NOW()),
('UI/UX', 'purple', 'Giao diện người dùng', NOW(), NOW()),
('Performance', 'teal', 'Vấn đề hiệu năng', NOW(), NOW()),
('Security', 'pink', 'Bảo mật', NOW(), NOW()),
('Data', 'yellow', 'Liên quan dữ liệu', NOW(), NOW())
ON DUPLICATE KEY UPDATE `name` = `name`;

-- Verify
SELECT 'Tags tables created' AS status;
SHOW TABLES LIKE 'tags';
SHOW TABLES LIKE 'customer_request_case_tags';
SELECT * FROM tags;
```

---

### **GIAI ĐOẠN 2: BACKEND (LARAVEL)**

#### 4.2. Model: `backend/app/Models/Tag.php`

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Tag extends Model
{
    use SoftDeletes;

    protected $table = 'tags';

    protected $fillable = [
        'name',
        'color',
        'description',
        'usage_count',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'usage_count' => 'integer',
    ];

    // Available colors
    public const COLORS = [
        'blue' => '#3B82F6',
        'red' => '#EF4444',
        'green' => '#10B981',
        'yellow' => '#F59E0B',
        'purple' => '#8B5CF6',
        'pink' => '#EC4899',
        'orange' => '#F97316',
        'teal' => '#14B8A6',
        'gray' => '#6B7280',
    ];

    // Relationships
    public function cases(): BelongsToMany
    {
        return $this->belongsToMany(CustomerRequestCase::class, 'customer_request_case_tags', 'tag_id', 'request_case_id')
            ->withTimestamps();
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(InternalUser::class, 'created_by');
    }

    // Scopes
    public function scopePopular($query, int $limit = 20)
    {
        return $query->orderByDesc('usage_count')->limit($limit);
    }

    public function scopeSearch($query, string $keyword)
    {
        return $query->where('name', 'like', "%{$keyword}%");
    }
}
```

#### 4.3. Model: `backend/app/Models/CustomerRequestCaseTag.php`

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CustomerRequestCaseTag extends Model
{
    protected $table = 'customer_request_case_tags';

    protected $fillable = [
        'request_case_id',
        'tag_id',
        'attached_by',
        'attached_at',
    ];

    protected $casts = [
        'attached_at' => 'datetime',
    ];

    public function case(): BelongsTo
    {
        return $this->belongsTo(CustomerRequestCase::class, 'request_case_id');
    }

    public function tag(): BelongsTo
    {
        return $this->belongsTo(Tag::class, 'tag_id');
    }

    public function attachedBy(): BelongsTo
    {
        return $this->belongsTo(InternalUser::class, 'attached_by');
    }
}
```

#### 4.4. Update Model: `backend/app/Models/CustomerRequestCase.php`

Thêm relationship:

```php
public function tags(): BelongsToMany
{
    return $this->belongsToMany(Tag::class, 'customer_request_case_tags', 'request_case_id', 'tag_id')
        ->withTimestamps();
}
```

#### 4.5. Controller: `backend/app/Http/Controllers/V5/TagController.php`

```php
<?php

namespace App\Http\Controllers\V5;

use App\Models\Tag;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class TagController extends Controller
{
    /**
     * GET /api/v5/tags
     * List all tags with search & pagination
     */
    public function index(Request $request): JsonResponse
    {
        $query = Tag::query();

        // Search
        if ($keyword = $request->query('q')) {
            $query->where('name', 'like', "%{$keyword}%");
        }

        // Filter by color
        if ($color = $request->query('color')) {
            $query->where('color', $color);
        }

        // Sort
        $sortBy = $request->query('sort_by', 'usage_count');
        $sortOrder = $request->query('sort_order', 'desc');
        $query->orderBy($sortBy, $sortOrder);

        $perPage = $request->query('per_page', 50);
        $tags = $query->paginate($perPage);

        return response()->json($tags);
    }

    /**
     * GET /api/v5/tags/suggestions?q=keyword
     * Autocomplete suggestions
     */
    public function suggestions(Request $request): JsonResponse
    {
        $keyword = $request->query('q', '');
        
        if (empty($keyword)) {
            // Return popular tags
            $tags = Tag::popular(20)->get(['id', 'name', 'color', 'usage_count']);
        } else {
            // Search matching tags
            $tags = Tag::search($keyword)
                ->orderByDesc('usage_count')
                ->limit(10)
                ->get(['id', 'name', 'color', 'usage_count']);
        }

        return response()->json([
            'tags' => $tags,
            'can_create' => !Tag::where('name', strtolower(trim($keyword)))->exists(),
        ]);
    }

    /**
     * POST /api/v5/tags
     * Create new tag
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:100|unique:tags,name',
            'color' => 'required|string|in:' . implode(',', array_keys(Tag::COLORS)),
            'description' => 'nullable|string|max:255',
        ]);

        $tag = Tag::create([
            ...$validated,
            'name' => strtolower(trim($validated['name'])),
            'created_by' => auth()->id(),
        ]);

        return response()->json($tag, 201);
    }

    /**
     * PUT /api/v5/tags/{id}
     * Update tag
     */
    public function update(Request $request, Tag $tag): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:100|unique:tags,name,' . $tag->id,
            'color' => 'required|string|in:' . implode(',', array_keys(Tag::COLORS)),
            'description' => 'nullable|string|max:255',
        ]);

        $tag->update([
            ...$validated,
            'name' => strtolower(trim($validated['name'])),
            'updated_by' => auth()->id(),
        ]);

        return response()->json($tag);
    }

    /**
     * DELETE /api/v5/tags/{id}
     * Soft delete tag
     */
    public function destroy(Tag $tag): JsonResponse
    {
        $tag->delete();
        return response()->json(['message' => 'Tag deleted']);
    }

    /**
     * POST /api/v5/customer-request-cases/{caseId}/tags
     * Attach tags to a case
     */
    public function attachToCase(Request $request, int $caseId): JsonResponse
    {
        $validated = $request->validate([
            'tag_ids' => 'required|array',
            'tag_ids.*' => 'exists:tags,id',
        ]);

        $case = CustomerRequestCase::findOrFail($caseId);
        
        // Sync tags (remove old, add new)
        $case->tags()->sync($validated['tag_ids']);

        // Update usage counts
        $this->updateUsageCounts($case);

        return response()->json([
            'tags' => $case->tags()->get(['id', 'name', 'color']),
        ]);
    }

    /**
     * DELETE /api/v5/customer-request-cases/{caseId}/tags/{tagId}
     * Detach tag from case
     */
    public function detachFromCase(int $caseId, int $tagId): JsonResponse
    {
        $case = CustomerRequestCase::findOrFail($caseId);
        $case->tags()->detach($tagId);

        // Update usage counts
        $this->updateUsageCounts($case);

        return response()->json(['message' => 'Tag detached']);
    }

    /**
     * POST /api/v5/customer-request-cases/{caseId}/tags/bulk
     * Bulk attach tags (create if not exists)
     */
    public function bulkAttach(Request $request, int $caseId): JsonResponse
    {
        $validated = $request->validate([
            'tag_names' => 'required|array',
            'tag_names.*' => 'required|string|max:100',
            'tag_colors' => 'array', // map: name => color
        ]);

        $case = CustomerRequestCase::findOrFail($caseId);
        $tagIds = [];

        foreach ($validated['tag_names'] as $tagName) {
            $tagName = strtolower(trim($tagName));
            
            // Find or create tag
            $tag = Tag::firstOrCreate(
                ['name' => $tagName],
                [
                    'color' => $validated['tag_colors'][$tagName] ?? 'blue',
                    'created_by' => auth()->id(),
                ]
            );

            $tagIds[] = $tag->id;
        }

        // Sync tags
        $case->tags()->syncWithoutDetaching($tagIds);

        // Update usage counts
        $this->updateUsageCounts($case);

        return response()->json([
            'tags' => $case->tags()->get(['id', 'name', 'color']),
        ]);
    }

    /**
     * GET /api/v5/customer-request-cases/{caseId}/tags
     * Get tags for a case
     */
    public function getCaseTags(int $caseId): JsonResponse
    {
        $case = CustomerRequestCase::findOrFail($caseId);
        $tags = $case->tags()->get(['id', 'name', 'color']);

        return response()->json(['tags' => $tags]);
    }

    private function updateUsageCounts(CustomerRequestCase $case): void
    {
        // Recalculate usage counts for all tags
        DB::table('tags')
            ->join('customer_request_case_tags', 'tags.id', '=', 'customer_request_case_tags.tag_id')
            ->groupBy('tags.id')
            ->select('tags.id', DB::raw('COUNT(*) as count'))
            ->get()
            ->each(function ($row) {
                Tag::where('id', $row->id)->update(['usage_count' => $row->count]);
            });

        // Reset usage_count to 0 for unused tags
        Tag::whereNotIn('id', function ($query) {
            $query->select('tag_id')->from('customer_request_case_tags');
        })->update(['usage_count' => 0]);
    }
}
```

#### 4.6. Routes: `backend/routes/api.php`

Thêm routes cho tags:

```php
// Tag management
Route::prefix('tags')->group(function () {
    Route::get('/', [TagController::class, 'index']);
    Route::get('/suggestions', [TagController::class, 'suggestions']);
    Route::post('/', [TagController::class, 'store']);
    Route::put('/{tag}', [TagController::class, 'update']);
    Route::delete('/{tag}', [TagController::class, 'destroy']);
});

// Case tags
Route::prefix('customer-request-cases/{caseId}/tags')->group(function () {
    Route::get('/', [TagController::class, 'getCaseTags']);
    Route::post('/', [TagController::class, 'attachToCase']);
    Route::post('/bulk', [TagController::class, 'bulkAttach']);
    Route::delete('/{tagId}', [TagController::class, 'detachFromCase']);
});
```

---

### **GIAI ĐOẠN 3: FRONTEND (REACT)**

#### 4.7. Component: `frontend/components/customer-request/TagInput.tsx`

```tsx
import React, { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../../services/apiFetch';

interface Tag {
  id: number;
  name: string;
  color: string;
  usage_count?: number;
}

interface TagInputProps {
  value: Tag[];
  onChange: (tags: Tag[]) => void;
  placeholder?: string;
}

const COLOR_OPTIONS = [
  { name: 'blue', hex: '#3B82F6' },
  { name: 'red', hex: '#EF4444' },
  { name: 'green', hex: '#10B981' },
  { name: 'yellow', hex: '#F59E0B' },
  { name: 'purple', hex: '#8B5CF6' },
  { name: 'pink', hex: '#EC4899' },
  { name: 'orange', hex: '#F97316' },
  { name: 'teal', hex: '#14B8A6' },
  { name: 'gray', hex: '#6B7280' },
];

const getColorClasses = (color: string): string => {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-800 border-blue-300',
    red: 'bg-red-100 text-red-800 border-red-300',
    green: 'bg-green-100 text-green-800 border-green-300',
    yellow: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    purple: 'bg-purple-100 text-purple-800 border-purple-300',
    pink: 'bg-pink-100 text-pink-800 border-pink-300',
    orange: 'bg-orange-100 text-orange-800 border-orange-300',
    teal: 'bg-teal-100 text-teal-800 border-teal-300',
    gray: 'bg-gray-100 text-gray-800 border-gray-300',
  };
  return colorMap[color] || colorMap.blue;
};

export const TagInput: React.FC<TagInputProps> = ({ value, onChange, placeholder }) => {
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState<Tag[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [selectedColor, setSelectedColor] = useState('blue');
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch suggestions
  useEffect(() => {
    if (input.length < 1) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const fetchSuggestions = async () => {
      try {
        const response = await apiFetch(`/api/v5/tags/suggestions?q=${encodeURIComponent(input)}`);
        const data = await response.json();
        setSuggestions(data.tags || []);
        setShowSuggestions(true);
      } catch (error) {
        console.error('Failed to fetch tag suggestions:', error);
      }
    };

    const timeout = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(timeout);
  }, [input]);

  const handleSelectTag = (tag: Tag) => {
    if (!value.find(t => t.id === tag.id)) {
      onChange([...value, tag]);
    }
    setInput('');
    setShowSuggestions(false);
  };

  const handleCreateNewTag = () => {
    // Create tag with selected color
    const newTag: Tag = {
      id: Date.now(), // Temporary ID, will be replaced by backend
      name: input.toLowerCase().trim(),
      color: selectedColor,
    };
    
    if (!value.find(t => t.name === newTag.name)) {
      onChange([...value, newTag]);
    }
    setInput('');
    setShowSuggestions(false);
    setShowColorPicker(false);
  };

  const handleRemoveTag = (tagToRemove: Tag) => {
    onChange(value.filter(t => t.id !== tagToRemove.id));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && input.trim()) {
      e.preventDefault();
      if (suggestions.length > 0) {
        handleSelectTag(suggestions[0]);
      } else {
        handleCreateNewTag();
      }
    } else if (e.key === 'Backspace' && !input && value.length > 0) {
      handleRemoveTag(value[value.length - 1]);
    }
  };

  return (
    <div className="relative">
      <div className="flex flex-wrap gap-2 p-2 border border-slate-300 rounded-lg min-h-[42px] focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary">
        {/* Selected tags */}
        {value.map(tag => (
          <span
            key={tag.id}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getColorClasses(tag.color)}`}
          >
            {tag.name}
            <button
              type="button"
              onClick={() => handleRemoveTag(tag)}
              className="ml-1 hover:opacity-70"
            >
              ×
            </button>
          </span>
        ))}
        
        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => input && setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          placeholder={value.length === 0 ? placeholder : 'Thêm tag...'}
          className="flex-1 min-w-[120px] outline-none text-sm bg-transparent"
        />
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && (input || suggestions.length > 0) && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-auto">
          {/* Existing tags */}
          {suggestions.map(tag => (
            <button
              key={tag.id}
              type="button"
              onClick={() => handleSelectTag(tag)}
              className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center justify-between"
            >
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getColorClasses(tag.color)}`}>
                {tag.name}
              </span>
              {tag.usage_count && (
                <span className="text-xs text-slate-400">
                  Đã dùng {tag.usage_count} lần
                </span>
              )}
            </button>
          ))}

          {/* Create new tag option */}
          {input && !suggestions.find(t => t.name === input.toLowerCase().trim()) && (
            <div className="border-t border-slate-200">
              <button
                type="button"
                onClick={handleCreateNewTag}
                className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 text-primary font-medium"
              >
                + Tạo tag mới: "{input}"
              </button>
              
              {/* Color picker */}
              {showColorPicker && (
                <div className="px-3 py-2 flex gap-2 flex-wrap">
                  {COLOR_OPTIONS.map(color => (
                    <button
                      key={color.name}
                      type="button"
                      onClick={() => {
                        setSelectedColor(color.name);
                        setShowColorPicker(false);
                      }}
                      className={`w-6 h-6 rounded-full border-2 ${selectedColor === color.name ? 'border-slate-900' : 'border-transparent'}`}
                      style={{ backgroundColor: color.hex }}
                      title={color.name}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
```

#### 4.8. Update Form: `frontend/components/customer-request/CreateRequestForm.tsx`

Thêm TagInput vào form tạo/chỉnh sửa yêu cầu:

```tsx
// Thêm vào form fields
import { TagInput } from './TagInput';

// Trong form state
const [selectedTags, setSelectedTags] = useState<Tag[]>([]);

// Trong form JSX
<div className="space-y-2">
  <label className="block text-sm font-medium text-slate-700">
    Thẻ (Tags)
  </label>
  <TagInput
    value={selectedTags}
    onChange={setSelectedTags}
    placeholder="Nhập tag và nhấn Enter..."
  />
  <p className="text-xs text-slate-500">
    Gắn thẻ để dễ tìm kiếm và phân loại yêu cầu
  </p>
</div>
```

#### 4.9. Update API Call: `frontend/services/v5Api.ts`

Thêm helper function để sync tags khi tạo/cập nhật request:

```typescript
// Sau khi tạo request thành công
if (response.ok && selectedTags.length > 0) {
  const tagNames = selectedTags.map(t => t.name);
  const tagColors = selectedTags.reduce((acc, t) => {
    acc[t.name] = t.color;
    return acc;
  }, {} as Record<string, string>);

  await apiFetch(`/api/v5/customer-request-cases/${newCaseId}/tags/bulk`, {
    method: 'POST',
    body: JSON.stringify({ tag_names: tagNames, tag_colors: tagColors }),
  });
}
```

---

## 5. FILES CẦN THAY ĐỔI

### **Database (1 file)**
1. `database/sql-patches/2026-04-08_add_request_tags/2026-04-08_01_create_tags_tables.sql` ✨ NEW

### **Backend (5 files)**
1. `backend/app/Models/Tag.php` ✨ NEW
2. `backend/app/Models/CustomerRequestCaseTag.php` ✨ NEW
3. `backend/app/Models/CustomerRequestCase.php` ✏️ MODIFY (thêm relationship)
4. `backend/app/Http/Controllers/V5/TagController.php` ✨ NEW
5. `backend/routes/api.php` ✏️ MODIFY (thêm routes)

### **Frontend (4 files)**
1. `frontend/components/customer-request/TagInput.tsx` ✨ NEW
2. `frontend/components/customer-request/CreateRequestForm.tsx` ✏️ MODIFY
3. `frontend/components/customer-request/EditRequestForm.tsx` ✏️ MODIFY
4. `frontend/services/v5Api.ts` ✏️ MODIFY

---

## 6. TESTING PLAN

### **6.1. Manual Test Cases**

| TC | Scenario | Expected |
|----|----------|----------|
| 1 | Nhập tag mới khi tạo request | Tag được tạo và gắn vào request |
| 2 | Chọn tag có sẵn từ suggestions | Tag được gắn, usage_count tăng |
| 3 | Xóa tag khỏi request | Tag bị detach, usage_count giảm |
| 4 | Nhập tag trùng tên | Không tạo tag mới, chỉ gắn tag cũ |
| 5 | Chọn màu cho tag mới | Tag mới có đúng màu đã chọn |
| 6 | Search tag bằng keyword | Hiện danh sách tag phù hợp |
| 7 | Tag được tái sử dụng | Tag có thể dùng cho nhiều request |
| 8 | Xóa tag (soft delete) | Tag không hiện trong suggestions |

---

## 7. TIMELINE DỰ KIẾN

| Phase | Tasks | Estimated |
|-------|-------|-----------|
| **Day 1** | Database migration + Backend models | 4 hours |
| **Day 2** | Backend controller + API routes | 4 hours |
| **Day 3** | Frontend TagInput component | 4 hours |
| **Day 4** | Integration + Testing | 4 hours |

**Total:** ~16 hours (4 working days)

---

## 8. RISK ASSESSMENT

| Risk | Impact | Mitigation |
|------|--------|------------|
| Tag name conflict (case-insensitive) | Medium | Normalize to lowercase + unique index |
| Performance với nhiều tags | Low | Index trên usage_count + limit suggestions |
| Dữ liệu tags bị orphan | Low | Cascade delete trên pivot table |

**Risk Level:** 🟢 LOW

---

**APPROVED BY:** ________________  
**DATE:** ________________
