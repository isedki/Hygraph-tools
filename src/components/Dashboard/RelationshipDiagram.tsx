'use client';

import { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import type { RelationshipGraphAnalysis, RelationshipNode, RelationshipEdge } from '@/lib/types';

interface RelationshipDiagramProps {
  graph: RelationshipGraphAnalysis;
}

// Color schemes by node type
const TYPE_COLORS = {
  model: {
    fill: '#3b82f6', // blue-500
    stroke: '#60a5fa', // blue-400
    text: '#ffffff',
    label: 'Models',
  },
  component: {
    fill: '#8b5cf6', // violet-500
    stroke: '#a78bfa', // violet-400
    text: '#ffffff',
    label: 'Components',
  },
  enum: {
    fill: '#f59e0b', // amber-500
    stroke: '#fbbf24', // amber-400
    text: '#ffffff',
    label: 'Enums',
  },
};

// Importance modifiers
const IMPORTANCE_SCALE = {
  core: 1.3,
  supporting: 1.0,
  config: 0.85,
  utility: 0.75,
};

// Edge colors by relationship type
const EDGE_COLORS = {
  reference: '#60a5fa',     // blue-400
  bidirectional: '#34d399', // emerald-400
  component: '#a78bfa',     // violet-400
  enum: '#fbbf24',          // amber-400
};

interface ViewState {
  x: number;
  y: number;
  scale: number;
}

export default function RelationshipDiagram({ graph }: RelationshipDiagramProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // View state for zoom/pan
  const [view, setView] = useState<ViewState>({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  // Selection state
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const svgWidth = 1200;
  const svgHeight = 800;

  // Calculate node positions using force-directed-like layout
  const nodePositions = useMemo(() => {
    const positions: Record<string, { x: number; y: number; node: RelationshipNode }> = {};
    
    const models = graph.nodes.filter(n => n.type === 'model');
    const components = graph.nodes.filter(n => n.type === 'component');
    const enums = graph.nodes.filter(n => n.type === 'enum');

    // Position models in a grid-like layout
    const modelCols = Math.ceil(Math.sqrt(models.length));
    const modelSpacingX = 180;
    const modelSpacingY = 150;
    const modelStartX = 300;
    const modelStartY = 200;

    models.forEach((node, i) => {
      const col = i % modelCols;
      const row = Math.floor(i / modelCols);
      positions[node.id] = {
        x: modelStartX + col * modelSpacingX,
        y: modelStartY + row * modelSpacingY,
        node,
      };
    });

    // Position components on the left
    const compSpacing = 100;
    const compStartY = 150;
    components.forEach((node, i) => {
      positions[`comp:${node.id}`] = {
        x: 100,
        y: compStartY + i * compSpacing,
        node,
      };
    });

    // Position enums on the right
    const enumStartY = 150;
    const enumSpacing = 80;
    const maxModelX = Math.max(...models.map((_, i) => modelStartX + (i % modelCols) * modelSpacingX));
    enums.forEach((node, i) => {
      positions[`enum:${node.id}`] = {
        x: maxModelX + 200,
        y: enumStartY + i * enumSpacing,
        node,
      };
    });

    return positions;
  }, [graph.nodes]);

  // Get edges with positions
  const edgesWithPositions = useMemo(() => {
    return graph.edges
      .map(edge => {
        const from = nodePositions[edge.from];
        const to = nodePositions[edge.to] || 
                   nodePositions[`comp:${edge.to}`] || 
                   nodePositions[`enum:${edge.to}`];
        if (!from || !to) return null;
        return { edge, from, to };
      })
      .filter(Boolean) as { 
        edge: RelationshipEdge; 
        from: typeof nodePositions[string]; 
        to: typeof nodePositions[string] 
      }[];
  }, [graph.edges, nodePositions]);

  // Get connections for selected node
  const selectedConnections = useMemo(() => {
    if (!selectedNode) return { nodes: new Set<string>(), edges: new Set<number>() };
    
    const connectedNodes = new Set<string>();
    const connectedEdges = new Set<number>();
    
    connectedNodes.add(selectedNode);
    
    edgesWithPositions.forEach((e, i) => {
      const fromId = e.from.node.id;
      const toId = e.to.node.id;
      
      if (fromId === selectedNode || toId === selectedNode) {
        connectedEdges.add(i);
        connectedNodes.add(fromId);
        connectedNodes.add(toId);
      }
    });
    
    return { nodes: connectedNodes, edges: connectedEdges };
  }, [selectedNode, edgesWithPositions]);

  // Filter nodes for search
  const filteredNodes = useMemo(() => {
    if (!searchQuery) return graph.nodes;
    const q = searchQuery.toLowerCase();
    return graph.nodes.filter(n => n.name.toLowerCase().includes(q));
  }, [graph.nodes, searchQuery]);

  // Zoom controls
  const handleZoom = useCallback((delta: number, centerX?: number, centerY?: number) => {
    setView(v => {
      const newScale = Math.max(0.3, Math.min(3, v.scale + delta));
      
      // If center point provided, zoom towards it
      if (centerX !== undefined && centerY !== undefined) {
        const scaleRatio = newScale / v.scale;
        return {
          scale: newScale,
          x: centerX - (centerX - v.x) * scaleRatio,
          y: centerY - (centerY - v.y) * scaleRatio,
        };
      }
      
      return { ...v, scale: newScale };
    });
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const centerX = e.clientX - rect.left;
    const centerY = e.clientY - rect.top;
    handleZoom(e.deltaY > 0 ? -0.1 : 0.1, centerX, centerY);
  }, [handleZoom]);

  // Pan controls
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    setIsDragging(true);
    setDragStart({ x: e.clientX - view.x, y: e.clientY - view.y });
  }, [view.x, view.y]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    setView(v => ({
      ...v,
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    }));
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Center on node
  const centerOnNode = useCallback((nodeId: string) => {
    const pos = nodePositions[nodeId] || 
                nodePositions[`comp:${nodeId}`] || 
                nodePositions[`enum:${nodeId}`];
    
    if (!pos || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const newScale = 1.5;
    
    setView({
      scale: newScale,
      x: rect.width / 2 - pos.x * newScale,
      y: rect.height / 2 - pos.y * newScale,
    });
    
    setSelectedNode(pos.node.id);
    setShowSearch(false);
    setSearchQuery('');
  }, [nodePositions]);

  // Reset view
  const resetView = useCallback(() => {
    setView({ x: 0, y: 0, scale: 1 });
    setSelectedNode(null);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedNode(null);
        setShowSearch(false);
      }
      if (e.key === 'f' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setShowSearch(true);
      }
      if (e.key === '+' || e.key === '=') handleZoom(0.2);
      if (e.key === '-') handleZoom(-0.2);
      if (e.key === '0') resetView();
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleZoom, resetView]);

  // Get node display info
  const getNodeInfo = (nodeId: string) => {
    const pos = nodePositions[nodeId] || 
                nodePositions[`comp:${nodeId}`] || 
                nodePositions[`enum:${nodeId}`];
    return pos?.node;
  };

  const selectedNodeInfo = selectedNode ? getNodeInfo(selectedNode) : null;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-amber-500/5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h3 className="font-semibold text-lg">Schema Relationship Diagram</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Interactive map — scroll to zoom, drag to pan, click nodes to explore
            </p>
          </div>
          
          {/* Controls */}
          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative">
              <button
                onClick={() => setShowSearch(!showSearch)}
                className="p-2 rounded-lg border border-border bg-background hover:bg-card transition-colors"
                title="Search models (⌘F)"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
              
              {showSearch && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-card border border-border rounded-lg shadow-xl z-50">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search models, components, enums..."
                    className="w-full px-3 py-2 bg-transparent border-b border-border text-sm focus:outline-none"
                    autoFocus
                  />
                  <div className="max-h-64 overflow-y-auto">
                    {filteredNodes.slice(0, 20).map(node => (
                      <button
                        key={node.id}
                        onClick={() => centerOnNode(node.id)}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-background/50 flex items-center gap-2"
                      >
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: TYPE_COLORS[node.type].fill }}
                        />
                        <span>{node.name}</span>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {node.type}
                        </span>
                      </button>
                    ))}
                    {filteredNodes.length === 0 && (
                      <p className="px-3 py-2 text-sm text-muted-foreground">No results</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Zoom controls */}
            <div className="flex items-center border border-border rounded-lg bg-background">
              <button
                onClick={() => handleZoom(-0.2)}
                className="p-2 hover:bg-card transition-colors"
                title="Zoom out (-)"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                </svg>
              </button>
              <span className="px-2 text-xs text-muted-foreground min-w-[3rem] text-center">
                {Math.round(view.scale * 100)}%
              </span>
              <button
                onClick={() => handleZoom(0.2)}
                className="p-2 hover:bg-card transition-colors"
                title="Zoom in (+)"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>

            {/* Reset button */}
            <button
              onClick={resetView}
              className="p-2 rounded-lg border border-border bg-background hover:bg-card transition-colors"
              title="Reset view (0)"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
          
          {/* Legend */}
          <div className="flex gap-4 text-xs">
            {Object.entries(TYPE_COLORS).map(([type, colors]) => (
              <div key={type} className="flex items-center gap-1.5">
                <div 
                  className="w-3 h-3 rounded-full border" 
                  style={{ backgroundColor: colors.fill, borderColor: colors.stroke }}
                />
                <span className="text-muted-foreground">{colors.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-6 mt-3 text-sm">
          <div>
            <span className="text-muted-foreground">Models:</span>{' '}
            <span className="font-medium text-blue-400">{graph.nodes.filter(n => n.type === 'model').length}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Components:</span>{' '}
            <span className="font-medium text-violet-400">{graph.nodes.filter(n => n.type === 'component').length}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Enums:</span>{' '}
            <span className="font-medium text-amber-400">{graph.nodes.filter(n => n.type === 'enum').length}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Relationships:</span>{' '}
            <span className="font-medium text-emerald-400">{graph.edges.length}</span>
          </div>
        </div>
      </div>

      {/* Interactive SVG Canvas */}
      <div 
        ref={containerRef}
        className="relative overflow-hidden bg-gradient-to-b from-card to-background/50"
        style={{ height: 500, cursor: isDragging ? 'grabbing' : 'grab' }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <svg 
          ref={svgRef}
          width="100%" 
          height="100%" 
          style={{ 
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
            transformOrigin: '0 0',
          }}
        >
          {/* Grid background */}
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-border/30" />
            </pattern>
          </defs>
          <rect x="-1000" y="-1000" width={svgWidth + 2000} height={svgHeight + 2000} fill="url(#grid)" />

          {/* Draw edges */}
          <g className="edges">
            {edgesWithPositions.map(({ edge, from, to }, i) => {
              const isSelected = selectedNode && selectedConnections.edges.has(i);
              const isHovered = hoveredNode === from.node.id || hoveredNode === to.node.id;
              const color = EDGE_COLORS[edge.type] || EDGE_COLORS.reference;
              
              let opacity = 0.5;
              if (selectedNode) {
                opacity = isSelected ? 1 : 0.1;
              } else if (hoveredNode) {
                opacity = isHovered ? 1 : 0.15;
              }
              
              const midX = (from.x + to.x) / 2;
              const midY = (from.y + to.y) / 2;
              const dy = to.y - from.y;
              const curvature = Math.min(40, Math.abs(dy) * 0.3 + 20);
              const ctrlY = midY - (dy > 0 ? curvature : -curvature);

              return (
                <g key={i}>
                  <path
                    d={`M ${from.x} ${from.y} Q ${midX} ${ctrlY} ${to.x} ${to.y}`}
                    fill="none"
                    stroke={color}
                    strokeWidth={isSelected || isHovered ? 3 : 1.5}
                    strokeOpacity={opacity}
                    strokeDasharray={edge.type === 'bidirectional' ? 'none' : '6,3'}
                    className="transition-all duration-200"
                  />
                  {edge.type !== 'bidirectional' && (
                    <circle
                      cx={to.x}
                      cy={to.y}
                      r={isSelected ? 6 : 4}
                      fill={color}
                      fillOpacity={opacity}
                    />
                  )}
                </g>
              );
            })}
          </g>

          {/* Draw nodes */}
          <g className="nodes">
            {Object.entries(nodePositions).map(([id, { x, y, node }]) => {
              const colors = TYPE_COLORS[node.type];
              const scale = IMPORTANCE_SCALE[node.importance];
              const isSelected = selectedNode === node.id;
              const isConnected = selectedNode && selectedConnections.nodes.has(node.id);
              const isHovered = hoveredNode === node.id;
              const isHub = graph.hubModels.some(h => h.model === node.id);
              const baseRadius = node.type === 'model' ? 36 : node.type === 'component' ? 30 : 26;
              const radius = baseRadius * scale;

              let opacity = 1;
              if (selectedNode && !isSelected && !isConnected) {
                opacity = 0.2;
              } else if (hoveredNode && !isHovered) {
                const hoverConnected = edgesWithPositions.some(
                  e => (e.from.node.id === hoveredNode && e.to.node.id === node.id) ||
                       (e.to.node.id === hoveredNode && e.from.node.id === node.id)
                );
                opacity = hoverConnected ? 1 : 0.4;
              }

              return (
                <g
                  key={id}
                  transform={`translate(${x}, ${y})`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedNode(isSelected ? null : node.id);
                  }}
                  onMouseEnter={() => setHoveredNode(node.id)}
                  onMouseLeave={() => setHoveredNode(null)}
                  className="cursor-pointer"
                  style={{ opacity, transition: 'opacity 0.2s' }}
                >
                  {/* Selection ring */}
                  {isSelected && (
                    <circle
                      r={radius + 12}
                      fill="none"
                      stroke="#ffffff"
                      strokeWidth={3}
                      strokeDasharray="8,4"
                      className="animate-spin"
                      style={{ animationDuration: '8s' }}
                    />
                  )}
                  
                  {/* Hub glow */}
                  {isHub && (
                    <circle
                      r={radius + 8}
                      fill="none"
                      stroke={colors.stroke}
                      strokeWidth={2}
                      strokeOpacity={0.4}
                      className="animate-pulse"
                    />
                  )}
                  
                  {/* Main circle */}
                  <circle
                    r={radius}
                    fill={colors.fill}
                    stroke={isSelected || isHovered ? '#ffffff' : colors.stroke}
                    strokeWidth={isSelected ? 4 : isHovered ? 3 : 2}
                    className="transition-all duration-200"
                  />
                  
                  {/* Node label */}
                  <text
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={colors.text}
                    fontSize={12}
                    fontWeight={600}
                    className="pointer-events-none select-none"
                  >
                    {truncateName(node.name, 14)}
                  </text>

                  {/* Entry count badge */}
                  {node.entryCount !== undefined && node.entryCount > 0 && (
                    <g transform={`translate(${radius * 0.7}, ${-radius * 0.7})`}>
                      <circle r={12} fill="#1f2937" stroke={colors.stroke} strokeWidth={2} />
                      <text
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="#ffffff"
                        fontSize={9}
                        fontWeight={700}
                      >
                        {formatCount(node.entryCount)}
                      </text>
                    </g>
                  )}

                  {/* Hub star */}
                  {isHub && (
                    <text
                      x={-radius * 0.7}
                      y={-radius * 0.7}
                      fontSize={14}
                      className="pointer-events-none"
                    >
                      ⭐
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>

        {/* Mini-map */}
        <div className="absolute bottom-4 right-4 w-32 h-24 bg-card/90 border border-border rounded-lg overflow-hidden">
          <svg width="100%" height="100%" viewBox={`0 0 ${svgWidth} ${svgHeight}`} preserveAspectRatio="xMidYMid meet">
            {Object.entries(nodePositions).map(([id, { x, y, node }]) => (
              <circle
                key={id}
                cx={x}
                cy={y}
                r={8}
                fill={TYPE_COLORS[node.type].fill}
                opacity={selectedNode === node.id ? 1 : 0.5}
              />
            ))}
            {/* Viewport indicator */}
            <rect
              x={-view.x / view.scale}
              y={-view.y / view.scale}
              width={containerRef.current ? containerRef.current.clientWidth / view.scale : 400}
              height={containerRef.current ? containerRef.current.clientHeight / view.scale : 300}
              fill="none"
              stroke="#ffffff"
              strokeWidth={4}
              rx={4}
            />
          </svg>
        </div>

        {/* Keyboard hints */}
        <div className="absolute bottom-4 left-4 text-xs text-muted-foreground bg-card/80 px-2 py-1 rounded">
          Scroll: zoom • Drag: pan • Click: select • Esc: deselect
        </div>
      </div>

      {/* Selected node details panel */}
      {selectedNodeInfo && (
        <div className="p-4 border-t border-border bg-card">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div 
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: TYPE_COLORS[selectedNodeInfo.type].fill }}
              />
              <div>
                <h4 className="font-semibold">{selectedNodeInfo.name}</h4>
                <p className="text-sm text-muted-foreground capitalize">{selectedNodeInfo.type}</p>
              </div>
            </div>
            
            <button
              onClick={() => setSelectedNode(null)}
              className="p-1 hover:bg-background rounded"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <div className="bg-background/50 rounded-lg p-3">
              <div className="text-xl font-bold text-primary">{selectedNodeInfo.fieldCount}</div>
              <div className="text-xs text-muted-foreground">Fields</div>
            </div>
            {selectedNodeInfo.entryCount !== undefined && (
              <div className="bg-background/50 rounded-lg p-3">
                <div className="text-xl font-bold text-primary">{selectedNodeInfo.entryCount.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">Entries</div>
              </div>
            )}
            <div className="bg-background/50 rounded-lg p-3">
              <div className="text-xl font-bold text-emerald-400">
                {edgesWithPositions.filter(e => 
                  e.from.node.id === selectedNodeInfo.id || e.to.node.id === selectedNodeInfo.id
                ).length}
              </div>
              <div className="text-xs text-muted-foreground">Connections</div>
            </div>
            <div className="bg-background/50 rounded-lg p-3">
              <div className="text-sm font-medium capitalize text-primary">{selectedNodeInfo.importance}</div>
              <div className="text-xs text-muted-foreground">Importance</div>
            </div>
          </div>

          {/* Connected nodes */}
          <div className="mt-4">
            <h5 className="text-sm font-medium text-muted-foreground mb-2">Connected To</h5>
            <div className="flex flex-wrap gap-2">
              {Array.from(selectedConnections.nodes)
                .filter(id => id !== selectedNodeInfo.id)
                .slice(0, 12)
                .map(nodeId => {
                  const nodeInfo = getNodeInfo(nodeId);
                  if (!nodeInfo) return null;
                  return (
                    <button
                      key={nodeId}
                      onClick={() => centerOnNode(nodeId)}
                      className="px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 hover:ring-2 ring-primary transition-all"
                      style={{ 
                        backgroundColor: TYPE_COLORS[nodeInfo.type].fill + '20',
                        color: TYPE_COLORS[nodeInfo.type].fill,
                      }}
                    >
                      <div 
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: TYPE_COLORS[nodeInfo.type].fill }}
                      />
                      {nodeInfo.name}
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* Edge legend */}
      <div className="px-4 py-3 border-t border-border bg-card/50">
        <div className="flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-6 h-0.5" style={{ backgroundColor: EDGE_COLORS.reference }} />
            <span className="text-muted-foreground">Reference</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-0.5" style={{ backgroundColor: EDGE_COLORS.bidirectional }} />
            <span className="text-muted-foreground">Bidirectional</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-0.5" style={{ backgroundColor: EDGE_COLORS.component }} />
            <span className="text-muted-foreground">Component</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-amber-400">⭐</span>
            <span className="text-muted-foreground">Hub (most connected)</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function truncateName(name: string, maxLength: number): string {
  if (name.length <= maxLength) return name;
  return name.substring(0, maxLength - 1) + '…';
}

function formatCount(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(0)}k`;
  return count.toString();
}
