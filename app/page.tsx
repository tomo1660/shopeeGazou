'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import CountryTabs from '@/components/CountryTabs';
import FramePanel from '@/components/FramePanel';
import TextPanel from '@/components/TextPanel';
import TranslationPanel from '@/components/TranslationPanel';
import ImageGrid from '@/components/ImageGrid';
import CanvasEditor from '@/components/CanvasEditor';
import { CountryCode, COUNTRIES, MAX_IMAGES, TextOptions } from '@/lib/types';
import type { CanvasEditorRef } from '@/components/CanvasEditor';

// ---- types ----
type FrameStore = Record<CountryCode, (string | null)[]>;
type SelectedFrameStore = Record<CountryCode, number | null>;
type JsonStore = Record<CountryCode, (string | null)[]>;
type ThumbStore = Record<CountryCode, (string | null)[]>;

function initFrameStore(): FrameStore {
  const s: Partial<FrameStore> = {};
  COUNTRIES.forEach((c) => { s[c.code] = [null, null, null]; });
  return s as FrameStore;
}
function initSelectedFrameStore(): SelectedFrameStore {
  const s: Partial<SelectedFrameStore> = {};
  COUNTRIES.forEach((c) => { s[c.code] = null; });
  return s as SelectedFrameStore;
}
function initFlat(): Record<CountryCode, (string | null)[]> {
  const s: Partial<Record<CountryCode, (string | null)[]>> = {};
  COUNTRIES.forEach((c) => { s[c.code] = Array(MAX_IMAGES).fill(null); });
  return s as Record<CountryCode, (string | null)[]>;
}

