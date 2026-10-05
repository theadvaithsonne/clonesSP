"use client";

import type React from "react";
import { useRef, useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import {
  ZoomIn,
  ZoomOut,
  Move,
  Users,
  DollarSign,
  Calendar,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface AffiliateNode {
  id: string;
  name: string;
  email?: string;
  joinedAt: string;
  level: number;
  totalReferrals: number;
  directReferrals: number;
  status: string;
  children?: AffiliateNode[];
  userType?: "admin" | "customer";
  earnings?: number;
  avatar?: string;
}

interface NodePosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface NodeMap {
  [key: string]: NodePosition;
}

interface AffiliateNetworkCanvasProps {
  networkData: AffiliateNode | null;
  loading?: boolean;
}

interface ExpandedNodes {
  [key: string]: boolean;
}

export function AffiliateNetworkCanvas({
  networkData,
  loading,
}: AffiliateNetworkCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [positions, setPositions] = useState<NodeMap>({});
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [canvasSize, setCanvasSize] = useState({ width: 3000, height: 2000 });
  const [expandedNodes, setExpandedNodes] = useState<ExpandedNodes>({});

  // Toggle node expansion
  const toggleNode = (nodeId: string) => {
    setExpandedNodes((prev) => ({
      ...prev,
      [nodeId]: !prev[nodeId],
    }));
  };

  // Get only visible nodes (lazy loading) (hello)
  const getVisibleNodes = (
    node: AffiliateNode,
    parentExpanded = true
  ): AffiliateNode[] => {
    if (!parentExpanded) return [];

    const nodes: AffiliateNode[] = [node];

    if (expandedNodes[node.id] && node.children) {
      node.children.forEach((child) => {
        nodes.push(...getVisibleNodes(child, true));
      });
    }

    return nodes;
  };

  // Calculate tree layout
  useEffect(() => {
    if (!networkData) return;

    const calculateTreeLayout = () => {
      const nodeWidth = 280;
      const nodeHeight = 120;
      const horizontalSpacing = 80;
      const verticalSpacing = 120;
      const positions: NodeMap = {};

      // Calculate width needed for each node's children
      const getNodeWidth = (node: AffiliateNode): number => {
        if (
          !expandedNodes[node.id] ||
          !node.children ||
          node.children.length === 0
        ) {
          return 1;
        }

        let width = 0;
        for (const child of node.children) {
          width += getNodeWidth(child);
        }
        return width;
      };

      // Position nodes
      const positionNode = (
        node: AffiliateNode,
        depth: number,
        horizontalOffset: number,
        widthUnits: number
      ) => {
        const x =
          horizontalOffset +
          (widthUnits * (nodeWidth + horizontalSpacing)) / 2 -
          nodeWidth / 2;
        const y = depth * (nodeHeight + verticalSpacing) + 50;

        positions[node.id] = { x, y, width: nodeWidth, height: nodeHeight };

        if (
          !expandedNodes[node.id] ||
          !node.children ||
          node.children.length === 0
        ) {
          return widthUnits;
        }

        let currentOffset = horizontalOffset;
        for (const child of node.children) {
          const childWidthUnits = getNodeWidth(child);
          positionNode(child, depth + 1, currentOffset, childWidthUnits);
          currentOffset += childWidthUnits * (nodeWidth + horizontalSpacing);
        }

        return widthUnits;
      };

      const rootWidth = getNodeWidth(networkData);
      positionNode(networkData, 0, 100, rootWidth);

      // Calculate canvas size based on node positions
      let maxX = 0;
      let maxY = 0;

      Object.values(positions).forEach((pos) => {
        maxX = Math.max(maxX, pos.x + pos.width + horizontalSpacing);
        maxY = Math.max(maxY, pos.y + pos.height + verticalSpacing);
      });

      setCanvasSize({
        width: Math.max(maxX, 1200),
        height: Math.max(maxY, 800),
      });
      setPositions(positions);
    };

    calculateTreeLayout();
  }, [networkData, expandedNodes]);

  // Handle mouse events for panning
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    setStartPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - startPos.x;
    const dy = e.clientY - startPos.y;
    setTranslate((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
    setStartPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Zoom controls
  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.1, 2));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev - 0.1, 0.3));
  };

  // Reset view
  const handleResetView = () => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  };

  // Arrow navigation - pan while button is held
  const panIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const panSpeed = 15;

  const startPanning = (direction: "up" | "down" | "left" | "right") => {
    // Clear any existing interval
    if (panIntervalRef.current) {
      clearInterval(panIntervalRef.current);
    }

    // Pan immediately on press
    panInDirection(direction);

    // Continue panning while held
    panIntervalRef.current = setInterval(() => {
      panInDirection(direction);
    }, 16); // ~60fps
  };

  const stopPanning = () => {
    if (panIntervalRef.current) {
      clearInterval(panIntervalRef.current);
      panIntervalRef.current = null;
    }
  };

  const panInDirection = (direction: "up" | "down" | "left" | "right") => {
    setTranslate((prev) => {
      switch (direction) {
        case "up":
          return { ...prev, y: prev.y + panSpeed };
        case "down":
          return { ...prev, y: prev.y - panSpeed };
        case "left":
          return { ...prev, x: prev.x + panSpeed };
        case "right":
          return { ...prev, x: prev.x - panSpeed };
        default:
          return prev;
      }
    });
  };

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (panIntervalRef.current) {
        clearInterval(panIntervalRef.current);
      }
    };
  }, []);

  // Render connections between visible nodes
  const renderConnections = () => {
    const connections: React.ReactNode[] = [];

    const addConnection = (parent: AffiliateNode, child: AffiliateNode) => {
      const parentPos = positions[parent.id];
      const childPos = positions[child.id];

      if (!parentPos || !childPos) return;

      const startX = parentPos.x + parentPos.width / 2;
      const startY = parentPos.y + parentPos.height;
      const endX = childPos.x + childPos.width / 2;
      const endY = childPos.y;

      // Draw vertical line from parent
      connections.push(
        <line
          key={`${parent.id}-${child.id}-1`}
          x1={startX}
          y1={startY}
          x2={startX}
          y2={startY + (endY - startY) / 2}
          stroke="#6b4c9a"
          strokeWidth={2}
          opacity={0.4}
        />
      );

      // Draw horizontal line
      connections.push(
        <line
          key={`${parent.id}-${child.id}-2`}
          x1={startX}
          y1={startY + (endY - startY) / 2}
          x2={endX}
          y2={startY + (endY - startY) / 2}
          stroke="#6b4c9a"
          strokeWidth={2}
          opacity={0.4}
        />
      );

      // Draw vertical line to child
      connections.push(
        <line
          key={`${parent.id}-${child.id}-3`}
          x1={endX}
          y1={startY + (endY - startY) / 2}
          x2={endX}
          y2={endY}
          stroke="#6b4c9a"
          strokeWidth={2}
          opacity={0.4}
        />
      );
    };

    const traverseTree = (node: AffiliateNode) => {
      if (expandedNodes[node.id] && node.children) {
        node.children.forEach((child) => {
          addConnection(node, child);
          traverseTree(child);
        });
      }
    };

    if (networkData) {
      traverseTree(networkData);
    }
    return connections;
  };

  // Get initials from name
  const getInitials = (name: string) => {
    if (!name) return "??";
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Get status color - Garage theme (subtle, darker)
  const getStatusColor = (
    status: string,
    isRoot: boolean,
    userType?: "admin" | "customer"
  ) => {
    if (isRoot) return "bg-gradient-to-br from-[#4c2e8f] to-[#2a1752]";
    if (userType === "admin") {
      return status === "active"
        ? "bg-gradient-to-br from-[#6b4c9a] to-[#4c2e8f]"
        : "bg-[#3a3a4a]";
    }
    if (status === "active")
      return "bg-gradient-to-br from-[#5a4c7a] to-[#4c2e8f]";
    return "bg-[#3a3a4a]";
  };

  // Get card border color - Garage theme
  const getCardBorderColor = (
    isRoot: boolean,
    status: string,
    userType?: "admin" | "customer"
  ) => {
    if (isRoot)
      return "border-[#4c2e8f] bg-gradient-to-br from-[#1a1a24] to-[#14141a]";
    if (userType === "admin") {
      return status === "active"
        ? "border-[#6b4c9a]/40 bg-gradient-to-br from-[#1a1a24] to-[#14141a] hover:border-[#6b4c9a]/60"
        : "border-[#2a2a35] bg-[#14141a]";
    }
    return status === "active"
      ? "border-[#4c2e8f]/30 bg-[#14141a] hover:border-[#4c2e8f]/50"
      : "border-[#2a2a35] bg-[#14141a]";
  };

  // Render nodes
  const renderNodes = () => {
    const nodes: React.ReactNode[] = [];

    const traverseTree = (node: AffiliateNode, isRoot = false) => {
      const pos = positions[node.id];
      if (!pos) return;

      const hasChildren = node.children && node.children.length > 0;
      const isExpanded = expandedNodes[node.id];

      nodes.push(
        <div
          key={node.id}
          className="absolute transform-gpu transition-all duration-500 ease-out"
          style={{
            left: pos.x,
            top: pos.y,
            width: pos.width,
            height: pos.height,
          }}
        >
          <Card
            className={`w-full h-full p-4 shadow-lg hover:shadow-xl transition-all duration-300 border ${getCardBorderColor(
              isRoot,
              node.status,
              node.userType
            )} ${hasChildren ? "cursor-pointer" : ""}`}
            onClick={() => hasChildren && toggleNode(node.id)}
          >
            <div className="flex items-start gap-3 h-full">
              <div className="flex-shrink-0">
                <Avatar className="h-12 w-12 border-2 border-[#2a2a35] shadow-sm transition-transform duration-300 hover:scale-105">
                  <AvatarImage
                    src={
                      node.avatar ||
                      `https://api.dicebear.com/7.x/avatars/svg?seed=${node.name}`
                    }
                    alt={node.name}
                  />
                  <AvatarFallback
                    className={`text-white text-sm font-bold ${getStatusColor(
                      node.status,
                      isRoot,
                      node.userType
                    )}`}
                  >
                    {getInitials(node.name)}
                  </AvatarFallback>
                </Avatar>
              </div>

              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-sm text-white truncate">
                    {node.name}
                  </h3>
                  {isRoot && (
                    <Badge
                      variant="secondary"
                      className="bg-[#4c2e8f] text-white text-xs border-[#6b4c9a] transition-all duration-200"
                    >
                      You
                    </Badge>
                  )}
                  {!isRoot && node.userType === "admin" && (
                    <Badge
                      variant="secondary"
                      className="bg-[#6b4c9a]/30 text-[#b8a0d8] text-xs border-[#6b4c9a]/50 transition-all duration-200"
                    >
                      Seller
                    </Badge>
                  )}
                  <Badge
                    variant={node.status === "active" ? "default" : "secondary"}
                    className={`text-xs transition-all duration-200 ${
                      node.status === "active"
                        ? "bg-emerald-900/30 text-emerald-400 border-emerald-800/50"
                        : "bg-[#2a2a35] text-[#6a6a7a] border-[#3a3a45]"
                    }`}
                  >
                    {node.status}
                  </Badge>
                </div>

                {node.email && (
                  <p className="text-xs text-[#9fa0b8] truncate">
                    {node.email}
                  </p>
                )}

                <div className="flex items-center gap-3 text-xs text-[#9fa0b8]">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    <span>Level {node.level}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    <span>{node.totalReferrals} refs</span>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-1">
                  <div className="text-xs">
                    <span className="text-[#9fa0b8]">Direct: </span>
                    <span className="font-medium text-white">
                      {node.directReferrals}
                    </span>
                  </div>
                  {node.earnings !== undefined && (
                    <div className="flex items-center gap-1 text-xs">
                      <DollarSign className="w-3 h-3 text-emerald-400" />
                      <span className="font-medium text-emerald-400">
                        ${node.earnings?.toFixed(2) || "0.00"}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Expand/Collapse Indicator */}
              {hasChildren && (
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 flex items-center justify-center text-[#9fa0b8] transition-all duration-300">
                    <div
                      className={`transition-transform duration-300 ${
                        isExpanded ? "rotate-90" : "rotate-0"
                      }`}
                    >
                      <ChevronRight className="w-5 h-5" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      );

      if (isExpanded && node.children) {
        node.children.forEach((child) => traverseTree(child, false));
      }
    };

    if (networkData) {
      traverseTree(networkData, true);
    }
    return nodes;
  };

  if (loading) {
    return (
      <div className="w-full h-[600px] flex items-center justify-center bg-[#0d0d11] rounded-lg border border-[#2a2a35]">
        <div className="text-center space-y-4">
          <div className="animate-spin w-8 h-8 border-4 border-[#2a2a35] border-t-[#4c2e8f] rounded-full mx-auto"></div>
          <p className="text-[#9fa0b8]">Loading affiliate network...</p>
        </div>
      </div>
    );
  }

  if (!networkData) {
    return (
      <div className="w-full h-[600px] flex items-center justify-center bg-[#0d0d11] rounded-lg border border-[#2a2a35]">
        <div className="text-center space-y-4">
          <Users className="w-16 h-16 text-[#4c2e8f] mx-auto opacity-50" />
          <div>
            <h3 className="text-lg font-medium text-white mb-2">
              No Network Data
            </h3>
            <p className="text-[#9fa0b8] mb-4">
              Start building your affiliate network by sharing your affiliate
              links
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative w-full h-[70vh] overflow-hidden border border-[#2a2a35] rounded-lg bg-[#0d0d11]"
      ref={containerRef}
    >
      {/* Canvas */}
      <div
        ref={canvasRef}
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
        style={{
          transform: `scale(${scale}) translate(${translate.x}px, ${translate.y}px)`,
          transformOrigin: "0 0",
          width: canvasSize.width,
          height: canvasSize.height,
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Grid background - subtle */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `
              linear-gradient(rgba(108, 76, 154, 0.15) 1px, transparent 1px),
              linear-gradient(90deg, rgba(108, 76, 154, 0.15) 1px, transparent 1px)
            `,
            backgroundSize: "50px 50px",
          }}
        />

        {/* SVG for connections */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          {renderConnections()}
        </svg>

        {/* Nodes */}
        {renderNodes()}
      </div>

      {/* Controls */}
      <div className="absolute bottom-4 right-4 flex flex-col items-end gap-3">
        {/* Arrow Navigation */}
        <div className="bg-[#14141a]/90 backdrop-blur-sm p-2 rounded-lg shadow-lg border border-[#2a2a35]">
          <div className="grid grid-cols-3 gap-1 w-[88px]">
            <div />
            <Button
              variant="outline"
              size="icon"
              onMouseDown={() => startPanning("up")}
              onMouseUp={stopPanning}
              onMouseLeave={stopPanning}
              onTouchStart={() => startPanning("up")}
              onTouchEnd={stopPanning}
              title="Pan Up (hold)"
              className="h-7 w-7 border-[#2a2a35] bg-[#14141a] text-[#9fa0b8] hover:text-white hover:bg-[#2a1752] hover:border-[#4c2e8f] active:bg-[#4c2e8f]"
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </Button>
            <div />
            <Button
              variant="outline"
              size="icon"
              onMouseDown={() => startPanning("left")}
              onMouseUp={stopPanning}
              onMouseLeave={stopPanning}
              onTouchStart={() => startPanning("left")}
              onTouchEnd={stopPanning}
              title="Pan Left (hold)"
              className="h-7 w-7 border-[#2a2a35] bg-[#14141a] text-[#9fa0b8] hover:text-white hover:bg-[#2a1752] hover:border-[#4c2e8f] active:bg-[#4c2e8f]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onMouseDown={() => startPanning("down")}
              onMouseUp={stopPanning}
              onMouseLeave={stopPanning}
              onTouchStart={() => startPanning("down")}
              onTouchEnd={stopPanning}
              title="Pan Down (hold)"
              className="h-7 w-7 border-[#2a2a35] bg-[#14141a] text-[#9fa0b8] hover:text-white hover:bg-[#2a1752] hover:border-[#4c2e8f] active:bg-[#4c2e8f]"
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onMouseDown={() => startPanning("right")}
              onMouseUp={stopPanning}
              onMouseLeave={stopPanning}
              onTouchStart={() => startPanning("right")}
              onTouchEnd={stopPanning}
              title="Pan Right (hold)"
              className="h-7 w-7 border-[#2a2a35] bg-[#14141a] text-[#9fa0b8] hover:text-white hover:bg-[#2a1752] hover:border-[#4c2e8f] active:bg-[#4c2e8f]"
            >
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Zoom Controls */}
        <div className="flex gap-2 bg-[#14141a]/90 backdrop-blur-sm p-2 rounded-lg shadow-lg border border-[#2a2a35]">
          <Button
            variant="outline"
            size="icon"
            onClick={handleZoomIn}
            title="Zoom In"
            className="h-8 w-8 border-[#2a2a35] bg-[#14141a] text-[#9fa0b8] hover:text-white hover:bg-[#2a1752] hover:border-[#4c2e8f]"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={handleZoomOut}
            title="Zoom Out"
            className="h-8 w-8 border-[#2a2a35] bg-[#14141a] text-[#9fa0b8] hover:text-white hover:bg-[#2a1752] hover:border-[#4c2e8f]"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={handleResetView}
            title="Reset View"
            className="h-8 w-8 border-[#2a2a35] bg-[#14141a] text-[#9fa0b8] hover:text-white hover:bg-[#2a1752] hover:border-[#4c2e8f]"
          >
            <Move className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Scale indicator */}
      <div className="absolute top-4 right-4 bg-[#14141a]/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs text-[#9fa0b8] border border-[#2a2a35]">
        {Math.round(scale * 100)}%
      </div>

      {/* Legend */}
      <div className="absolute top-4 left-4 bg-[#14141a]/90 backdrop-blur-sm px-4 py-3 rounded-lg shadow-lg border border-[#2a2a35]">
        <h4 className="text-xs font-semibold text-white mb-2">Legend</h4>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-gradient-to-br from-[#4c2e8f] to-[#2a1752]"></div>
            <span className="text-xs text-[#9fa0b8]">You (Root)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-gradient-to-br from-[#6b4c9a] to-[#4c2e8f]"></div>
            <span className="text-xs text-[#9fa0b8]">Sellers (Admins)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-gradient-to-br from-[#5a4c7a] to-[#4c2e8f]"></div>
            <span className="text-xs text-[#9fa0b8]">Customers</span>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-[#2a2a35]">
          <p className="text-[10px] text-[#7a7a8a] italic">
            Click chevron to expand/collapse nodes
          </p>
        </div>
      </div>
    </div>
  );
}
