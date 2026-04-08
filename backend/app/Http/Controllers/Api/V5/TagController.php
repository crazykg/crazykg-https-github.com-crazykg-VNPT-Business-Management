<?php

namespace App\Http\Controllers\Api\V5;

use App\Models\Tag;
use App\Models\CustomerRequestCase;
use App\Http\Controllers\Api\V5\V5BaseController;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class TagController extends V5BaseController
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
            'can_create' => !Tag::where('name', strtolower(trim($keyword)))->whereNull('deleted_at')->exists(),
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
     * PUT /api/v5/tags/{tag}
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
     * DELETE /api/v5/tags/{tag}
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
        $this->updateUsageCounts();

        return response()->json([
            'tags' => $case->tags()->get(['tags.id', 'tags.name', 'tags.color']),
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
        $this->updateUsageCounts();

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
        $this->updateUsageCounts();

        return response()->json([
            'tags' => $case->tags()->get(['tags.id', 'tags.name', 'tags.color']),
        ]);
    }

    /**
     * GET /api/v5/customer-request-cases/{caseId}/tags
     * Get tags for a case
     */
    public function getCaseTags(int $caseId): JsonResponse
    {
        $case = CustomerRequestCase::findOrFail($caseId);
        $tags = $case->tags()->get(['tags.id', 'tags.name', 'tags.color']);

        return response()->json(['tags' => $tags]);
    }

    /**
     * Update usage counts for all tags
     */
    private function updateUsageCounts(): void
    {
        // Recalculate usage counts for all tags
        $counts = DB::table('customer_request_case_tags')
            ->select('tag_id', DB::raw('COUNT(*) as count'))
            ->groupBy('tag_id')
            ->pluck('count', 'tag_id');

        // Update tags with counts
        foreach ($counts as $tagId => $count) {
            Tag::where('id', $tagId)->update(['usage_count' => $count]);
        }

        // Reset usage_count to 0 for unused tags
        Tag::whereNotIn('id', function ($query) {
            $query->select('tag_id')->from('customer_request_case_tags');
        })->update(['usage_count' => 0]);
    }
}
