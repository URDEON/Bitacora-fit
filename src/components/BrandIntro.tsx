import { BrandMark } from "./BrandMark";

export function BrandIntro({ dark }: { dark?: boolean }) {
  return (
    <main
      className="brand-intro"
      data-theme={dark === undefined ? undefined : dark ? "dark" : "light"}
      aria-label="Abriendo Bitácora Fit Pro"
      role="status"
    >
      <div className="brand-intro-content">
        <BrandMark />
        <h1>Bitácora Fit <strong>Pro</strong></h1>
      </div>
    </main>
  );
}
