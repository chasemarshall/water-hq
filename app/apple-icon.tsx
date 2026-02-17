import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
          borderRadius: 36,
          border: "5px solid #1a1a1a",
        }}
      >
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
              width: 105,
            }}
          >
            <div
              style={{
                width: 14,
                height: 28,
                background: "#1a1a1a",
                borderRadius: 3,
              }}
            />
          </div>
          {/* Head */}
          <div
            style={{
              width: 64,
              height: 18,
              background: "#1a1a1a",
              borderRadius: "0 0 10px 10px",
              marginLeft: 42,
            }}
          />
          {/* Water drops */}
          <div
            style={{
              display: "flex",
              gap: 8,
              marginTop: 7,
              marginLeft: 42,
            }}
          >
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                style={{
                  width: 6,
                  height: 14,
                  background: "#60B5F6",
                  borderRadius: "0 0 4px 4px",
                  opacity: 0.7 + i * 0.06,
                }}
              />
            ))}
          </div>
          <div
            style={{
              display: "flex",
              gap: 8,
              marginTop: 5,
              marginLeft: 48,
            }}
          >
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  width: 5,
                  height: 10,
                  background: "#60B5F6",
                  borderRadius: "0 0 3px 3px",
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
