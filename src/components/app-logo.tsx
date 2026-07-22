const LOGO_SRC = "/icons/icon-192.png?v=8";

export function AppLogo({
  size = 72,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={LOGO_SRC}
      alt="expire365"
      width={size}
      height={size}
      className={`rounded-[22%] ${className}`}
      decoding="async"
    />
  );
}
