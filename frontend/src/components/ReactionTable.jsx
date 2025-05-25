import React, { useState, useEffect, useRef } from 'react';

// Empty initial data structure
const emptyReactions = [
  { load_case: '', dc_factor: 1, fx: 0, fy: 0, fz: 0, mx: 0, my: 0 },
];

const ReactionTable = ({ onSave }) => {
  const [reactions, setReactions] = useState(emptyReactions);
  const [isEditing, setIsEditing] = useState(true);
  const [focusedCell, setFocusedCell] = useState({ row: null, col: null });
  const [isPasting, setIsPasting] = useState(false);
  const tableRef = useRef(null);

  useEffect(() => {
    // Load reactions from backend when component mounts
    const fetchReactions = async () => {
      try {
        const response = await fetch('http://localhost:8002/api/reactions');
        const data = await response.json();
        if (data.reactions && data.reactions.length > 0) {
          setReactions(data.reactions);
        }
      } catch (error) {
        console.error('Error fetching reactions:', error);
      }
    };

    fetchReactions();
  }, []);

  // Handle field selection
  const handleCellFocus = (rowIndex, field) => {
    setFocusedCell({ row: rowIndex, col: field });
  };

  // Handle value change for a specific cell
  const handleValueChange = (index, field, value) => {
    const updatedReactions = [...reactions];
    
    // Handle text fields and numeric fields differently
    if (field === 'load_case') {
      updatedReactions[index][field] = value;
    } else {
      // Parse as float, but allow empty string during editing
      updatedReactions[index][field] = value === '' ? '' : parseFloat(value) || 0;
    }
    
    setReactions(updatedReactions);
  };
  
  // Handle paste from Excel
  const handlePaste = (e) => {
    e.preventDefault();
    if (!focusedCell || focusedCell.row === null) return;
    
    setIsPasting(true);
    
    const clipboardData = e.clipboardData.getData('text');
    const rows = clipboardData.split(/\r\n|\n|\r/).filter(row => row.trim());
    
    if (rows.length === 0) {
      setIsPasting(false);
      return;
    }
    
    const startRow = focusedCell.row;
    const startCol = focusedCell.col;
    const fields = ['load_case', 'dc_factor', 'fx', 'fy', 'fz', 'mx', 'my'];
    const fieldIndex = fields.indexOf(startCol);
    
    if (fieldIndex === -1) {
      setIsPasting(false);
      return;
    }
    
    const updatedReactions = [...reactions];
    
    // Ensure we have enough rows for the paste operation
    while (updatedReactions.length < startRow + rows.length) {
      updatedReactions.push({ load_case: '', dc_factor: 1, fx: 0, fy: 0, fz: 0, mx: 0, my: 0 });
    }
    
    // Process each row from clipboard
    rows.forEach((row, rowIndex) => {
      const columns = row.split('\t');
      
      columns.forEach((value, colIndex) => {
        const targetCol = fields[fieldIndex + colIndex];
        
        // Make sure we don't go beyond available fields
        if (targetCol && startRow + rowIndex < updatedReactions.length) {
          if (targetCol === 'load_case') {
            updatedReactions[startRow + rowIndex][targetCol] = value.trim();
          } else {
            // Parse numeric fields
            const numValue = parseFloat(value.trim());
            updatedReactions[startRow + rowIndex][targetCol] = isNaN(numValue) ? 0 : numValue;
          }
        }
      });
    });
    
    setReactions(updatedReactions);
    setIsPasting(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Validate that at least one reaction has a load case name
      const hasValidLoadCase = reactions.some(r => r.load_case && r.load_case.trim() !== '');
      if (!hasValidLoadCase) {
        alert('Please provide at least one load case name before saving.');
        return;
      }
      console.log('Saving reactions:', reactions);
      const response = await fetch('http://localhost:8002/api/reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reactions }),
      });
      const data = await response.json();
      console.log('Save response:', data);
      // Always fetch the latest reactions from backend after save
      const fetchResponse = await fetch('http://localhost:8002/api/reactions');
      const fetchData = await fetchResponse.json();
      if (fetchData.reactions && fetchData.reactions.length > 0) {
        setReactions(fetchData.reactions);
      } else {
        setReactions(emptyReactions);
      }
      setIsEditing(false);
      if (onSave) onSave(fetchData.reactions || []);
    } catch (error) {
      console.error('Error saving reactions:', error);
      alert('Failed to save reactions. Please try again.');
    }
  };

  return (
    <div className="reactions-section">
      <h2>Reactions at Top of Footer at Column Centroid (Footing CSYS)</h2>
      <div className="table-info">
        <p>
          <strong>Excel-compatible:</strong> You can paste data directly from Excel or other spreadsheets. 
          Click on a cell first, then paste (Ctrl+V or Cmd+V).
        </p>
      </div>
      <div className="table-controls">
        <button 
          type="button" 
          onClick={() => setIsEditing(!isEditing)}
        >
          {isEditing ? 'View Mode' : 'Edit Mode'}
        </button>
        {isEditing && (
          <button type="button" onClick={handleSubmit}>Save Reactions</button>
        )}
      </div>
      <div className="reaction-table-scroll-wrapper" style={{overflowX: 'auto', width: '100%'}}>
        <table 
          className="reaction-table" 
          style={{minWidth: 900}}
          onPaste={isEditing ? handlePaste : undefined}
        >
          <thead>
            <tr>
              <th>Load Case</th>
              <th>DC Factor</th>
              <th>Fx (k)</th>
              <th>Fy (k)</th>
              <th>Fz (k)</th>
              <th>Mx (k-ft)</th>
              <th>My (k-ft)</th>
            </tr>
          </thead>
          <tbody>
            {reactions.map((reaction, index) => (
              <tr key={index}>
                <td>
                  {isEditing ? (
                    <input
                      type="text"
                      value={reaction.load_case}
                      onChange={e => handleValueChange(index, 'load_case', e.target.value)}
                      onFocus={() => handleCellFocus(index, 'load_case')}
                      placeholder="Load Case"
                    />
                  ) : (
                    reaction.load_case || '-'
                  )}
                </td>
                <td>
                  {isEditing ? (
                    <input
                      type="text" // Changed to text to allow for empty values during editing
                      value={reaction.dc_factor}
                      onChange={e => handleValueChange(index, 'dc_factor', e.target.value)}
                      onFocus={() => handleCellFocus(index, 'dc_factor')}
                      step="any"
                      placeholder="1"
                    />
                  ) : (
                    reaction.dc_factor
                  )}
                </td>
                <td>
                  {isEditing ? (
                    <input
                      type="text"
                      value={reaction.fx}
                      onChange={e => handleValueChange(index, 'fx', e.target.value)}
                      onFocus={() => handleCellFocus(index, 'fx')}
                      step="any"
                      placeholder="0"
                    />
                  ) : (
                    reaction.fx
                  )}
                </td>
                <td>
                  {isEditing ? (
                    <input
                      type="text"
                      value={reaction.fy}
                      onChange={e => handleValueChange(index, 'fy', e.target.value)}
                      onFocus={() => handleCellFocus(index, 'fy')}
                      step="any"
                      placeholder="0"
                    />
                  ) : (
                    reaction.fy
                  )}
                </td>
                <td>
                  {isEditing ? (
                    <input
                      type="text"
                      value={reaction.fz}
                      onChange={e => handleValueChange(index, 'fz', e.target.value)}
                      onFocus={() => handleCellFocus(index, 'fz')}
                      step="any"
                      placeholder="0"
                    />
                  ) : (
                    reaction.fz
                  )}
                </td>
                <td>
                  {isEditing ? (
                    <input
                      type="text"
                      value={reaction.mx}
                      onChange={e => handleValueChange(index, 'mx', e.target.value)}
                      onFocus={() => handleCellFocus(index, 'mx')}
                      step="any"
                      placeholder="0"
                    />
                  ) : (
                    reaction.mx
                  )}
                </td>
                <td>
                  {isEditing ? (
                    <input
                      type="text"
                      value={reaction.my}
                      onChange={e => handleValueChange(index, 'my', e.target.value)}
                      onFocus={() => handleCellFocus(index, 'my')}
                      step="any"
                      placeholder="0"
                    />
                  ) : (
                    reaction.my
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {isEditing && (
        <div className="table-actions">
          <button 
            type="button"
            onClick={() => {
              const newReaction = { load_case: '', dc_factor: 1, fx: 0, fy: 0, fz: 0, mx: 0, my: 0 };
              setReactions([...reactions, newReaction]);
            }}
          >
            Add Row
          </button>
          <button 
            type="button"
            onClick={() => setReactions(emptyReactions)}
          >
            Clear Table
          </button>
        </div>
      )}
      {isPasting && <div className="paste-overlay">Processing paste data...</div>}
    </div>
  );
};

export default ReactionTable;
