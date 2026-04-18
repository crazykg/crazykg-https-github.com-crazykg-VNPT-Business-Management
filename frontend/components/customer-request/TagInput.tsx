import React, { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../../shared/api/apiFetch';

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
  disabled?: boolean;
}

interface TagSuggestion extends Tag {
  can_create?: boolean;
}

const shouldLogTagSuggestionErrors = !(
  typeof process !== 'undefined' && process.env.NODE_ENV === 'test'
);

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

export const TagInput: React.FC<TagInputProps> = ({
  value = [],
  onChange,
  placeholder = 'Thêm tag...',
  disabled = false
}) => {
  const selectedTags = value ?? [];
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState<Tag[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [selectedColor, setSelectedColor] = useState('blue');
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch suggestions (including popular tags when input is empty)
  useEffect(() => {
    const fetchSuggestions = async () => {
      setIsLoading(true);
      try {
        const keyword = input.trim();
        const endpoint = keyword
          ? `/api/v5/tags/suggestions?q=${encodeURIComponent(keyword)}`
          : '/api/v5/tags/suggestions';

        const response = await apiFetch(endpoint);
        const data = await response.json();
        setSuggestions(data.tags || []);

        if (keyword.length > 0) {
          setShowSuggestions(true);
        }
      } catch (error) {
        if (shouldLogTagSuggestionErrors) {
          console.error('Failed to fetch tag suggestions:', error);
        }
      } finally {
        setIsLoading(false);
      }
    };

    const timeout = setTimeout(fetchSuggestions, input.trim().length > 0 ? 300 : 0);
    return () => clearTimeout(timeout);
  }, [input]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
        setShowColorPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectTag = (tag: Tag) => {
    if (!selectedTags.find(t => t.id === tag.id)) {
      onChange([...selectedTags, tag]);
    }
    setInput('');
    setShowSuggestions(false);
    setShowColorPicker(false);
  };

  const handleCreateNewTag = () => {
    if (!input.trim()) return;
    
    const tagName = input.toLowerCase().trim();
    const newTag: Tag = {
      id: Date.now(), // Temporary ID, will be replaced by backend
      name: tagName,
      color: selectedColor,
    };
    
    if (!selectedTags.find(t => t.name === newTag.name)) {
      onChange([...selectedTags, newTag]);
    }
    setInput('');
    setShowSuggestions(false);
    setShowColorPicker(false);
  };

  const handleRemoveTag = (tagToRemove: Tag) => {
    onChange(selectedTags.filter(t => t.id !== tagToRemove.id));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && input.trim()) {
      e.preventDefault();
      if (suggestions.length > 0) {
        handleSelectTag(suggestions[0]);
      } else {
        handleCreateNewTag();
      }
    } else if (e.key === 'Backspace' && !input && selectedTags.length > 0) {
      handleRemoveTag(selectedTags[selectedTags.length - 1]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setShowColorPicker(false);
    }
  };

  const normalizedInput = input.toLowerCase().trim();
  const existingTag = suggestions.find(t => t.name === normalizedInput);

  return (
    <div ref={containerRef} className="relative">
      <div className={`flex min-h-[36px] flex-wrap gap-1.5 rounded border px-2.5 py-1.5 transition-all ${
        disabled
          ? 'bg-slate-50 border-slate-200 cursor-not-allowed'
          : 'border-slate-300 focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary bg-white'
      }`}>
        {/* Selected tags */}
        {selectedTags.map(tag => (
          <span
            key={tag.id}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${getColorClasses(tag.color)} ${
              disabled ? 'opacity-60' : ''
            }`}
          >
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLOR_OPTIONS.find(c => c.name === tag.color)?.hex }} />
            {tag.name}
            {!disabled && (
              <button
                type="button"
                onClick={() => handleRemoveTag(tag)}
                className="ml-0.5 text-[11px] font-bold hover:opacity-70"
              >
                ×
              </button>
            )}
          </span>
        ))}

        {/* Input */}
        {!disabled && (
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setShowSuggestions(true)}
            placeholder={selectedTags.length === 0 ? placeholder : 'Thêm tag...'}
            className="min-w-[120px] flex-1 bg-transparent text-sm leading-5 outline-none"
          />
        )}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex items-center text-[11px] text-slate-400">
            <svg className="mr-1 h-4 w-4 animate-spin" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Đang tìm...
          </div>
        )}
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && (input || suggestions.length > 0) && (
        <div className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded border border-slate-200 bg-white shadow-lg">
          {/* Existing tags */}
          {suggestions.map(tag => (
            <button
              key={tag.id}
              type="button"
              onClick={() => handleSelectTag(tag)}
              className="flex w-full items-center justify-between border-b border-slate-100 px-3 py-2 text-left text-sm hover:bg-slate-50 last:border-b-0"
            >
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${getColorClasses(tag.color)}`}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLOR_OPTIONS.find(c => c.name === tag.color)?.hex }} />
                {tag.name}
              </span>
              {tag.usage_count !== undefined && tag.usage_count > 0 && (
                <span className="text-xs text-slate-400">
                  Đã dùng {tag.usage_count} lần
                </span>
              )}
            </button>
          ))}

          {/* Create new tag option */}
          {input && !existingTag && (
            <div className="border-t border-slate-200">
              <button
                type="button"
                onClick={handleCreateNewTag}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-primary hover:bg-slate-50"
              >
                <span className="text-lg">+</span>
                <span>Tạo tag mới: "<strong>{input}</strong>"</span>
              </button>

              {/* Color picker */}
              <div className="border-t border-slate-100 bg-slate-50 px-3 py-2">
                <div className="mb-2 text-[11px] text-slate-500">Chọn màu cho tag:</div>
                <div className="flex flex-wrap gap-2">
                  {COLOR_OPTIONS.map(color => (
                    <button
                      key={color.name}
                      type="button"
                      onClick={() => {
                        setSelectedColor(color.name);
                      }}
                      className={`w-7 h-7 rounded-full border-2 transition-all ${
                        selectedColor === color.name 
                          ? 'border-slate-900 scale-110 shadow-md' 
                          : 'border-transparent hover:border-slate-300'
                      }`}
                      style={{ backgroundColor: color.hex }}
                      title={color.name}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* No results */}
          {!isLoading && input && suggestions.length === 0 && !showColorPicker && (
            <div className="px-3 py-4 text-center text-sm text-slate-400">
              Nhấn Enter để tạo tag mới
            </div>
          )}
        </div>
      )}
    </div>
  );
};
