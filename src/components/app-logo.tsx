import Image from "next/image";

export function AppLogo({
  size = 72,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src="/icons/icon-192.png"
      alt="expire365"
      width={size}
      height={size}
      className={`rounded-[22%] ${className}`}
      priority
    />
  );
}
