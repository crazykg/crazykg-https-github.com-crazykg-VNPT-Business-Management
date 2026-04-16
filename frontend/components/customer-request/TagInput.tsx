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
  value, 
  onChange, 
  placeholder = 'Thêm tag...',
  disabled = false 
}) => {
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
        console.error('Failed to fetch tag suggestions:', error);
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
    if (!value.find(t => t.id === tag.id)) {
      onChange([...value, tag]);
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
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setShowColorPicker(false);
    }
  };

  const normalizedInput = input.toLowerCase().trim();
  const existingTag = suggestions.find(t => t.name === normalizedInput);

  return (
    <div ref={containerRef} className="relative">
      <div className={`flex flex-wrap gap-2 p-2 border rounded-lg min-h-[42px] transition-all ${
        disabled 
          ? 'bg-slate-50 border-slate-200 cursor-not-allowed' 
          : 'border-slate-300 focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary bg-white'
      }`}>
        {/* Selected tags */}
        {value.map(tag => (
          <span
            key={tag.id}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getColorClasses(tag.color)} ${
              disabled ? 'opacity-60' : ''
            }`}
          >
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLOR_OPTIONS.find(c => c.name === tag.color)?.hex }} />
            {tag.name}
            {!disabled && (
              <button
                type="button"
                onClick={() => handleRemoveTag(tag)}
                className="ml-1 hover:opacity-70 font-bold"
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
            placeholder={value.length === 0 ? placeholder : 'Thêm tag...'}
            className="flex-1 min-w-[120px] outline-none text-sm bg-transparent"
          />
        )}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex items-center text-xs text-slate-400">
            <svg className="animate-spin h-4 w-4 mr-1" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Đang tìm...
          </div>
        )}
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && (input || suggestions.length > 0) && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-64 overflow-auto">
          {/* Existing tags */}
          {suggestions.map(tag => (
            <button
              key={tag.id}
              type="button"
              onClick={() => handleSelectTag(tag)}
              className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center justify-between border-b border-slate-100 last:border-b-0"
            >
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${getColorClasses(tag.color)}`}>
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
                className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 text-primary font-medium flex items-center gap-2"
              >
                <span className="text-lg">+</span>
                <span>Tạo tag mới: "<strong>{input}</strong>"</span>
              </button>
              
              {/* Color picker */}
              <div className="px-3 py-2 bg-slate-50 border-t border-slate-100">
                <div className="text-xs text-slate-500 mb-2">Chọn màu cho tag:</div>
                <div className="flex gap-2 flex-wrap">
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
