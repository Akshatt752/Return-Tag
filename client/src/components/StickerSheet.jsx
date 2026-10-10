import { Printer } from "lucide-react";
import { formatCode } from "../utils/format";
import QRCode from "./QRCode";

function Sticker({ code, url }) {
  return (
    <div className="flex break-inside-avoid overflow-hidden rounded-lg border border-dashed border-[#9a9a9a] bg-white text-black [print-color-adjust:exact]">
      <div className="w-2.5 shrink-0 bg-[#f5c518]" aria-hidden="true" />
      <div className="flex min-w-0 flex-1 items-center gap-3 p-3">
        <QRCode url={url} className="size-[30mm] shrink-0" label={`QR code ${formatCode(code)}`} />
        <div className="min-w-0">
          <p className="font-display text-[15px] leading-tight font-semibold">Found me?</p>
          <p className="text-[12px] leading-snug">Scan to return me to my owner.</p>
          <p className="mt-2 font-mono text-[13px] font-semibold tracking-[0.08em]">{formatCode(code)}</p>
          <p className="mt-1 text-[9px] leading-tight text-[#555]">No app needed · owner stays anonymous</p>
          <p className="mt-1.5 font-mono text-[9px] tracking-[0.14em] text-[#555] uppercase">returntag</p>
        </div>
      </div>
    </div>
  );
}

// A sheet of cut-out labels. Navbar/footer and the toolbar are hidden when printing.
export default function StickerSheet({ title, note, items }) {
  return (
    <div className="container-page py-8 print:max-w-none print:p-0">
      <div className="no-print mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="heading text-3xl">{title}</h1>
          {note && <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-2">{note}</p>}
        </div>
        <button type="button" className="btn-primary shrink-0" onClick={() => window.print()}>
          <Printer className="size-4" aria-hidden="true" />
          Print
        </button>
      </div>
      <div className="grid gap-3 rounded-lg bg-white p-3 sm:grid-cols-2 print:gap-[4mm] print:p-0">
        {items.map((item, i) => (
          <Sticker key={`${item.code}-${i}`} code={item.code} url={item.url} />
        ))}
      </div>
    </div>
  );
}