// ---- component ----
export default function Home() {
  // React state (for rendering)
  const [country, setCountry] = useState<CountryCode>('SG');
  const [activeIdx, setActiveIdx] = useState(0);
  const [frames, setFrames] = useState<FrameStore>(initFrameStore);
  const [selectedFrames, setSelectedFrames] = useState<SelectedFrameStore>(initSelectedFrameStore);
  const [thumbnails, setThumbnails] = useState<ThumbStore>(initFlat);
  const [canvasReady, setCanvasReady] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [cropMode, setCropMode] = useState(false);
  const [downloadFormat, setDownloadFormat] = useState<'png' | 'jpg'>('png');

  // Refs (for synchronous callback access, avoids stale closures)
  const s = useRef({
    country: 'SG' as CountryCode,
    activeIdx: 0,
    frames: initFrameStore(),
    selectedFrames: initSelectedFrameStore(),
    jsonStore: initFlat(),
  });
  // Keep ref in sync with state
  useEffect(() => { s.current.country = country; }, [country]);
  useEffect(() => { s.current.activeIdx = activeIdx; }, [activeIdx]);
  useEffect(() => { s.current.frames = frames; }, [frames]);
  useEffect(() => { s.current.selectedFrames = selectedFrames; }, [selectedFrames]);

  const canvasRef = useRef<CanvasEditorRef>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ---- canvas helpers ----
  const applyFrame = useCallback((c: CountryCode, idx: number) => {
    if (idx !== 0) { canvasRef.current?.setFrame(null); return; }
    const fIdx = s.current.selectedFrames[c];
    const fd = fIdx !== null ? s.current.frames[c][fIdx] : null;
    canvasRef.current?.setFrame(fd ?? null);
  }, []);

  const loadSlot = useCallback((c: CountryCode, idx: number) => {
    const json = s.current.jsonStore[c][idx];
    if (json) {
      canvasRef.current?.loadCanvasJson(json);
    } else {
      canvasRef.current?.clearCanvas();
    }
    applyFrame(c, idx);
  }, [applyFrame]);

  const saveCurrentSlot = useCallback(() => {
    const { country: c, activeIdx: idx } = s.current;
    const json = canvasRef.current?.getCanvasJson() ?? null;
    const thumb = canvasRef.current?.exportThumbnail() ?? null;
    s.current.jsonStore[c][idx] = json;
    if (thumb) {
      setThumbnails((prev) => {
        const next = { ...prev, [c]: [...prev[c]] };
        next[c][idx] = thumb;
        return next;
      });
    }
  }, []);

  // Load first slot when canvas is ready
  useEffect(() => {
    if (!canvasReady) return;
    loadSlot(country, activeIdx);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasReady]);

  // ---- event handlers ----
  const handleSelectImage = useCallback((idx: number) => {
    saveCurrentSlot();
    s.current.activeIdx = idx;
    setActiveIdx(idx);
    loadSlot(s.current.country, idx);
  }, [saveCurrentSlot, loadSlot]);

  const handleSelectCountry = useCallback((code: CountryCode) => {
    saveCurrentSlot();
    s.current.country = code;
    s.current.activeIdx = 0;
    setCountry(code);
    setActiveIdx(0);
    loadSlot(code, 0);
  }, [saveCurrentSlot, loadSlot]);

  const handleFrameSelect = useCallback((frameIdx: number | null) => {
    const c = s.current.country;
    s.current.selectedFrames[c] = frameIdx;
    setSelectedFrames((prev) => ({ ...prev, [c]: frameIdx }));
    if (s.current.activeIdx === 0) {
      const fd = frameIdx !== null ? s.current.frames[c][frameIdx] : null;
      canvasRef.current?.setFrame(fd ?? null);
    }
  }, []);

  const handleFrameUpdate = useCallback((index: number, dataUrl: string | null) => {
    const c = s.current.country;
    s.current.frames[c][index] = dataUrl;
    setFrames((prev) => {
      const next = { ...prev, [c]: [...prev[c]] };
      next[c][index] = dataUrl;
      return next;
    });
    if (s.current.selectedFrames[c] === index && s.current.activeIdx === 0) {
      canvasRef.current?.setFrame(dataUrl ?? null);
    }
  }, []);

  const handleCanvasChange = useCallback(() => {
    const { country: c, activeIdx: idx } = s.current;
    const json = canvasRef.current?.getCanvasJson() ?? null;
    const thumb = canvasRef.current?.exportThumbnail() ?? null;
    s.current.jsonStore[c][idx] = json;
    if (thumb) {
      setThumbnails((prev) => {
        const next = { ...prev, [c]: [...prev[c]] };
        next[c][idx] = thumb;
        return next;
      });
    }
  }, []);

  const handleClearSlot = useCallback((idx: number) => {
    const c = s.current.country;
    s.current.jsonStore[c][idx] = null;
    setThumbnails((prev) => {
      const next = { ...prev, [c]: [...prev[c]] };
      next[c][idx] = null;
      return next;
    });
    if (idx === s.current.activeIdx) {
      canvasRef.current?.clearCanvas();
      applyFrame(c, idx);
    }
  }, [applyFrame]);

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => canvasRef.current?.addImageFromUrl(ev.target?.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // ブラウザネイティブのURLダウンロードヘルパー
  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  // ---- 一括ZIPダウンロード（PNG or JPG） ----
  const handleDownload = async (fmt: 'png' | 'jpg' = downloadFormat) => {
    setDownloading(true);
    try {
      const { country: c, activeIdx: idx } = s.current;
      s.current.jsonStore[c][idx] = canvasRef.current?.getCanvasJson() ?? null;

      const [{ default: JSZip }, { fabric }, { CANVAS_DISPLAY_SIZE, CANVAS_EXPORT_MULTIPLIER }] = await Promise.all([
        import('jszip'),
        import('fabric'),
        import('@/lib/types'),
      ]);

      const countryInfo = COUNTRIES.find((co) => co.code === c)!;
      const zip = new JSZip();
      const folder = zip.folder(`shopee-${c}-${countryInfo.name}`);
      const ext = fmt === 'jpg' ? 'jpg' : 'png';

      let count = 0;
      for (let i = 0; i < MAX_IMAGES; i++) {
        const json = s.current.jsonStore[c][i];
        if (!json) continue;
        await new Promise<void>((resolve) => {
          const el = document.createElement('canvas');
          el.width = CANVAS_DISPLAY_SIZE; el.height = CANVAS_DISPLAY_SIZE;
          const oc = new (fabric as any).Canvas(el, { width: CANVAS_DISPLAY_SIZE, height: CANVAS_DISPLAY_SIZE });
          oc.loadFromJSON(json, () => {
            oc.renderAll();
            const dataUrl = oc.toDataURL({
              format: fmt,
              quality: fmt === 'jpg' ? 0.92 : 1,
              multiplier: CANVAS_EXPORT_MULTIPLIER,
            });
            const base64 = dataUrl.split(',')[1];
            folder?.file(`image-${String(i + 1).padStart(2, '0')}.${ext}`, base64, { base64: true });
            count++; oc.dispose(); resolve();
          });
        });
      }

      if (count === 0) throw new Error('ダウンロードする画像がありません。まず画像を作成してください。');
      const blob = await zip.generateAsync({ type: 'blob' });
      downloadBlob(blob, `shopee-${c}.zip`);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setDownloading(false);
    }
  };

  // ---- 現在の1枚を保存（PNG or JPG） ----
  const handleDownloadSingleJpg = () => {
    const dataUrl = canvasRef.current?.exportToPng();
    if (!dataUrl) { alert('保存する画像がありません。'); return; }
    const fmt = downloadFormat;
    const ext = fmt === 'jpg' ? 'jpg' : 'png';
    const filename = `shopee-image-${activeIdx + 1}.${ext}`;

    if (fmt === 'png') {
      // PNGはそのままデータURLからダウンロード
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = filename;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } else {
      // JPGは白背景でオフスクリーンキャンバス経由
      const img = new Image();
      img.onload = () => {
        const cv = document.createElement('canvas');
        cv.width = img.width; cv.height = img.height;
        const ctx = cv.getContext('2d')!;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, cv.width, cv.height);
        ctx.drawImage(img, 0, 0);
        cv.toBlob((blob) => {
          if (blob) downloadBlob(blob, filename);
        }, 'image/jpeg', 0.92);
      };
      img.src = dataUrl;
    }
  };

  // ---- render ----
  const currentThumbs = thumbnails[country];
  const currentFrames = frames[country];
  const currentSelectedFrame = selectedFrames[country];
  const countryInfo = COUNTRIES.find((c) => c.code === country)!;
  const filledCount = currentThumbs.filter(Boolean).length;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-shopee-orange text-white px-4 py-3 shadow-md flex-shrink-0">
        <div className="max-w-screen-xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🛒</span>
            <h1 className="text-lg font-bold">Shopee 商品画像作成ツール</h1>
          </div>
          <span className="text-orange-200 text-sm">出力: 1080×1080px</span>
        </div>
      </header>

      <div className="max-w-screen-xl mx-auto px-4 py-4 w-full space-y-4 flex-1">
        {/* Country tabs */}
        <CountryTabs selected={country} onChange={handleSelectCountry} />

        {/* Main work area */}
        <div className="flex gap-4 items-start">
          {/* LEFT PANEL */}
          <div className="w-52 flex-shrink-0 space-y-3">
            {activeIdx === 0 && (
              <FramePanel
                frames={currentFrames}
                selectedFrame={currentSelectedFrame}
                onFrameUpdate={handleFrameUpdate}
                onFrameSelect={handleFrameSelect}
              />
            )}

            {/* Image Tools */}
            <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm space-y-2">
              <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">画像追加</h3>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-2 text-sm bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors flex items-center justify-center gap-1.5"
              >
                <span>📁</span><span>ファイルから選択</span>
              </button>
              <button
                onClick={() => canvasRef.current?.pasteFromClipboard()}
                className="w-full py-2 text-sm bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200 rounded-lg transition-colors flex items-center justify-center gap-1.5"
              >
                <span>📋</span><span>クリップボードから貼り付け</span>
              </button>
              <div className="text-center text-xs text-gray-400 py-1">
                または <kbd className="bg-gray-100 px-1 rounded text-gray-600">Ctrl+V</kbd> で貼付
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageFileChange} />
            </div>

            {/* Canvas actions */}
            <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm space-y-2">
              <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">オブジェクト操作</h3>

              {/* トリミングモード中は専用ボタンを表示 */}
              {cropMode ? (
                <div className="space-y-1.5">
                  <p className="text-[10px] text-blue-600 font-semibold text-center bg-blue-50 rounded-lg py-1 px-2">
                    ✂ 青枠をドラッグして範囲を調整
                  </p>
                  <button
                    onClick={() => canvasRef.current?.applyCrop()}
                    className="w-full py-2 text-xs bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    ✓ トリミングを適用
                  </button>
                  <button
                    onClick={() => canvasRef.current?.cancelCrop()}
                    className="w-full py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    ✗ キャンセル
                  </button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button onClick={() => canvasRef.current?.bringForward()}
                      className="py-1.5 text-xs bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors">
                      ↑ 前面
                    </button>
                    <button onClick={() => canvasRef.current?.sendBackward()}
                      className="py-1.5 text-xs bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors">
                      ↓ 背面
                    </button>
                  </div>
                  <button
                    onClick={() => canvasRef.current?.startCrop()}
                    className="w-full py-1.5 text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors font-medium"
                  >
                    ✂ トリミング（画像選択後）
                  </button>
                  <button
                    onClick={() => canvasRef.current?.deleteSelected()}
                    className="w-full py-1.5 text-xs bg-red-50 text-red-500 hover:bg-red-100 border border-red-100 rounded-lg transition-colors"
                  >
                    🗑 選択削除 (Del)
                  </button>
                  <button
                    onClick={() => {
                      if (!confirm('このキャンバスをクリアしますか？')) return;
                      canvasRef.current?.clearCanvas();
                      applyFrame(country, activeIdx);
                    }}
                    className="w-full py-1.5 text-xs bg-red-50 text-red-500 hover:bg-red-100 border border-red-100 rounded-lg transition-colors"
                  >
                    🔄 キャンバスをクリア
                  </button>
                </>
              )}
            </div>

            {/* Slot info */}
            <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
              <div className="text-xs text-gray-500 space-y-1">
                <div className="flex justify-between">
                  <span>作成枚数</span>
                  <span className="font-semibold text-gray-700">{filledCount} / {MAX_IMAGES}</span>
                </div>
                <div className="flex justify-between">
                  <span>現在のスロット</span>
                  <span className="font-semibold text-gray-700">{activeIdx + 1}</span>
                </div>
              </div>
            </div>
          </div>

          {/* CENTER: Canvas */}
          <div className="flex-shrink-0 space-y-2">
            <div className="flex items-center gap-2 h-7">
              <span className="text-sm font-semibold text-gray-700">
                {countryInfo.flag} {countryInfo.name}
              </span>
              <span className="text-xs text-gray-400">—</span>
              <span className="text-xs text-gray-600">画像 {activeIdx + 1}</span>
            </div>
            <div className="relative">
              <CanvasEditor
                ref={canvasRef}
                isFirstImage={activeIdx === 0}
                onCanvasChange={handleCanvasChange}
                onReady={() => setCanvasReady(true)}
                onCropModeChange={setCropMode}
              />
              {!canvasReady && (
                <div className="absolute inset-0 bg-gray-50/90 flex items-center justify-center rounded-xl z-10">
                  <div className="text-center space-y-2">
                    <div className="w-8 h-8 border-2 border-shopee-orange border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-gray-500 text-sm">キャンバス準備中...</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT PANEL */}
          <div className="flex-1 min-w-0 max-w-xs space-y-3">
            <TextPanel
              onAddText={(opts: TextOptions) => canvasRef.current?.addText(opts)}
              onUpdateSelected={(opts: Partial<TextOptions>) => canvasRef.current?.updateSelectedText(opts)}
            />
            <TranslationPanel
              selectedCountry={country}
              onInsertText={(text: string) =>
                canvasRef.current?.addText({
                  text, fontFamily: 'Noto Sans JP', fontSize: 32, color: '#000000',
                  bold: false, italic: false, underline: false, textAlign: 'left',
                  strokeColor: '#ffffff', strokeWidth: 0,
                })
              }
              onInsertImage={(dataUrl: string) =>
                canvasRef.current?.addImageFromUrl(dataUrl)
              }
            />
          </div>
        </div>

        {/* Image grid + download */}
        <div className="space-y-3">
          <ImageGrid
            thumbnails={currentThumbs}
            activeIndex={activeIdx}
            onSelect={handleSelectImage}
            onClear={handleClearSlot}
          />

          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-4">
              {/* 形式選択 */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-600">形式:</span>
                <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
                  {(['png', 'jpg'] as const).map((fmt) => (
                    <button
                      key={fmt}
                      onClick={() => setDownloadFormat(fmt)}
                      className={`px-3 py-1.5 transition-colors ${
                        downloadFormat === fmt
                          ? 'bg-shopee-orange text-white'
                          : 'bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {fmt.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* 説明テキスト */}
              <p className="text-xs text-gray-400 flex-1">
                {filledCount > 0
                  ? `${filledCount}枚の画像を 1080×1080px の ${downloadFormat.toUpperCase()} でダウンロード`
                  : '画像を作成するとダウンロードできます'}
              </p>

              {/* ボタン群 */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* 現在の1枚を保存 */}
                <button
                  onClick={handleDownloadSingleJpg}
                  disabled={filledCount === 0}
                  className="px-4 py-2.5 bg-white text-shopee-orange font-semibold rounded-xl hover:bg-shopee-orange-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-shopee-orange flex items-center gap-1.5 text-sm"
                >
                  <span>💾</span>
                  <span>現在の1枚を保存</span>
                </button>

                {/* 全画像ZIPダウンロード */}
                <button
                  onClick={() => handleDownload(downloadFormat)}
                  disabled={downloading || filledCount === 0}
                  className="px-5 py-2.5 bg-shopee-orange text-white font-semibold rounded-xl hover:bg-shopee-orange-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md flex items-center gap-2 text-sm"
                >
                  {downloading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>ZIPを作成中...</span>
                    </>
                  ) : (
                    <>
                      <span>📦</span>
                      <span>全画像をZIPでダウンロード</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
