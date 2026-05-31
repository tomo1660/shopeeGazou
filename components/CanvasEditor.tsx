'use client';
import {
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
  useState,
} from 'react';
import { TextOptions, CANVAS_DISPLAY_SIZE, CANVAS_EXPORT_MULTIPLIER } from '@/lib/types';

export interface CanvasEditorRef {
  addImageFromUrl: (dataUrl: string) => void;
  setFrame: (dataUrl: string | null) => void;
  addText: (options: TextOptions) => void;
  getCanvasJson: () => string;
  loadCanvasJson: (json: string) => void;
  exportToPng: () => string;
  exportThumbnail: () => string;
  deleteSelected: () => void;
  clearCanvas: () => void;
  bringForward: () => void;
  sendBackward: () => void;
  updateSelectedText: (options: Partial<TextOptions>) => void;
  startCrop: () => void;
  applyCrop: () => void;
  cancelCrop: () => void;
  pasteFromClipboard: () => Promise<void>;
}

interface Props {
  isFirstImage: boolean;
  onCanvasChange?: () => void;
  onReady?: () => void;
  onCropModeChange?: (active: boolean) => void;
}

const CROP_RECT_NAME = '__crop_rect__';

const CanvasEditor = forwardRef<CanvasEditorRef, Props>(
  ({ isFirstImage, onCanvasChange, onReady, onCropModeChange }, ref) => {
  const canvasEl = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fc = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fabricNs = useRef<any>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [cropActive, setCropActive] = useState(false);

  const isFocusedRef = useRef(false);
  const onCanvasChangeRef = useRef(onCanvasChange);
  onCanvasChangeRef.current = onCanvasChange;
  const onCropModeChangeRef = useRef(onCropModeChange);
  onCropModeChangeRef.current = onCropModeChange;
  const loadingRef = useRef(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cropTargetRef = useRef<any>(null);  // 切り抜き対象の画像オブジェクト
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cropRectRef = useRef<any>(null);    // 切り抜き範囲を示すRect

  useEffect(() => { isFocusedRef.current = isFocused; }, [isFocused]);

  // cropActive が変化したら親コンポーネントへ通知
  useEffect(() => { onCropModeChangeRef.current?.(cropActive); }, [cropActive]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!canvasEl.current) return;
    let disposed = false;
    let cleanupFns: (() => void)[] = [];

    import('fabric').then((mod) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fabric = (mod as any).fabric ?? (mod as any).default ?? mod;
      if (!fabric || !fabric.Canvas) {
        setInitError('Fabric.jsの読み込みに失敗しました。ページを再読み込みしてください。');
        return;
      }
      fabricNs.current = fabric;

      if (disposed || !canvasEl.current) return;

      const canvas = new fabric.Canvas(canvasEl.current, {
        width: CANVAS_DISPLAY_SIZE,
        height: CANVAS_DISPLAY_SIZE,
        backgroundColor: '#ffffff',
        preserveObjectStacking: true,
      });
      fc.current = canvas;

      const notify = () => { if (!loadingRef.current) onCanvasChangeRef.current?.(); };
      canvas.on('object:modified', notify);
      canvas.on('object:added', notify);
      canvas.on('object:removed', notify);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key !== 'Delete' && e.key !== 'Backspace') return;
        if (!isFocusedRef.current) return;
        const active = canvas.getActiveObject();
        if (!active) return;
        // トリミング中はcropRectを削除しない
        if ((active as any).name === CROP_RECT_NAME) return;
        if (!(active.type === 'i-text' && (active as any).isEditing) &&
            !(active.type === 'textbox' && (active as any).isEditing)) {
          canvas.remove(active);
          canvas.renderAll();
          notify();
        }
      };

      // ---- ペーストハンドラー（4段階フォールバック） ----
      const handlePaste = (e: ClipboardEvent) => {
        const f = fabricNs.current;
        if (!f) return;

        const items = Array.from(e.clipboardData?.items || []);
        const activeEl = document.activeElement;
        const isInputFocused = !!(activeEl &&
          (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA'));

        // Blobをキャンバスに追加するヘルパー
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const addBlobToCanvas = (blob: Blob) => {
          const url = URL.createObjectURL(blob);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          f.Image.fromURL(url, (img: any) => {
            const scale = Math.min(
              (CANVAS_DISPLAY_SIZE * 0.85) / (img.width || 1),
              (CANVAS_DISPLAY_SIZE * 0.85) / (img.height || 1)
            );
            img.scale(scale);
            img.set({ left: CANVAS_DISPLAY_SIZE / 2, top: CANVAS_DISPLAY_SIZE / 2, originX: 'center', originY: 'center' });
            canvas.add(img);
            canvas.setActiveObject(img);
            canvas.renderAll();
            URL.revokeObjectURL(url);
            notify();
          });
        };

        // navigator.clipboard.read() で画像を取得するヘルパー
        const tryClipboardAPI = async () => {
          if (!navigator.clipboard?.read) return false;
          try {
            const clipItems = await navigator.clipboard.read();
            for (const item of clipItems) {
              const imageType = item.types.find((t) => t.startsWith('image/'));
              if (imageType) {
                const blob = await item.getType(imageType);
                addBlobToCanvas(blob);
                return true;
              }
            }
          } catch { /* permission denied 等 */ }
          return false;
        };

        // ★ 重要: バイナリ画像はinputフォーカスに関係なく最優先で処理
        // （テキスト入力欄がフォーカスされていても画像ペーストは動作させる）
        const imgItem = items.find((it) => it.type.startsWith('image/'));
        if (imgItem) {
          const blob = imgItem.getAsFile();
          if (blob && blob.size > 0) {
            e.preventDefault(); // inputへのテキスト貼り付けを阻止
            addBlobToCanvas(blob);
            return;
          }
        }

        // テキスト入力欄がフォーカスされている場合は以降の処理をスキップ
        // （テキスト貼り付けはブラウザのデフォルト動作に任せる）
        if (isInputFocused) return;

        // 2. HTMLに含まれる<img>タグ（ブラウザの「画像をコピー」）
        const htmlItem = items.find((it) => it.type === 'text/html');
        if (htmlItem) {
          e.preventDefault();
          htmlItem.getAsString(async (html) => {
            const match = html.match(/src=["']([^"']+)["']/i);
            const src = match?.[1]?.replace(/&amp;/g, '&');
            if (src) {
              // data: URL または blob: URL → 直接fetch
              if (src.startsWith('data:image/') || src.startsWith('blob:')) {
                try {
                  const res = await fetch(src);
                  const blob = await res.blob();
                  if (blob.size > 0) { addBlobToCanvas(blob); return; }
                } catch { /* ignore */ }
              }
              // http(s): URL → サーバープロキシ経由でCORS回避
              if (src.startsWith('http')) {
                try {
                  const res = await fetch(`/api/proxy-image?url=${encodeURIComponent(src)}`);
                  if (res.ok) {
                    const blob = await res.blob();
                    if (blob.size > 0) { addBlobToCanvas(blob); return; }
                  }
                } catch { /* ignore */ }
              }
            }
            // 3. navigator.clipboard.read() フォールバック
            await tryClipboardAPI();
          });
          return;
        }

        // 画像関連アイテムがない場合も navigator.clipboard.read() を試みる
        if (!items.some((it) => it.type.startsWith('image/'))) {
          (async () => { await tryClipboardAPI(); })();
        }

        // テキストペースト（キャンバスフォーカス時のみ）
        if (isFocusedRef.current) {
          const active = canvas.getActiveObject();
          if ((active?.type === 'i-text' || active?.type === 'textbox') &&
              (active as any).isEditing) return;
          const txtItem = items.find((it) => it.type === 'text/plain');
          if (txtItem) {
            txtItem.getAsString((text: string) => {
              if (!text.trim()) return;
              const t = new f.Textbox(text, {
                left: CANVAS_DISPLAY_SIZE / 2, top: CANVAS_DISPLAY_SIZE / 2,
                originX: 'center', originY: 'center',
                width: Math.round(CANVAS_DISPLAY_SIZE * 0.7),
                fontFamily: 'Noto Sans JP', fontSize: 32, fill: '#000000',
              });
              canvas.add(t);
              canvas.setActiveObject(t);
              canvas.renderAll();
              notify();
            });
          }
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('paste', handlePaste);
      cleanupFns = [
        () => document.removeEventListener('keydown', handleKeyDown),
        () => document.removeEventListener('paste', handlePaste),
        () => { canvas.dispose(); fc.current = null; },
      ];

      onReady?.();
    });

    return () => {
      disposed = true;
      cleanupFns.forEach((fn) => fn());
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(ref, () => ({
    addImageFromUrl: (dataUrl: string) => {
      const canvas = fc.current;
      const fabric = fabricNs.current;
      if (!canvas || !fabric) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fabric.Image.fromURL(dataUrl, (img: any) => {
        const scale = Math.min(
          (CANVAS_DISPLAY_SIZE * 0.85) / (img.width || 1),
          (CANVAS_DISPLAY_SIZE * 0.85) / (img.height || 1)
        );
        img.scale(scale);
        img.set({ left: CANVAS_DISPLAY_SIZE / 2, top: CANVAS_DISPLAY_SIZE / 2, originX: 'center', originY: 'center' });
        canvas.add(img);
        canvas.setActiveObject(img);
        canvas.renderAll();
        onCanvasChangeRef.current?.();
      });
    },

    setFrame: (dataUrl: string | null) => {
      const canvas = fc.current;
      const fabric = fabricNs.current;
      if (!canvas || !fabric) return;
      if (!dataUrl) {
        canvas.setBackgroundImage(null, () => {
          canvas.setBackgroundColor('#ffffff', () => {
            canvas.renderAll();
            onCanvasChangeRef.current?.();
          });
        });
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fabric.Image.fromURL(dataUrl, (img: any) => {
        canvas.setBackgroundImage(img, () => {
          canvas.renderAll();
          onCanvasChangeRef.current?.();
        }, {
          scaleX: CANVAS_DISPLAY_SIZE / (img.width || CANVAS_DISPLAY_SIZE),
          scaleY: CANVAS_DISPLAY_SIZE / (img.height || CANVAS_DISPLAY_SIZE),
        });
      });
    },

    addText: (options: TextOptions) => {
      const canvas = fc.current;
      const fabric = fabricNs.current;
      if (!canvas || !fabric) return;
      const t = new fabric.Textbox(options.text || 'テキスト', {
        left: CANVAS_DISPLAY_SIZE / 2, top: CANVAS_DISPLAY_SIZE / 2,
        originX: 'center', originY: 'center',
        width: Math.round(CANVAS_DISPLAY_SIZE * 0.7),
        fontFamily: options.fontFamily,
        fontSize: options.fontSize,
        fill: options.color,
        fontWeight: options.bold ? 'bold' : 'normal',
        fontStyle: options.italic ? 'italic' : 'normal',
        underline: options.underline,
        textAlign: options.textAlign,
        stroke: options.strokeWidth > 0 ? options.strokeColor : undefined,
        strokeWidth: options.strokeWidth > 0 ? options.strokeWidth : 0,
        paintFirst: 'stroke',
      });
      canvas.add(t);
      canvas.setActiveObject(t);
      canvas.renderAll();
      onCanvasChangeRef.current?.();
    },

    getCanvasJson: () => {
      const canvas = fc.current;
      if (!canvas) return '';
      return JSON.stringify(canvas.toJSON(['backgroundImage', 'backgroundColor']));
    },

    loadCanvasJson: (json: string) => {
      const canvas = fc.current;
      if (!canvas || !json) return;
      loadingRef.current = true;
      canvas.loadFromJSON(json, () => {
        canvas.renderAll();
        loadingRef.current = false;
      });
    },

    exportToPng: () => {
      const canvas = fc.current;
      if (!canvas) return '';
      return canvas.toDataURL({ format: 'png', multiplier: CANVAS_EXPORT_MULTIPLIER });
    },

    exportThumbnail: () => {
      const canvas = fc.current;
      if (!canvas) return '';
      return canvas.toDataURL({ format: 'jpeg', quality: 0.5, multiplier: 0.2 });
    },

    deleteSelected: () => {
      const canvas = fc.current;
      if (!canvas) return;
      const active = canvas.getActiveObject();
      if (active && (active as any).name !== CROP_RECT_NAME) {
        canvas.remove(active);
        canvas.renderAll();
        onCanvasChangeRef.current?.();
      }
    },

    clearCanvas: () => {
      const canvas = fc.current;
      if (!canvas) return;
      // トリミング中ならキャンセル
      if (cropRectRef.current) canvas.remove(cropRectRef.current);
      if (cropTargetRef.current) cropTargetRef.current.set({ selectable: true, evented: true });
      cropRectRef.current = null;
      cropTargetRef.current = null;
      setCropActive(false);
      canvas.clear();
      canvas.setBackgroundColor('#ffffff', () => canvas.renderAll());
      onCanvasChangeRef.current?.();
    },

    bringForward: () => {
      const canvas = fc.current;
      if (!canvas) return;
      const a = canvas.getActiveObject();
      if (a) { canvas.bringForward(a); canvas.renderAll(); }
    },

    sendBackward: () => {
      const canvas = fc.current;
      if (!canvas) return;
      const a = canvas.getActiveObject();
      if (a) { canvas.sendBackwards(a); canvas.renderAll(); }
    },

    updateSelectedText: (options: Partial<TextOptions>) => {
      const canvas = fc.current;
      if (!canvas) return;
      const active = canvas.getActiveObject();
      if (!active || (active.type !== 'i-text' && active.type !== 'text' && active.type !== 'textbox')) return;
      if (options.fontFamily !== undefined) active.set('fontFamily', options.fontFamily);
      if (options.fontSize !== undefined) active.set('fontSize', options.fontSize);
      if (options.color !== undefined) active.set('fill', options.color);
      if (options.bold !== undefined) active.set('fontWeight', options.bold ? 'bold' : 'normal');
      if (options.italic !== undefined) active.set('fontStyle', options.italic ? 'italic' : 'normal');
      if (options.underline !== undefined) active.set('underline', options.underline);
      if (options.textAlign !== undefined) active.set('textAlign', options.textAlign);
      if (options.strokeWidth !== undefined) {
        active.set('strokeWidth', options.strokeWidth);
        const sc = options.strokeColor ?? (active as any).stroke ?? '#000000';
        active.set('stroke', options.strokeWidth > 0 ? sc : undefined);
      } else if (options.strokeColor !== undefined) {
        if ((active.strokeWidth || 0) > 0) active.set('stroke', options.strokeColor);
      }
      canvas.renderAll();
      onCanvasChangeRef.current?.();
    },

    // ---- トリミング機能 ----
    startCrop: () => {
      const canvas = fc.current;
      const fabric = fabricNs.current;
      if (!canvas || !fabric) return;
      const active = canvas.getActiveObject();
      if (!active || active.type !== 'image') {
        alert('トリミングするには画像を選択してください。');
        return;
      }
      // 対象画像をロック
      active.set({ selectable: false, evented: false, opacity: 0.6 });

      // 画像の表示矩形を取得
      const imgW = active.getScaledWidth();
      const imgH = active.getScaledHeight();
      const imgLeft = (active.left || 0) - imgW / 2;
      const imgTop  = (active.top  || 0) - imgH / 2;

      // 初期cropRectは画像の中央80%
      const inX = imgW * 0.1;
      const inY = imgH * 0.1;
      const cropRect = new fabric.Rect({
        left: imgLeft + inX,
        top:  imgTop  + inY,
        width:  imgW - inX * 2,
        height: imgH - inY * 2,
        fill: 'rgba(0,120,255,0.08)',
        stroke: '#0088ff',
        strokeWidth: 2,
        strokeDashArray: [6, 3],
        transparentCorners: false,
        cornerColor: '#0088ff',
        cornerSize: 12,
        name: CROP_RECT_NAME,
      });

      canvas.discardActiveObject();
      canvas.add(cropRect);
      canvas.setActiveObject(cropRect);
      canvas.renderAll();

      cropTargetRef.current = active;
      cropRectRef.current   = cropRect;
      setCropActive(true);
    },

    applyCrop: () => {
      const canvas = fc.current;
      const fabric = fabricNs.current;
      if (!canvas || !fabric || !cropTargetRef.current || !cropRectRef.current) return;

      const img  = cropTargetRef.current;
      const rect = cropRectRef.current;

      // cropRect の実際の境界（canvas座標）
      const rLeft  = rect.left;
      const rTop   = rect.top;
      const rW     = rect.getScaledWidth();
      const rH     = rect.getScaledHeight();

      // 画像の左上・スケール（回転非対応）
      const scaleX = img.scaleX || 1;
      const scaleY = img.scaleY || 1;
      const imgLeft = (img.left || 0) - img.getScaledWidth() / 2;
      const imgTop  = (img.top  || 0) - img.getScaledHeight() / 2;

      // canvas座標 → 画像ピクセル座標
      const srcX = Math.max(0, (rLeft - imgLeft) / scaleX);
      const srcY = Math.max(0, (rTop  - imgTop ) / scaleY);
      const srcW = Math.min((img.width || 0) - srcX, rW / scaleX);
      const srcH = Math.min((img.height || 0) - srcY, rH / scaleY);

      if (srcW <= 0 || srcH <= 0) {
        // 範囲外ならキャンセル
        canvas.remove(rect);
        img.set({ selectable: true, evented: true, opacity: 1 });
        cropTargetRef.current = null;
        cropRectRef.current   = null;
        setCropActive(false);
        canvas.renderAll();
        return;
      }

      // オフスクリーンキャンバスでクロップ画像を生成
      const imgEl = img.getElement() as HTMLImageElement;
      const off = document.createElement('canvas');
      off.width  = Math.round(srcW);
      off.height = Math.round(srcH);
      const ctx = off.getContext('2d')!;
      ctx.drawImage(imgEl, srcX, srcY, srcW, srcH, 0, 0, srcW, srcH);
      const croppedUrl = off.toDataURL('image/png');

      // 古いオブジェクトを削除
      canvas.remove(img);
      canvas.remove(rect);

      // 新しいクロップ済み画像を追加（cropRect の中心に配置）
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fabric.Image.fromURL(croppedUrl, (newImg: any) => {
        newImg.set({
          left: rLeft + rW / 2,
          top:  rTop  + rH / 2,
          originX: 'center',
          originY: 'center',
        });
        canvas.add(newImg);
        canvas.setActiveObject(newImg);
        canvas.renderAll();
        onCanvasChangeRef.current?.();
      });

      cropTargetRef.current = null;
      cropRectRef.current   = null;
      setCropActive(false);
    },

    // ボタンから直接クリップボードAPIで画像を取得
    pasteFromClipboard: async () => {
      const canvas = fc.current;
      const fabric = fabricNs.current;
      if (!canvas || !fabric) return;
      if (!navigator.clipboard?.read) {
        alert('このブラウザはClipboard APIに対応していません。Ctrl+Vをお試しください。');
        return;
      }
      try {
        const clipItems = await navigator.clipboard.read();
        let found = false;
        for (const item of clipItems) {
          const imageType = item.types.find((t) => t.startsWith('image/'));
          if (imageType) {
            const blob = await item.getType(imageType);
            const url = URL.createObjectURL(blob);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            fabric.Image.fromURL(url, (img: any) => {
              const scale = Math.min(
                (CANVAS_DISPLAY_SIZE * 0.85) / (img.width || 1),
                (CANVAS_DISPLAY_SIZE * 0.85) / (img.height || 1)
              );
              img.scale(scale);
              img.set({ left: CANVAS_DISPLAY_SIZE / 2, top: CANVAS_DISPLAY_SIZE / 2, originX: 'center', originY: 'center' });
              canvas.add(img);
              canvas.setActiveObject(img);
              canvas.renderAll();
              URL.revokeObjectURL(url);
              onCanvasChangeRef.current?.();
            });
            found = true;
            break;
          }
        }
        if (!found) alert('クリップボードに画像が見つかりませんでした。サイトで画像を右クリック→「画像をコピー」してから試してください。');
      } catch (err) {
        // 権限拒否
        alert('クリップボードへのアクセスが許可されていません。ブラウザの設定でクリップボード読み取りを許可するか、Ctrl+Vをお試しください。');
        console.warn('Clipboard API error:', err);
      }
    },

    cancelCrop: () => {
      const canvas = fc.current;
      if (!canvas) return;
      if (cropRectRef.current) {
        canvas.remove(cropRectRef.current);
        cropRectRef.current = null;
      }
      if (cropTargetRef.current) {
        cropTargetRef.current.set({ selectable: true, evented: true, opacity: 1 });
        cropTargetRef.current = null;
      }
      canvas.renderAll();
      setCropActive(false);
    },
  }));

  return (
    <div
      className={`relative border-2 rounded-xl overflow-hidden transition-all select-none ${
        cropActive
          ? 'border-blue-500 shadow-lg shadow-blue-200'
          : isFocused
            ? 'border-shopee-orange shadow-lg shadow-shopee-orange/20'
            : 'border-gray-300 hover:border-gray-400'
      }`}
      style={{ width: CANVAS_DISPLAY_SIZE, height: CANVAS_DISPLAY_SIZE, cursor: cropActive ? 'crosshair' : 'crosshair' }}
      onClick={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      tabIndex={0}
    >
      <canvas ref={canvasEl} />
      {initError && (
        <div className="absolute inset-0 bg-red-50 flex items-center justify-center p-4 rounded-xl">
          <p className="text-red-500 text-sm text-center">{initError}</p>
        </div>
      )}
      <div className="absolute top-2 right-2 flex gap-1 pointer-events-none">
        {isFirstImage && !cropActive && (
          <span className="bg-shopee-orange/80 text-white text-[10px] px-1.5 py-0.5 rounded-full">フレーム対応</span>
        )}
        {!isFocused && !cropActive && (
          <span className="bg-black/30 text-white text-[10px] px-1.5 py-0.5 rounded-full">クリックで選択</span>
        )}
      </div>
      {cropActive && (
        <div className="absolute top-2 left-2 bg-blue-600/90 text-white text-[10px] px-2 py-1 rounded-full pointer-events-none font-semibold">
          ✂ トリミング範囲を調整してください
        </div>
      )}
      {isFocused && !cropActive && (
        <div className="absolute bottom-2 left-2 bg-shopee-orange/80 text-white text-[10px] px-2 py-0.5 rounded-full pointer-events-none">
          編集中 — Ctrl+V で貼付 / Del で削除
        </div>
      )}
    </div>
  );
});

CanvasEditor.displayName = 'CanvasEditor';
export default CanvasEditor;
