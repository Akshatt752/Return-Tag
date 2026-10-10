import { useEffect, useState } from "react";
import QR from "qrcode";

// Builds the QR for `url` as an SVG string in the browser. Returns null until it's ready.
export default function useQrSvg(url) {
  const [svg, setSvg] = useState(null);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    QR.toString(url, { type: "svg", errorCorrectionLevel: "M", margin: 1, color: { dark: "#000000", light: "#ffffff" } })
      .then((out) => !cancelled && setSvg(out))
      .catch(() => !cancelled && setSvg(null));
    return () => {
      cancelled = true;
    };
  }, [url]);

  return svg;
}
