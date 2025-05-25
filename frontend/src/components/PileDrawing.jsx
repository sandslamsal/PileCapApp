import React, { useEffect, useRef, useState } from 'react';

const PileDrawing = ({ coordinates, columnSize, pileOverhang = 19.5, showForces = false }) => {
  const canvasRef = useRef(null);
  const [hoveredPile, setHoveredPile] = useState(null);
  const [scale, setScale] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  
  const { colX = 9, colY = 16 } = columnSize || {}; // Default values if not provided

  // Find the maximum absolute coordinate to set the scale
  const findMaxCoordinate = () => {
    if (!coordinates || coordinates.length === 0) return 10;
    
    const allCoords = coordinates.flatMap(coord => [
      Math.abs(coord['x (ft)']), 
      Math.abs(coord['y (ft)'])
    ]);
    
    const maxPileCoord = Math.max(...allCoords);
    // Add some margin to ensure we can see everything
    return maxPileCoord + 5;
  };

  // Calculate which pile is being hovered (if any)
  const handleMouseMove = (e) => {
    if (!canvasRef.current || !coordinates) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const centerX = canvas.width / 2 + offset.x;
    const centerY = canvas.height / 2 + offset.y;
    
    // Handle dragging
    if (isDragging) {
      setOffset({
        x: offset.x + (mouseX - dragStart.x) / (scale * zoom),
        y: offset.y + (mouseY - dragStart.y) / (scale * zoom)
      });
      setDragStart({ x: mouseX, y: mouseY });
      return;
    }
    
    // Check if mouse is over any pile
    const pileRadius = 10 * zoom;
    const hoveredIndex = coordinates.findIndex(pile => {
      const x = centerX + pile['x (ft)'] * scale * zoom;
      const y = centerY - pile['y (ft)'] * scale * zoom; // Y is inverted in canvas
      const distance = Math.sqrt(Math.pow(mouseX - x, 2) + Math.pow(mouseY - y, 2));
      return distance <= pileRadius;
    });
    
    setHoveredPile(hoveredIndex >= 0 ? coordinates[hoveredIndex] : null);
    
    // Change cursor style based on hover state
    canvas.style.cursor = hoveredIndex >= 0 ? 'pointer' : isDragging ? 'grabbing' : 'grab';
  };
  
  const handleMouseDown = (e) => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    setIsDragging(true);
    setDragStart({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
    
    canvas.style.cursor = 'grabbing';
  };
  
  const handleMouseUp = () => {
    setIsDragging(false);
    if (canvasRef.current) {
      canvasRef.current.style.cursor = 'grab';
    }
  };
  
  const handleMouseLeave = () => {
    setIsDragging(false);
    setHoveredPile(null);
  };
  
  const handleWheel = (e) => {
    e.preventDefault();
    
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1; // Zoom out or in
    const newZoom = Math.max(0.5, Math.min(5, zoom * zoomFactor)); // Limit zoom range
    
    setZoom(newZoom);
  };

  // Draw the pile layout on canvas
  useEffect(() => {
    if (!coordinates || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const maxCoord = findMaxCoordinate();
    
    // Calculate the drawing scale
    const newScale = Math.min(canvas.width, canvas.height) / (2 * maxCoord);
    setScale(newScale);
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const centerX = canvas.width / 2 + offset.x;
    const centerY = canvas.height / 2 + offset.y;
    const effectiveScale = newScale * zoom;
    
    // Draw grid
    ctx.beginPath();
    ctx.lineWidth = 0.5;
    ctx.strokeStyle = '#ddd';
    
    // Horizontal grid lines
    for (let y = -maxCoord; y <= maxCoord; y += 5) {
      ctx.moveTo(0, centerY - y * effectiveScale);
      ctx.lineTo(canvas.width, centerY - y * effectiveScale);
    }
    // Vertical grid lines
    for (let x = -maxCoord; x <= maxCoord; x += 5) {
      ctx.moveTo(centerX + x * effectiveScale, 0);
      ctx.lineTo(centerX + x * effectiveScale, canvas.height);
    }
    ctx.stroke();
    
    // Draw coordinate axes
    ctx.beginPath();
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#aaa';
    ctx.moveTo(0, centerY);
    ctx.lineTo(canvas.width, centerY);
    ctx.moveTo(centerX, 0);
    ctx.lineTo(centerX, canvas.height);
    ctx.stroke();
    
    // Calculate the pile cap boundary based on pile positions and spacing
    // Find the extreme pile coordinates in X and Y directions
    if (coordinates && coordinates.length > 0) {
      const xCoords = coordinates.map(pile => pile['x (ft)']);
      const yCoords = coordinates.map(pile => pile['y (ft)']);
      
      const minX = Math.min(...xCoords);
      const maxX = Math.max(...xCoords);
      const minY = Math.min(...yCoords);
      const maxY = Math.max(...yCoords);
      
      // Determine pile spacing in X and Y
      let spaceX = 0;
      let spaceY = 0;
      
      // If we have multiple piles, calculate actual spacing from the coordinates
      if (coordinates.length > 1) {
        // Sort piles by X coordinate and find spacing
        const uniqueXs = [...new Set(xCoords)].sort((a, b) => a - b);
        const uniqueYs = [...new Set(yCoords)].sort((a, b) => a - b);
        
        // If we have multiple X or Y values, calculate spacing
        if (uniqueXs.length > 1) {
          for (let i = 1; i < uniqueXs.length; i++) {
            spaceX = Math.max(spaceX, uniqueXs[i] - uniqueXs[i-1]);
          }
        }
        
        if (uniqueYs.length > 1) {
          for (let i = 1; i < uniqueYs.length; i++) {
            spaceY = Math.max(spaceY, uniqueYs[i] - uniqueYs[i-1]);
          }
        }
      }
      
      // Calculate pile cap dimensions
      // For X dimension: distance between extreme piles + 2 * overhang
      // For Y dimension: distance between extreme piles + 2 * overhang
      const pileCapX = (maxX - minX) + 2 * pileOverhang;
      const pileCapY = (maxY - minY) + 2 * pileOverhang;
      
      // Draw pile cap with gradient fill
      const gradientFill = ctx.createLinearGradient(
        centerX - (pileCapX * effectiveScale) / 2,
        centerY - (pileCapY * effectiveScale) / 2,
        centerX + (pileCapX * effectiveScale) / 2,
        centerY + (pileCapY * effectiveScale) / 2
      );
      gradientFill.addColorStop(0, '#e0e0e0');
      gradientFill.addColorStop(1, '#f8f8f8');
      
      // Calculate the center of the pile cap (should be centered on the average pile position)
      const pileCapCenterX = (minX + maxX) / 2;
      const pileCapCenterY = (minY + maxY) / 2;
      
      ctx.beginPath();
      ctx.fillStyle = gradientFill;
      ctx.strokeStyle = '#666';
      ctx.lineWidth = 2;
      ctx.rect(
        centerX + (minX * effectiveScale) - pileOverhang * effectiveScale,
        centerY - (maxY * effectiveScale) - pileOverhang * effectiveScale,
        pileCapX * effectiveScale,
        pileCapY * effectiveScale
      );
      ctx.fill();
      ctx.stroke();
    }
    
    // Draw column with pattern fill - centered at the origin (0,0)
    ctx.beginPath();
    ctx.fillStyle = '#b3b3b3';
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.rect(
      centerX - (colX * effectiveScale) / 2,
      centerY - (colY * effectiveScale) / 2,
      colX * effectiveScale,
      colY * effectiveScale
    );
    ctx.fill();
    
    // Add a cross-hatch pattern to the column
    ctx.beginPath();
    ctx.lineWidth = 0.5;
    ctx.strokeStyle = '#777';
    const patternSize = 8 * zoom;
    const colLeft = centerX - (colX * effectiveScale) / 2;
    const colRight = centerX + (colX * effectiveScale) / 2;
    const colTop = centerY - (colY * effectiveScale) / 2;
    const colBottom = centerY + (colY * effectiveScale) / 2;
    
    // Fix hatching: only draw lines within the column rectangle
    // First set of lines (top-left to bottom-right)
    for (let x = colLeft; x <= colRight; x += patternSize) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(colLeft, colTop, colX * effectiveScale, colY * effectiveScale);
      ctx.clip();
      ctx.moveTo(x, colTop);
      ctx.lineTo(x + colY * effectiveScale, colBottom);
      ctx.stroke();
      ctx.restore();
    }
    for (let y = colTop; y <= colBottom; y += patternSize) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(colLeft, colTop, colX * effectiveScale, colY * effectiveScale);
      ctx.clip();
      ctx.moveTo(colLeft, y);
      ctx.lineTo(colRight, y + colX * effectiveScale);
      ctx.stroke();
      ctx.restore();
    }
    // Second set of lines (top-right to bottom-left)
    for (let x = colRight; x >= colLeft; x -= patternSize) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(colLeft, colTop, colX * effectiveScale, colY * effectiveScale);
      ctx.clip();
      ctx.moveTo(x, colTop);
      ctx.lineTo(x - colY * effectiveScale, colBottom);
      ctx.stroke();
      ctx.restore();
    }
    for (let y = colTop; y <= colBottom; y += patternSize) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(colLeft, colTop, colX * effectiveScale, colY * effectiveScale);
      ctx.clip();
      ctx.moveTo(colRight, y);
      ctx.lineTo(colLeft, y + colX * effectiveScale);
      ctx.stroke();
      ctx.restore();
    }
    
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.strokeRect(
      centerX - (colX * effectiveScale) / 2,
      centerY - (colY * effectiveScale) / 2,
      colX * effectiveScale,
      colY * effectiveScale
    );
    
    // Draw piles
    const pileRadius = 12 * zoom;
    coordinates.forEach(pile => {
      const x = centerX + pile['x (ft)'] * effectiveScale;
      const y = centerY - pile['y (ft)'] * effectiveScale; // Y is inverted in canvas
      
      const isHovered = hoveredPile && pile['No.'] === hoveredPile['No.'];
      
      // Draw pile shadow
      if (isHovered) {
        ctx.beginPath();
        ctx.arc(x + 2, y + 2, pileRadius + 2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fill();
      }
      
      // Draw pile circle
      ctx.beginPath();
      ctx.arc(x, y, pileRadius, 0, Math.PI * 2);
      
      // Create radial gradient with colors based on force values if showForces is true
      let gradientStartColor = '#3a71a9';
      let gradientEndColor = '#265478';
      
      if (showForces && pile['Pmax (k)'] !== undefined) {
        // If Pmax is high (>100), make it red
        if (pile['Pmax (k)'] > 100) {
          gradientStartColor = '#d95555';
          gradientEndColor = '#aa3939';
        } 
        // If Pmin is negative (tension), make it blue
        else if (pile['Pmin (k)'] < 0) {
          gradientStartColor = '#5555d9';
          gradientEndColor = '#3939aa';
        }
      }
      
      if (isHovered) {
        gradientStartColor = '#5a9bd5';
        gradientEndColor = '#3a71a9';
      }
      
      const gradient = ctx.createRadialGradient(
        x - pileRadius/3, y - pileRadius/3, 0,
        x, y, pileRadius
      );
      gradient.addColorStop(0, gradientStartColor);
      gradient.addColorStop(1, gradientEndColor);
      
      ctx.fillStyle = gradient;
      ctx.fill();
      
      ctx.lineWidth = isHovered ? 3 : 2;
      ctx.strokeStyle = isHovered ? '#fff' : '#333';
      ctx.stroke();
      
      // Add pile number
      ctx.fillStyle = '#fff';
      ctx.font = isHovered ? `bold ${Math.max(10, 12 * zoom)}px Arial` : `${Math.max(10, 12 * zoom)}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pile['No.'], x, y);
      
      // Add force values above pile if showForces
      if (showForces && pile['Pmax (k)'] !== undefined) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(x - pileRadius, y - pileRadius - 20, pileRadius * 2, 16);
        ctx.fillStyle = '#fff';
        ctx.font = `${Math.max(8, 9 * zoom)}px Arial`;
        ctx.fillText(`${pile['Pmax (k)'].toFixed(0)}k`, x, y - pileRadius - 12);
        // (Removed load case text below pile)
      }
    });
    
    // Add labels and legend
    ctx.fillStyle = '#333';
    ctx.font = '14px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    // ctx.fillText(`Column: ${colX}' x ${colY}'`, 10, 10);
    
    // If we have calculated a pile cap
    if (coordinates && coordinates.length > 0) {
      const xCoords = coordinates.map(pile => pile['x (ft)']);
      const yCoords = coordinates.map(pile => pile['y (ft)']);
      
      const minX = Math.min(...xCoords);
      const maxX = Math.max(...xCoords);
      const minY = Math.min(...yCoords);
      const maxY = Math.max(...yCoords);
      
      let spaceX = 0;
      let spaceY = 0;
      
      if (coordinates.length > 1) {
        const uniqueXs = [...new Set(xCoords)].sort((a, b) => a - b);
        const uniqueYs = [...new Set(yCoords)].sort((a, b) => a - b);
        
        if (uniqueXs.length > 1) {
          for (let i = 1; i < uniqueXs.length; i++) {
            spaceX = Math.max(spaceX, uniqueXs[i] - uniqueXs[i-1]);
          }
        }
        
        if (uniqueYs.length > 1) {
          for (let i = 1; i < uniqueYs.length; i++) {
            spaceY = Math.max(spaceY, uniqueYs[i] - uniqueYs[i-1]);
          }
        }
      }
      
      const pileCapX = Math.abs(maxX - minX) + 2 * pileOverhang;
      const pileCapY = Math.abs(maxY - minY) + 2 * pileOverhang;
      
      // ctx.fillText(`Pile Cap: ${pileCapX.toFixed(2)}' x ${pileCapY.toFixed(2)}'`, 10, 30);
      // ctx.fillText(`Pile Overhang: ${pileOverhang}'`, 10, 50);
      // ctx.fillText(`Pile Spacing: ${spaceX.toFixed(2)}' (X), ${spaceY.toFixed(2)}' (Y)`, 10, 70);
    }
    
    // Add zoom instructions
    ctx.textAlign = 'right';
    ctx.fillText('Scroll to zoom, drag to pan', canvas.width - 10, 10);      // Display hovered pile info
    if (hoveredPile) {
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      let lines = [
        `Pile #${hoveredPile['No.']} Details`,
        `X: ${hoveredPile['x (ft)']}' Y: ${hoveredPile['y (ft)']}'`
      ];
      if (hoveredPile['Pmax (k)'] !== undefined) {
        if (hoveredPile['Pmax Components']) {
          const maxC = hoveredPile['Pmax Components'];
          const pmaxSum = (maxC.axial + maxC.moment_x + maxC.moment_y).toFixed(2);
          lines.push(`Pmax = ${maxC.axial.toFixed(2)} ${maxC.moment_x >= 0 ? '+' : '-'} ${Math.abs(maxC.moment_x).toFixed(2)} ${maxC.moment_y >= 0 ? '+' : '-'} ${Math.abs(maxC.moment_y).toFixed(2)} = ${pmaxSum} k`);
        }
        if (hoveredPile['Pmin Components']) {
          const minC = hoveredPile['Pmin Components'];
          const pminSum = (minC.axial + minC.moment_x + minC.moment_y).toFixed(2);
          lines.push(`Pmin = ${minC.axial.toFixed(2)} ${minC.moment_x >= 0 ? '+' : '-'} ${Math.abs(minC.moment_x).toFixed(2)} ${minC.moment_y >= 0 ? '+' : '-'} ${Math.abs(minC.moment_y).toFixed(2)} = ${pminSum} k`);
        }
      }
      const infoBoxWidth = 280;
      const lineHeight = 18;
      const infoBoxHeight = lines.length * lineHeight + 16;
      ctx.fillRect(10, canvas.height - infoBoxHeight - 10, infoBoxWidth, infoBoxHeight);
      ctx.strokeStyle = '#555';
      ctx.lineWidth = 2;
      ctx.strokeRect(10, canvas.height - infoBoxHeight - 10, infoBoxWidth, infoBoxHeight);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px Arial';
      ctx.fillText(lines[0], 20, canvas.height - infoBoxHeight + 5);
      ctx.font = '12px Arial';
      for (let i = 1; i < lines.length; i++) {
        ctx.fillText(lines[i], 20, canvas.height - infoBoxHeight + 5 + i * lineHeight);
      }
    }
    
  }, [coordinates, colX, colY, pileOverhang, hoveredPile, offset, zoom, isDragging]);
  
  // Compute pile cap and spacing for info box
  let pileCapX = null, pileCapY = null, spaceX = null, spaceY = null;
  if (coordinates && coordinates.length > 0) {
    const xCoords = coordinates.map(pile => pile['x (ft)']);
    const yCoords = coordinates.map(pile => pile['y (ft)']);
    const minX = Math.min(...xCoords);
    const maxX = Math.max(...xCoords);
    const minY = Math.min(...yCoords);
    const maxY = Math.max(...yCoords);
    pileCapX = Math.abs(maxX - minX) + 2 * pileOverhang;
    pileCapY = Math.abs(maxY - minY) + 2 * pileOverhang;
    // Spacing
    spaceX = 0; spaceY = 0;
    if (coordinates.length > 1) {
      const uniqueXs = [...new Set(xCoords)].sort((a, b) => a - b);
      const uniqueYs = [...new Set(yCoords)].sort((a, b) => a - b);
      if (uniqueXs.length > 1) {
        for (let i = 1; i < uniqueXs.length; i++) {
          spaceX = Math.max(spaceX, uniqueXs[i] - uniqueXs[i-1]);
        }
      }
      if (uniqueYs.length > 1) {
        for (let i = 1; i < uniqueYs.length; i++) {
          spaceY = Math.max(spaceY, uniqueYs[i] - uniqueYs[i-1]);
        }
      }
    }
  }
  // Compute drawing scale for info box (include zoom)
  const canvasWidth = 600;
  const canvasHeight = 500;
  const maxCoord = findMaxCoordinate();
  const baseScale = Math.min(canvasWidth, canvasHeight) / (2 * maxCoord);
  const drawingScale = baseScale * zoom;
  
  return (
    <div className="pile-drawing-container">
      <canvas 
        ref={canvasRef} 
        width={canvasWidth} 
        height={canvasHeight} 
        style={{ border: '1px solid #ccc', background: '#f9f9f9', cursor: 'grab' }}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
      />
      <div className="drawing-controls">
        <button onClick={() => setZoom(Math.min(5, zoom * 1.2))}>Zoom In</button>
        <button onClick={() => setZoom(Math.max(0.5, zoom / 1.2))}>Zoom Out</button>
        <button onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }); }}>Reset View</button>
      </div>
      {/* Flex row for info box and legend */}
      <div style={{display: 'flex', flexDirection: 'row', alignItems: 'flex-start', width: '100%'}}>
        <div className="drawing-info-box" style={{marginTop: 12, marginBottom: 8, background: '#f8fafc', borderRadius: 8, padding: 12, boxShadow: '0 1px 4px #0001', fontSize: 14, color: '#234', minWidth: 260, maxWidth: 320, textAlign: 'left'}}>
          <strong>Drawing Details:</strong>
          <ul style={{margin: '8px 0 0 18px', padding: 0, listStyle: 'disc'}}>
            <li>Column: <b>{colX}' x {colY}'</b></li>
            {pileCapX && pileCapY && <li>Pile Cap: <b>{pileCapX.toFixed(2)}' x {pileCapY.toFixed(2)}'</b></li>}
            <li>Pile Overhang: <b>{pileOverhang}'</b></li>
            {spaceX !== null && spaceY !== null && <li>Pile Spacing: <b>{spaceX.toFixed(2)}' (X), {spaceY.toFixed(2)}' (Y)</b></li>}
            <li>Drawing Scale: <b>1 unit = {drawingScale.toFixed(2)} px/ft</b></li>
          </ul>
        </div>
        <div style={{flex: 1}}></div>
      </div>
      {/* Legend below the drawing */}
      <div className="pile-drawing-legend" style={{marginTop: 16, background: '#f4f8fc', borderRadius: 8, padding: 12, boxShadow: '0 2px 6px #0001'}}>
        <strong>Legend:</strong>
        <ul style={{margin: '8px 0 0 18px', fontSize: 13}}>
          <li><span style={{display:'inline-block',width:16,height:16,background:'#b3b3b3',border:'1px solid #333',marginRight:6,verticalAlign:'middle'}}></span> Column (with hatching)</li>
          <li><span style={{display:'inline-block',width:16,height:16,background:'#3a71a9',border:'1px solid #333',marginRight:6,verticalAlign:'middle'}}></span> Pile (normal load)</li>
          <li><span style={{display:'inline-block',width:16,height:16,background:'#d95555',border:'1px solid #333',marginRight:6,verticalAlign:'middle'}}></span> Pile (Pmax &gt; 100 kips)</li>
          <li><span style={{display:'inline-block',width:16,height:16,background:'#5555d9',border:'1px solid #333',marginRight:6,verticalAlign:'middle'}}></span> Pile (Pmin &lt; 0 kips)</li>
          <li><span style={{display:'inline-block',width:16,height:16,background:'#e0e0e0',border:'1px solid #666',marginRight:6,verticalAlign:'middle'}}></span> Pile Cap boundary</li>
          <li><span style={{display:'inline-block',width:16,height:16,background:'#000',border:'1px solid #555',marginRight:6,verticalAlign:'middle'}}></span> Hover: Details box</li>
        </ul>
        <div style={{marginTop:8, fontSize:12, color:'#555'}}>
          <strong>Instructions:</strong> Hover over a pile for details. Zoom/pan with mouse or buttons. Pile color indicates force status. Hatching is always within the column boundary.
        </div>
      </div>
    </div>
  );
};

export default PileDrawing;
