import React from "react";
import { Text, TextStyle } from "react-native";

/**
 * Lightweight markdown-bold parser.
 * Splits a string on **...** markers and renders the bold parts with `fontWeight: '800'`.
 * Optionally underlines portions wrapped in __...__ (used for actionable terms).
 * Used by the T&C gate and Service Info Modal so each language string can flag
 * its own emphasis terms (e.g. "no guarantee" in EN, "fără garanție" in RO, etc.).
 */
export function MdText({
  children,
  color,
  size = 13.5,
  lineHeight,
  rtl = false,
  style,
}: {
  children: string;
  color?: string;
  size?: number;
  lineHeight?: number;
  rtl?: boolean;
  style?: TextStyle | TextStyle[];
}) {
  const lh = lineHeight ?? Math.round(size * 1.7);
  // First split on bold (**…**), then within each non-bold segment split on underline (__…__).
  const boldSplit = String(children || "").split(/(\*\*[^*]+\*\*)/g);

  const renderBold = (seg: string, key: string) => {
    if (/^\*\*[^*]+\*\*$/.test(seg)) {
      return (
        <Text key={key} style={{ fontWeight: "800" }}>
          {seg.slice(2, -2)}
        </Text>
      );
    }
    // Underline pass within this segment
    const uSplit = seg.split(/(__[^_]+__)/g);
    return (
      <Text key={key}>
        {uSplit.map((u, j) => {
          if (/^__[^_]+__$/.test(u)) {
            return (
              <Text key={`${key}-u${j}`} style={{ textDecorationLine: "underline", fontWeight: "700" }}>
                {u.slice(2, -2)}
              </Text>
            );
          }
          return <Text key={`${key}-t${j}`}>{u}</Text>;
        })}
      </Text>
    );
  };

  return (
    <Text
      style={[
        { color, fontSize: size, lineHeight: lh, fontWeight: "500" },
        rtl ? ({ writingDirection: "rtl", textAlign: "right" } as TextStyle) : null,
        style as TextStyle,
      ]}
    >
      {boldSplit.map((seg, i) => renderBold(seg, `b${i}`))}
    </Text>
  );
}
