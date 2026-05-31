'use client';
import { useRef } from 'react';

interface Props {
  frames: (string | null)[];
  selectedFrame: number | null;
  onFrameUpdate: (index: number, dataUrl: string | null) => void;
  onFrameSelect: (index: number | null) => void;
}

export default function FramePanel({ frames, selectedFrame, onFrameUpdate, onFrameSelect }: Props) {
  const fileRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  const handleFile = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      onFrameUpdate(index, ev.target?.result as string);
      // 画像をアップロード/変更したら自動的にそのフレームを適用
      onFrameSelect(index);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">フレーム (1枚目)</h3>
      </div>

      {/* フレームなしボタン */}
      <button
        onClick={() => onFrameSelect(null)}
        className={`w-full mb-2 py-1.5 px-3 text-xs rounded-lg border transition-all ${
          selectedFrame === null
            ? 'border-shopee-orange bg-shopee-orange-light text-shopee-orange font-semibold'
            : 'border-gray-200 text-gray-500 hover:border-gray-300'
        }`}
      >
        フレームなし
      </button>

      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`rounded-lg border-2 p-2 transition-all ${
              selectedFrame === i
                ? 'border-shopee-orange bg-shopee-orange-light'
                : 'border-gray-100 hover:border-gray-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {/* サムネイル */}
              <div className="w-12 h-12 rounded-lg bg-gray-50 border border-gray-200 flex-shrink-0 overflow-hidden">
                {frames[i] ? (
                  <img src={frames[i]!} className="w-full h-full object-cover" alt={`frame${i + 1}`} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300 text-lg">+</div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500 mb-1">フレーム {i + 1}</p>

                {!frames[i] ? (
                  /* 未アップロード: アップロードボタンのみ */
                  <button
                    onClick={(e) => { e.stopPropagation(); fileRefs[i].current?.click(); }}
                    className="w-full text-xs py-1 px-2 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                  >
                    📁 アップロード
                  </button>
                ) : (
                  /* アップロード済み: 適用 / 画像を変える / 削除 */
                  <div className="flex gap-1">
                    {/* 適用ボタン */}
                    <button
                      onClick={(e) => { e.stopPropagation(); onFrameSelect(i); }}
                      className={`flex-1 text-xs py-1 rounded-md transition-colors font-medium ${
                        selectedFrame === i
                          ? 'bg-shopee-orange text-white'
                          : 'bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200'
                      }`}
                    >
                      {selectedFrame === i ? '✓ 適用中' : '適用'}
                    </button>
                    {/* 画像変更ボタン */}
                    <button
                      onClick={(e) => { e.stopPropagation(); fileRefs[i].current?.click(); }}
                      className="text-xs py-1 px-2 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                      title="画像を変更"
                    >
                      🔄
                    </button>
                    {/* 削除ボタン */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onFrameUpdate(i, null);
                        if (selectedFrame === i) onFrameSelect(null);
                      }}
                      className="text-xs py-1 px-2 bg-red-50 hover:bg-red-100 text-red-500 rounded-md transition-colors"
                    >
                      削除
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* hiddenファイル入力 */}
            <input
              ref={fileRefs[i]}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFile(i, e)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        ))}
      </div>

      <p className="text-[10px] text-gray-400 mt-2">
        ※ フレームをアップロードすると自動で適用されます
      </p>
    </div>
  );
}
