'use client';
import { MAX_IMAGES } from '@/lib/types';

interface Props {
  thumbnails: (string | null)[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onClear: (index: number) => void;
}

export default function ImageGrid({ thumbnails, activeIndex, onSelect, onClear }: Props) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
          画像一覧 ({thumbnails.filter(Boolean).length}/{MAX_IMAGES})
        </h3>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {Array.from({ length: MAX_IMAGES }).map((_, i) => (
          <div key={i} className="relative flex-shrink-0 group">
            <button
              onClick={() => onSelect(i)}
              className={`w-16 h-16 rounded-lg border-2 transition-all overflow-hidden flex items-center justify-center ${
                activeIndex === i
                  ? 'border-shopee-orange shadow-md scale-105'
                  : 'border-gray-200 hover:border-gray-400'
              }`}
            >
              {thumbnails[i] ? (
                <img src={thumbnails[i]!} className="w-full h-full object-cover" alt={`img${i + 1}`} />
              ) : (
                <span className="text-gray-300 text-xs">{i + 1}</span>
              )}
            </button>
            {thumbnails[i] && (
              <button
                onClick={(e) => { e.stopPropagation(); onClear(i); }}
                className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity leading-none"
              >
                ×
              </button>
            )}
            {i === 0 && (
              <div className="absolute -bottom-0.5 left-0 right-0 text-center">
                <span className="text-[9px] bg-shopee-orange text-white rounded px-0.5">F</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
