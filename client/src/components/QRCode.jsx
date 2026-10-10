import useQrSvg from "../hooks/useQrSvg";

// The SVG comes from the qrcode library for our own tag URL, so injecting it is safe
export default function QRCode({ url, className = "size-40", label = "QR code" }) {
  const svg = useQrSvg(url);
  return (
    <div
      role="img"
      aria-label={label}
      className={`overflow-hidden rounded-md bg-white [&>svg]:block [&>svg]:size-full ${className}`}
      dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
    />
  );
}
