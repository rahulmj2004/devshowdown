import { ImageResponse } from "next/og";
import { getEvents } from "@/config/events";
import { siteConfig } from "@/config/site";

export const alt = `${siteConfig.name} — ${siteConfig.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  const prize = `Rs. ${siteConfig.prize.total.toLocaleString("en-IN")}`;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        backgroundColor: "#060608",
        backgroundImage:
          "radial-gradient(900px 500px at 15% -10%, rgba(123,61,255,0.5), transparent 70%), radial-gradient(700px 500px at 100% 100%, rgba(200,255,46,0.16), transparent 70%)",
        color: "#f3f3ee",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <svg width="64" height="64" viewBox="0 0 32 32" fill="none">
          <path d="M0 0h26l6 6v26H6l-6-6z" fill="#101014" />
          <path
            d="M7.5 10.5 13 16l-5.5 5.5"
            stroke="#a98bff"
            strokeWidth="2.4"
          />
          <path
            d="M24.5 10.5 19 16l5.5 5.5"
            stroke="#c8ff2e"
            strokeWidth="2.4"
          />
          <rect x="15" y="9" width="2" height="14" fill="#f3f3ee" />
        </svg>
        <div style={{ display: "flex", fontSize: 40, fontWeight: 600 }}>
          Dev<span style={{ color: "#c8ff2e" }}>/</span>Showdown
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          fontSize: 112,
          fontWeight: 700,
          lineHeight: 1,
          letterSpacing: -4,
          textTransform: "uppercase",
        }}
      >
        {siteConfig.headline.map((beat, index) => (
          <span
            key={beat}
            style={
              index === siteConfig.headline.length - 1
                ? { color: "#c8ff2e" }
                : undefined
            }
          >
            {beat}
          </span>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 30,
          color: "#a6a6b0",
        }}
      >
        <span>{getEvents().length} competitions</span>
        <span>
          {siteConfig.prize.approximate ? "Approx. " : ""}
          {prize} prize pool
        </span>
      </div>
    </div>,
    size,
  );
}
