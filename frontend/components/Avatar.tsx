import React from "react";
import { Platform, Image as RNImage } from "react-native";

export function Avatar({
  uri,
  size,
  style,
}: {
  uri: string;
  size: number;
  style?: any;
}) {
  if (Platform.OS === "web") {
    return React.createElement("img", {
      src: uri,
      style: {
        width: size,
        height: size,
        objectFit: "cover",
        display: "block",
        ...((style as object) || {}),
      },
      alt: "avatar",
    });
  }
  return (
    <RNImage
      source={{ uri }}
      style={[{ width: size, height: size }, style]}
      resizeMode="cover"
    />
  );
}
