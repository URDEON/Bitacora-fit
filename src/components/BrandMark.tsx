import "../styles/brand.css";

/** The same pulse emblem is the source of the web and Android launch assets. */
export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <img
      className={`brand-emblem ${className}`.trim()}
      src={`${import.meta.env.BASE_URL}app-icon.svg`}
      width="512"
      height="512"
      alt=""
      aria-hidden="true"
      draggable="false"
    />
  );
}
