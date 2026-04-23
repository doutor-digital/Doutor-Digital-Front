import { useEffect, useRef, useState } from "react";
import { FileImage, FileSpreadsheet, FileText, MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Menu "⋯" de export pra gráficos. Funciona com qualquer container SVG.
 * - PNG: rasteriza o SVG via canvas
 * - SVG: baixa o próprio SVG
 * - CSV: usa `getCsv()` que você fornece
 */
export function ChartExportMenu({
  targetRef,
  filename = "grafico",
  getCsv,
  className,
}: {
  targetRef: React.RefObject<HTMLElement | null>;
  filename?: string;
  getCsv?: () => string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const findSvg = (): SVGSVGElement | null => {
    const root = targetRef.current;
    if (!root) return null;
    return root.querySelector("svg");
  };

  const downloadSvg = () => {
    const svg = findSvg();
    if (!svg) return;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const src = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([src], { type: "image/svg+xml;charset=utf-8" });
    download(`${filename}.svg`, blob);
    setOpen(false);
  };

  const downloadPng = async () => {
    const svg = findSvg();
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    if (!clone.getAttribute("width")) clone.setAttribute("width", String(rect.width));
    if (!clone.getAttribute("height")) clone.setAttribute("height", String(rect.height));
    const src = new XMLSerializer().serializeToString(clone);
    const img = new Image();
    const svgBlob = new Blob([src], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej();
      img.src = url;
    });
    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = rect.width * scale;
    canvas.height = rect.height * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      URL.revokeObjectURL(url);
      return;
    }
    ctx.fillStyle = "#0a0c14";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
    if (blob) download(`${filename}.png`, blob);
    setOpen(false);
  };

  const downloadCsv = () => {
    if (!getCsv) return;
    const content = "﻿" + getCsv();
    const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
    download(`${filename}.csv`, blob);
    setOpen(false);
  };

  return (
    <div ref={boxRef} className={cn("relative inline-block", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Exportar gráfico"
        className="rounded-md p-1 text-slate-400 transition hover:bg-white/[0.05] hover:text-slate-200"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && (
        <div
          role="menu"
          className={cn(
            "absolute right-0 top-full z-[60] mt-1 w-44 overflow-hidden rounded-md",
            "border border-white/[0.08] bg-[rgba(12,14,22,0.98)] shadow-[0_12px_32px_-8px_rgba(0,0,0,0.6)]",
          )}
        >
          <MenuItem icon={<FileImage className="h-3.5 w-3.5" />} onClick={downloadPng}>Baixar PNG</MenuItem>
          <MenuItem icon={<FileText className="h-3.5 w-3.5" />} onClick={downloadSvg}>Baixar SVG</MenuItem>
          {getCsv && (
            <MenuItem icon={<FileSpreadsheet className="h-3.5 w-3.5" />} onClick={downloadCsv}>Baixar CSV</MenuItem>
          )}
        </div>
      )}
    </div>
  );
}

function MenuItem({
  children, icon, onClick,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-slate-300 transition hover:bg-white/[0.05] hover:text-slate-50"
    >
      {icon}
      {children}
    </button>
  );
}

function download(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
