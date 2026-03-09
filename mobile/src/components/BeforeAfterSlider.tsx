import { useState } from "react";
import { View, Image, Text, StyleSheet, LayoutChangeEvent } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

type Props = {
  beforeUri: string;
  afterUri: string;
  height?: number;
};

export default function BeforeAfterSlider({ beforeUri, afterUri, height = 300 }: Props) {
  const [containerWidth, setContainerWidth] = useState(0);
  const position = useSharedValue(0.5);
  const startPosition = useSharedValue(0.5);

  const onLayout = (e: LayoutChangeEvent) => {
    setContainerWidth(e.nativeEvent.layout.width);
  };

  const panGesture = Gesture.Pan()
    .onBegin(() => {
      startPosition.value = position.value;
    })
    .onUpdate((e) => {
      if (containerWidth === 0) return;
      const newPos = startPosition.value + e.translationX / containerWidth;
      position.value = Math.max(0.05, Math.min(0.95, newPos));
    });

  const tapGesture = Gesture.Tap().onEnd((e) => {
    if (containerWidth === 0) return;
    position.value = withSpring(Math.max(0.05, Math.min(0.95, e.x / containerWidth)), {
      damping: 20,
      stiffness: 200,
    });
  });

  const composed = Gesture.Simultaneous(panGesture, tapGesture);

  const beforeClipStyle = useAnimatedStyle(() => ({
    width: `${position.value * 100}%` as any,
  }));

  const handleStyle = useAnimatedStyle(() => ({
    left: `${position.value * 100}%` as any,
  }));

  return (
    <GestureDetector gesture={composed}>
      <View style={[styles.container, { height }]} onLayout={onLayout}>
        {/* After image (full width, underneath) */}
        <Image source={{ uri: afterUri }} style={[styles.image, { height }]} resizeMode="cover" />

        {/* Before image (clipped) */}
        <Animated.View style={[styles.beforeClip, beforeClipStyle, { height }]}>
          <Image
            source={{ uri: beforeUri }}
            style={[styles.image, { height, width: containerWidth || "100%" }]}
            resizeMode="cover"
          />
        </Animated.View>

        {/* Labels */}
        <View style={[styles.label, styles.labelLeft]}>
          <Text style={styles.labelText}>BEFORE</Text>
        </View>
        <View style={[styles.label, styles.labelRight]}>
          <Text style={styles.labelText}>AFTER</Text>
        </View>

        {/* Drag handle */}
        <Animated.View style={[styles.handleLine, handleStyle]}>
          <View style={styles.handleKnob}>
            <Text style={styles.handleIcon}>{"<>"}</Text>
          </View>
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#1e293b",
  },
  image: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
  },
  beforeClip: {
    position: "absolute",
    top: 0,
    left: 0,
    overflow: "hidden",
  },
  handleLine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: "#fff",
    marginLeft: -1.5,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  handleKnob: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  handleIcon: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f1b2d",
  },
  label: {
    position: "absolute",
    top: 10,
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    zIndex: 5,
  },
  labelLeft: { left: 10 },
  labelRight: { right: 10 },
  labelText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
  },
});
