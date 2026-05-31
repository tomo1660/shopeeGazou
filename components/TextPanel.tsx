'use client';
import { useState } from 'react';
import { TextOptions, DEFAULT_TEXT_OPTIONS, FONT_FAMILIES } from '@/lib/types';

interface Props {
  onAddText: (options: TextOptions) => void;
  onUpdateSelected: (options: Partial<TextOptions>) => void;
}

export default function TextPanel({ onAddText, onUpdateSelected }: Props) {
  const [opts, setOpts] = useState<TextOptions>(DEFAULT_TEXT_OPTIONS);

  const update = (patch: Partial<TextOptions>) => {
    const next = { ...opts, ...patch };
    setOpts(next);
    onUpdateSelected(patch);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm space-y-3">
      <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">テキスト</h3>

      {/* Text input */}
      <textarea
        value={opts.text}
        onChange={(e) => setOpts({ ...opts, text: e.target.value })}
        placeholder="テキストを入力..."
        rows={3}
        className="w-full text-sm border border-gray-200 rounded-lg p-2 resize-none focus:outline-none focus:border-shopee-orange"
      />

      {/* Font family */}
      <div>
        <label className="text-xs text-gray-500 mb-1 block">フォント</label>
        <select
          value={opts.fontFamily}
          onChange={(e) => update({ fontFamily: e.target.value })}
          className="w-full text-sm border border-gray-200 rounded-lg p-1.5 focus:outline-none focus:border-shopee-orange"
        >
          {FONT_FAMILIES.map((f) => (
            <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
          ))}
        </select>
      </div>

      {/* Font size + color */}
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="text-xs text-gray-500 mb-1 block">サイズ</label>
          <input
            type="number"
            min={8}
            max={200}
            value={opts.fontSize}
            onChange={(e) => update({ fontSize: Number(e.target.value) })}
            className="w-full text-sm border border-gray-200 rounded-lg p-1.5 focus:outline-none focus:border-shopee-orange"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">文字色</label>
          <input
            type="color"
            value={opts.color}
            onChange={(e) => update({ color: e.target.value })}
            className="w-10 h-8 border border-gray-200 rounded-lg cursor-pointer"
          />
        </div>
      </div>

      {/* Style toggles */}
      <div className="flex gap-1.5">
        {[
          { key: 'bold', label: 'B', style: 'font-bold' },
          { key: 'italic', label: 'I', style: 'italic' },
          { key: 'underline', label: 'U', style: 'underline' },
        ].map(({ key, label, style }) => (
          <button
            key={key}
            onClick={() => update({ [key]: !opts[key as keyof TextOptions] } as Partial<TextOptions>)}
            className={`flex-1 py-1.5 text-sm rounded-lg border transition-all ${style} ${
              opts[key as keyof TextOptions]
                ? 'border-shopee-orange bg-shopee-orange-light text-shopee-orange'
                : 'border-gray-200 text-gray-500 hover:border-gray-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Text align */}
      <div>
        <label className="text-xs text-gray-500 mb-1 block">揃え</label>
        <div className="flex gap-1">
          {(['left', 'center', 'right'] as const).map((align) => (
            <button
              key={align}
              onClick={() => update({ textAlign: align })}
              className={`flex-1 py-1.5 text-xs rounded-lg border transition-all ${
                opts.textAlign === align
                  ? 'border-shopee-orange bg-shopee-orange-light text-shopee-orange'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              {align === 'left' ? '左' : align === 'center' ? '中' : '右'}
            </button>
          ))}
        </div>
      </div>

      {/* Stroke (outline) */}
      <div>
        <label className="text-xs text-gray-500 mb-1 block">縁取り</label>
        <div className="flex gap-2 items-center">
          <input
            type="range"
            min={0}
            max={10}
            value={opts.strokeWidth}
            onChange={(e) => update({ strokeWidth: Number(e.target.value), strokeColor: opts.strokeColor })}
            className="flex-1"
          />
          <span className="text-xs text-gray-500 w-6 text-center">{opts.strokeWidth}</span>
          <input
            type="color"
            value={opts.strokeColor}
            onChange={(e) => update({ strokeColor: e.target.value, strokeWidth: opts.strokeWidth })}
            className="w-8 h-7 border border-gray-200 rounded cursor-pointer"
          />
        </div>
      </div>

      {/* Add button */}
      <button
        onClick={() => onAddText(opts)}
        disabled={!opts.text.trim()}
        className="w-full py-2 bg-shopee-orange text-white text-sm font-medium rounded-lg hover:bg-shopee-orange-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        キャンバスに追加
      </button>
    </div>
  );
}
