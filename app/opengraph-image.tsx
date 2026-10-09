import { ImageResponse } from "next/og";

export const alt = "Kōkua Counter: fund a meal for a Hawaiʻi student";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The card shown when the site is shared. Text only, so it needs no network fetches or font files.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#18392b",
          color: "#fbfaf6",
        }}
      >
        <div style={{ display: "flex", fontSize: 30, letterSpacing: 4, textTransform: "uppercase", color: "#a3e0c8" }}>
          Meals for students across Hawaiʻi
        </div>
        <div style={{ display: "flex", marginTop: 28, fontSize: 104, fontWeight: 700, lineHeight: 1.05 }}>Kokua Counter</div>
        <div style={{ display: "flex", marginTop: 32, fontSize: 40, color: "#e7efe9", maxWidth: 900 }}>
          A good meal can change the shape of a day.
        </div>
        <div style={{ display: "flex", marginTop: 56, height: 12, width: 220, background: "#c8583d", borderRadius: 6 }} />
      </div>
    ),
    size,
  );
}
