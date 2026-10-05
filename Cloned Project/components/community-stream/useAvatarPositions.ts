"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { connectSocket } from "@/lib/socket";

interface AvatarPosition {
  odId: string;
  x: number;
  y: number;
}

// ============================================
// WORLD CONFIGURATION
// ============================================
// World size in pixels (10x a typical screen)
export const WORLD_WIDTH = 5000;
export const WORLD_HEIGHT = 3000;

// Movement speed in pixels per keypress
const MOVE_SPEED = 30;

// Avatar and radius circle size
export const AVATAR_SIZE = 64; // px
export const RADIUS_CIRCLE_SIZE = 300; // px

// ============================================
// HOOK
// ============================================
export function useAvatarPositions(meId: string, inCall: boolean) {
  // World positions (absolute pixels)
  const [positions, setPositions] = useState<Map<string, { x: number; y: number }>>(new Map());

  // Camera offset (what part of the world is visible)
  // Camera is centered on local user, so this represents the top-left corner of viewport
  const [cameraOffset, setCameraOffset] = useState({ x: 0, y: 0 });

  // Viewport dimensions (updated on resize)
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });

  const containerRef = useRef<HTMLDivElement>(null);

  // Generate random initial position in world space
  const getRandomPosition = useCallback(() => ({
    x: Math.random() * (WORLD_WIDTH - 400) + 200, // Avoid edges (200px padding)
    y: Math.random() * (WORLD_HEIGHT - 400) + 200,
  }), []);

  // Update camera to center on player
  const updateCamera = useCallback((playerX: number, playerY: number) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const viewWidth = rect.width;
    const viewHeight = rect.height;

    // Calculate camera offset to center player
    let camX = playerX - viewWidth / 2;
    let camY = playerY - viewHeight / 2;

    // Clamp camera to world boundaries
    camX = Math.max(0, Math.min(camX, WORLD_WIDTH - viewWidth));
    camY = Math.max(0, Math.min(camY, WORLD_HEIGHT - viewHeight));

    setCameraOffset({ x: camX, y: camY });
    setViewportSize({ width: viewWidth, height: viewHeight });
  }, []);

  // Initialize local position and set up socket listeners
  useEffect(() => {
    if (!inCall || !meId) return;

    const socket = connectSocket();

    // Set initial random position for self
    const initialPos = getRandomPosition();
    setPositions(prev => new Map(prev).set(meId, initialPos));

    // Update camera to center on initial position
    setTimeout(() => updateCamera(initialPos.x, initialPos.y), 50);

    // Notify server of initial position
    socket.emit("community-stream:position-update", initialPos);

    // Listen for other users' position changes
    const handlePositionChanged = (data: AvatarPosition) => {
      setPositions(prev => {
        const newMap = new Map(prev);
        newMap.set(data.odId, { x: data.x, y: data.y });
        return newMap;
      });
    };

    // Receive full position state on join
    const handlePositionsSync = (data: { positions: AvatarPosition[] }) => {
      setPositions(prev => {
        const newMap = new Map(prev);
        data.positions.forEach(p => {
          if (p.odId !== meId) { // Don't overwrite our own position
            newMap.set(p.odId, { x: p.x, y: p.y });
          }
        });
        return newMap;
      });
    };

    // Handle user leaving (remove their position)
    const handleUserLeft = (data: { odId: string }) => {
      setPositions(prev => {
        const newMap = new Map(prev);
        newMap.delete(data.odId);
        return newMap;
      });
    };

    socket.on("community-stream:position-changed", handlePositionChanged);
    socket.on("community-stream:positions-sync", handlePositionsSync);
    socket.on("community-stream:user-left", handleUserLeft);

    return () => {
      socket.off("community-stream:position-changed", handlePositionChanged);
      socket.off("community-stream:positions-sync", handlePositionsSync);
      socket.off("community-stream:user-left", handleUserLeft);
    };
  }, [inCall, meId, getRandomPosition, updateCamera]);

  // Track viewport size changes
  useEffect(() => {
    if (!containerRef.current) return;

    const updateViewportSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setViewportSize({ width: rect.width, height: rect.height });

        // Re-center camera on player
        const myPos = positions.get(meId);
        if (myPos) {
          updateCamera(myPos.x, myPos.y);
        }
      }
    };

    // Initial size
    updateViewportSize();

    // Listen for resize
    const resizeObserver = new ResizeObserver(updateViewportSize);
    resizeObserver.observe(containerRef.current);

    return () => resizeObserver.disconnect();
  }, [meId, positions, updateCamera]);

  // Handle keyboard movement
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!inCall || !meId) return;

    const arrowKeys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "W", "a", "A", "s", "S", "d", "D"];
    if (!arrowKeys.includes(e.key)) return;

    e.preventDefault();

    setPositions(prev => {
      const currentPos = prev.get(meId) || { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 };
      let newX = currentPos.x;
      let newY = currentPos.y;

      switch (e.key) {
        case "ArrowUp":
        case "w":
        case "W":
          newY = Math.max(RADIUS_CIRCLE_SIZE / 2, currentPos.y - MOVE_SPEED);
          break;
        case "ArrowDown":
        case "s":
        case "S":
          newY = Math.min(WORLD_HEIGHT - RADIUS_CIRCLE_SIZE / 2, currentPos.y + MOVE_SPEED);
          break;
        case "ArrowLeft":
        case "a":
        case "A":
          newX = Math.max(RADIUS_CIRCLE_SIZE / 2, currentPos.x - MOVE_SPEED);
          break;
        case "ArrowRight":
        case "d":
        case "D":
          newX = Math.min(WORLD_WIDTH - RADIUS_CIRCLE_SIZE / 2, currentPos.x + MOVE_SPEED);
          break;
      }

      // Update camera to follow player
      updateCamera(newX, newY);

      // Emit to server
      const socket = connectSocket();
      socket.emit("community-stream:position-update", { x: newX, y: newY });

      const newMap = new Map(prev);
      newMap.set(meId, { x: newX, y: newY });
      return newMap;
    });
  }, [inCall, meId, updateCamera]);

  // Attach keyboard listener
  useEffect(() => {
    if (!inCall) return;

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [inCall, handleKeyDown]);

  // Convert world position to screen position (relative to viewport)
  const worldToScreen = useCallback((worldX: number, worldY: number) => {
    return {
      x: worldX - cameraOffset.x,
      y: worldY - cameraOffset.y,
    };
  }, [cameraOffset]);

  // Check if a world position is visible in viewport
  const isInViewport = useCallback((worldX: number, worldY: number, margin = 200) => {
    const screen = worldToScreen(worldX, worldY);
    return (
      screen.x >= -margin &&
      screen.x <= viewportSize.width + margin &&
      screen.y >= -margin &&
      screen.y <= viewportSize.height + margin
    );
  }, [worldToScreen, viewportSize]);

  return {
    positions,
    cameraOffset,
    viewportSize,
    containerRef,
    worldToScreen,
    isInViewport,
    // Export constants for use in other components
    worldDimensions: { width: WORLD_WIDTH, height: WORLD_HEIGHT },
  };
}
