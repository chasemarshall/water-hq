import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#F5F0E8",
          borderRadius: 90,
          border: "12px solid #1a1a1a",
        }}
      >
        {/* Shower head */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          {/* Pipe */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "flex-end",
              width: 300,
            }}
          >
            <div
              style={{
                width: 40,
                height: 80,
                background: "#1a1a1a",
                borderRadius: 8,
              }}
            />
          </div>
          {/* Head */}
          <div
            style={{
              width: 180,
              height: 50,
              background: "#1a1a1a",
              borderRadius: "0 0 30px 30px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginLeft: 120,
            }}
          />
          {/* Water drops */}
          <div
            style={{
              display: "flex",
              gap: 24,
              marginTop: 20,
              marginLeft: 120,
            }}
          >
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                style={{
                  width: 16,
                  height: 40,
                  background: "#60B5F6",
                  borderRadius: "0 0 10px 10px",
                  opacity: 0.7 + i * 0.06,
                }}
              />
            ))}
          </div>
          <div
            style={{
              display: "flex",
              gap: 24,
              marginTop: 12,
              marginLeft: 140,
            }}
          >
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  width: 12,
                  height: 28,
                  background: "#60B5F6",
                  borderRadius: "0 0 8px 8px",
                  opacity: 0.5 + i * 0.1,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
