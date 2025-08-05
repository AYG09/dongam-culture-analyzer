// src/components/LayerBoundaryGuide.tsx

import React from 'react';
import type { 
  LayerBoundary, 
  LayerSystemState, 
  LayerVisualizationOptions 
} from '../types/layerSystem';
import { LAYER_CONFIG } from '../types/layerSystem';

interface LayerBoundaryGuideProps {
  layerState: LayerSystemState;
  visualizationOptions: LayerVisualizationOptions;
  containerWidth: number;
  onLayerHeightChange: (layerIndex: number, newHeight: number) => void;
  highlightedLayers?: number[];
}

export const LayerBoundaryGuide: React.FC<LayerBoundaryGuideProps> = ({
  layerState,
  visualizationOptions,
  containerWidth,
  onLayerHeightChange,
  highlightedLayers = []
}) => {
  if (!visualizationOptions.showLayerBoundaries) {
    return null;
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>, layerIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    const startHeight = layerState.boundaries[layerIndex].height;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dy = moveEvent.clientY - startY;
      const newHeight = Math.max(100, startHeight + dy); // 최소 높이 100px
      onLayerHeightChange(layerIndex, newHeight);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const renderLayerLabel = (boundary: LayerBoundary) => {
    if (!visualizationOptions.showLayerLabels) return null;

    const config = Object.values(LAYER_CONFIG).find(c => c.index === boundary.layerIndex);
    if (!config) return null;

    const isHighlighted = highlightedLayers.includes(boundary.layerIndex);

    const labelStyle: React.CSSProperties = {
      position: 'absolute',
      top: `${boundary.yMin + 20}px`,
      left: '20px',
      padding: '8px 16px',
      backgroundColor: isHighlighted ? config.color : 'rgba(255, 255, 255, 0.9)',
      color: isHighlighted ? '#FFFFFF' : config.color,
      border: `2px solid ${config.color}`,
      borderRadius: '20px',
      fontSize: '14px',
      fontWeight: 'bold',
      transition: visualizationOptions.animateTransitions ? 'all 0.3s ease' : 'none',
      zIndex: 10,
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
      pointerEvents: 'auto',
    };

    return (
      <div key={`label-${boundary.layerIndex}`} style={labelStyle}>
        {config.label}
      </div>
    );
  };

  const renderBoundaryLine = (boundary: LayerBoundary, isLast: boolean) => {
    if (isLast) return null;

    const lineStyle: React.CSSProperties = {
      position: 'absolute',
      top: `${boundary.yMax}px`,
      left: 0,
      right: 0,
      height: '5px',
      backgroundColor: 'rgba(107, 114, 128, 0.2)',
      cursor: 'ns-resize',
      transition: visualizationOptions.animateTransitions ? 'all 0.3s ease' : 'none',
      zIndex: 20,
      pointerEvents: 'auto',
    };

    return (
      <div
        key={`boundary-${boundary.layerIndex}`}
        style={lineStyle}
        onMouseDown={(e) => handleMouseDown(e, boundary.layerIndex)}
      />
    );
  };

  const renderLayerBackground = (boundary: LayerBoundary) => {
    const isHighlighted = highlightedLayers.includes(boundary.layerIndex);
    
    const backgroundStyle: React.CSSProperties = {
      position: 'absolute',
      top: `${boundary.yMin}px`,
      left: 0,
      width: '100%',
      height: `${boundary.height}px`,
      backgroundColor: boundary.color,
      opacity: isHighlighted ? 0.2 : visualizationOptions.layerOpacity,
      transition: visualizationOptions.animateTransitions ? 'all 0.3s ease' : 'none',
      zIndex: 1,
    };

    return (
      <div
        key={`background-${boundary.layerIndex}`}
        style={backgroundStyle}
      />
    );
  };

  return (
    <div 
      className="layer-boundary-guide"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: containerWidth,
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1
      }}
    >
      {layerState.boundaries.map(renderLayerBackground)}
      {layerState.boundaries.map((boundary, index) => 
        renderBoundaryLine(boundary, index === layerState.boundaries.length - 1)
      )}
      {layerState.boundaries.map(renderLayerLabel)}
    </div>
  );
};

export default LayerBoundaryGuide;
