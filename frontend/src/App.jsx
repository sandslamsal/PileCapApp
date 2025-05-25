import { useState } from "react";
import "./App.css";
import PileDrawing from "./components/PileDrawing";
import ReactionTable from "./components/ReactionTable";

function App() {
  const [form, setForm] = useState({
    fc: 5.5,
    fy: 60,
    cover: 4.5,
    col_x_dim: 9,
    col_y_dim: 16,
    ecc_x: 0,
    ecc_y: 0,
    footing_thickness: 9,
    pile_embedment: 12,
    pile_overhang: 1.625, // changed default to 1.625
    ground_elev: 73.4,
    footing_top_elev: 70.4,
    water_elev: 68,
    soil_weight: 0.115,
    seal_thickness: 0,
  });

  const [pileForm, setPileForm] = useState({
    n_x: 8, // Default number of piles in X direction
    s_x: 3.75, // Default spacing in X direction
    n_y: 6, // Default number of piles in Y direction
    s_y: 4.15, // Default spacing in Y direction
  });

  const [result, setResult] = useState(null);
  const [pileCoordinates, setPileCoordinates] = useState(null);
  const [pileForces, setPileForces] = useState(null);
  const [loadCaseSaved, setLoadCaseSaved] = useState(false);
  const [advancedDesign, setAdvancedDesign] = useState(null);

  // Error state for user feedback
  const [error, setError] = useState("");

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: parseFloat(e.target.value) });
  };

  const handlePileFormChange = (e) => {
    setPileForm({ ...pileForm, [e.target.name]: parseFloat(e.target.value) });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const response = await fetch("http://localhost:8002/api/calculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await response.json();
    setResult(data.results);
  };

  // Only generate pile coordinates, do not calculate pile forces automatically
  const handlePileCoordinatesSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!pileForm.n_x || !pileForm.s_x || !pileForm.n_y || !pileForm.s_y || pileForm.n_x < 1 || pileForm.n_y < 1 || pileForm.s_x <= 0 || pileForm.s_y <= 0) {
      setError("Please enter valid pile numbers and spacing.");
      return;
    }
    try {
      const queryParams = new URLSearchParams({
        n_x: pileForm.n_x,
        s_x: pileForm.s_x,
        n_y: pileForm.n_y,
        s_y: pileForm.s_y,
        with_calculations: false, // Only get coordinates, not forces
        fc: form.fc,
        fy: form.fy,
        cover: form.cover,
        col_x_dim: form.col_x_dim,
        col_y_dim: form.col_y_dim,
        ecc_x: form.ecc_x,
        ecc_y: form.ecc_y,
        footing_thickness: form.footing_thickness,
        pile_embedment: form.pile_embedment,
        pile_overhang: form.pile_overhang,
        ground_elev: form.ground_elev,
        footing_top_elev: form.footing_top_elev,
        water_elev: form.water_elev,
        soil_weight: form.soil_weight,
        seal_thickness: form.seal_thickness
      }).toString();
      const response = await fetch(`http://localhost:8002/api/pile-coordinates?${queryParams}`);
      const data = await response.json();
      if (!data.coordinates || data.coordinates.length === 0) {
        setError("Failed to generate pile coordinates. Please check your input.");
        setPileCoordinates(null);
        setPileForces(null);
        setAdvancedDesign(null);
        return;
      }
      setPileCoordinates(data.coordinates);
      setPileForces(null); // Clear previous forces
      setAdvancedDesign(null); // Clear previous advanced design
    } catch (err) {
      setError("Error generating pile coordinates. Backend may be down.");
      setPileCoordinates(null);
      setPileForces(null);
      setAdvancedDesign(null);
    }
  };

  // Calculate pile forces (Pmax/Pmin) only when user clicks the button
  const calculatePileForces = async (e) => {
    e.preventDefault();
    setError("");
    if (!pileCoordinates || pileCoordinates.length === 0) {
      setError("Please generate pile coordinates first.");
      return;
    }
    if (!loadCaseSaved) {
      setError("Please save load combinations in the reaction table first.");
      return;
    }
    try {
      const reactionsResponse = await fetch('http://localhost:8002/api/reactions');
      const reactionsData = await reactionsResponse.json();
      if (!reactionsData.reactions || reactionsData.reactions.length === 0) {
        setError("No valid load cases found on the server. Please add and save load cases first.");
        return;
      }
      const queryParams = new URLSearchParams({
        n_x: pileForm.n_x,
        s_x: pileForm.s_x,
        n_y: pileForm.n_y,
        s_y: pileForm.s_y,
        with_calculations: true,
        fc: form.fc,
        fy: form.fy,
        cover: form.cover,
        col_x_dim: form.col_x_dim,
        col_y_dim: form.col_y_dim,
        ecc_x: form.ecc_x,
        ecc_y: form.ecc_y,
        footing_thickness: form.footing_thickness,
        pile_embedment: form.pile_embedment,
        pile_overhang: form.pile_overhang,
        ground_elev: form.ground_elev,
        footing_top_elev: form.footing_top_elev,
        water_elev: form.water_elev,
        soil_weight: form.soil_weight,
        seal_thickness: form.seal_thickness
      }).toString();
      const response = await fetch(`http://localhost:8002/api/pile-coordinates?${queryParams}`);
      const data = await response.json();
      if (!data.coordinates || data.coordinates.length === 0) {
        setError("Failed to calculate pile forces. Please check your reactions and try again.");
        setPileForces(null);
        return;
      }
      setPileForces({
        coordinates: data.coordinates,
        footing_calculations: data.footing_calculations || null,
        shear_check: data.shear_check || null
      });
    } catch (err) {
      setError("Error calculating pile forces. Backend may be down.");
      setPileForces(null);
    }
  };

  // Button handler for advanced pile cap calculations
  const handleAdvancedDesign = async () => {
    if (!pileCoordinates || pileCoordinates.length === 0) {
      setError("Please generate pile coordinates first.");
      return;
    }
    // Prepare input for /api/pile-cap/design (must match backend PileCapInputs exactly)
    const advInputs = {
      bFtg: Number(pileForm.s_x) * (Number(pileForm.n_x) - 1) + Number(form.pile_overhang) * 2,
      LFtg: Number(pileForm.s_y) * (Number(pileForm.n_y) - 1) + Number(form.pile_overhang) * 2,
      hFtg: Number(form.footing_thickness) / 12,
      Pileembed: Number(form.pile_embedment),
      fc: Number(form.fc),
      fy: Number(form.fy),
      cover: Number(form.cover),
      bar_size_x: 1.0, // or from form if available
      bar_size_y: 1.0, // or from form if available
      My: 0.0, // or from form if available
      Mx: 0.0, // or from form if available
      Vu: 0.0, // or from form if available
      Npiles: Number(pileForm.n_x) * Number(pileForm.n_y),
      pile_coords: Array.isArray(pileCoordinates) ? pileCoordinates.map(p => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, Number(v)]))) : [],
      wtFtg: 0.0,
      Py: 0.0,
      MyFtg: 0.0,
      MySurcharge: 0.0,
      MuyPile: 0.0,
      gamma_conc: 0.15,
      gamma_soil: Number(form.soil_weight),
      G_elev: Number(form.ground_elev),
      F_elev: Number(form.footing_top_elev),
      W_elev: Number(form.water_elev),
      D_seal: Number(form.seal_thickness),
      col_x_dim: Number(form.col_x_dim),
      col_y_dim: Number(form.col_y_dim)
    };
    try {
      const advRes = await fetch('http://localhost:8002/api/pile-cap/design', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(advInputs)
      });
      const advData = await advRes.json();
      if (advRes.ok && !advData.error) {
        setAdvancedDesign(advData);
      } else {
        setAdvancedDesign(null);
        setError(advData.error || "Advanced pile cap calculation failed.");
      }
    } catch (err) {
      setAdvancedDesign(null);
      setError("Advanced pile cap calculation failed.");
    }
  };

  const handleReactionSave = (savedReactions) => {
    console.log('Reactions saved in parent component:', savedReactions);
    const hasValidLoadCases = savedReactions && savedReactions.some(
      r => r.load_case && r.load_case.trim() !== ''
    );
    
    if (hasValidLoadCases) {
      setLoadCaseSaved(true);
      console.log('Valid load cases detected, enabling force calculation');
    } else {
      setLoadCaseSaved(false);
      console.log('No valid load cases detected');
    }
  };

  return (
    <div className="App">
      {error && <div style={{color: 'red', fontWeight: 'bold', marginBottom: 10}}>{error}</div>}
      <h1>Pile Cap Design</h1>
      
      <div className="design-section">
        <h2>Design Inputs</h2>
        <form onSubmit={handleSubmit} className="design-input-table-form" style={{display: 'flex', justifyContent: 'flex-start', gap: 32}}>
          <table className="design-input-table" style={{width: '340px', minWidth: 260, marginRight: 24}}>
            <thead>
              <tr><th colSpan="3" style={{background:'#e0e0e0', color:'#234', fontWeight:700, fontSize:'1.1em'}}>Footing Data</th></tr>
              <tr>
                <th>Parameter</th>
                <th>Value</th>
                <th>Unit</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Concrete f'c</td>
                <td><input type="number" name="fc" value={form.fc} onChange={handleChange} step="any" /></td>
                <td>ksi</td>
              </tr>
              <tr>
                <td>Reinforcing Steel fy</td>
                <td><input type="number" name="fy" value={form.fy} onChange={handleChange} step="any" /></td>
                <td>ksi</td>
              </tr>
              <tr>
                <td>Reinforcing Cover</td>
                <td><input type="number" name="cover" value={form.cover} onChange={handleChange} step="any" /></td>
                <td>in</td>
              </tr>
              <tr>
                <td>Column x-dim. or Diameter</td>
                <td><input type="number" name="col_x_dim" value={form.col_x_dim} onChange={handleChange} step="any" /></td>
                <td>ft</td>
              </tr>
              <tr>
                <td>Column y-dim.</td>
                <td><input type="number" name="col_y_dim" value={form.col_y_dim} onChange={handleChange} step="any" /></td>
                <td>ft</td>
              </tr>
              <tr>
                <td>Column eccentric x-dir.</td>
                <td><input type="number" name="ecc_x" value={form.ecc_x} onChange={handleChange} step="any" /></td>
                <td>ft</td>
              </tr>
              <tr>
                <td>Column eccentric y-dir.</td>
                <td><input type="number" name="ecc_y" value={form.ecc_y} onChange={handleChange} step="any" /></td>
                <td>ft</td>
              </tr>
              <tr>
                <td>Footing thickness</td>
                <td><input type="number" name="footing_thickness" value={form.footing_thickness} onChange={handleChange} step="any" /></td>
                <td>in</td>
              </tr>
              <tr>
                <td>Pile Embedment</td>
                <td><input type="number" name="pile_embedment" value={form.pile_embedment} onChange={handleChange} step="any" /></td>
                <td>ft</td>
              </tr>
              <tr>
                <td>Pile Overhang</td>
                <td><input type="number" name="pile_overhang" value={form.pile_overhang} onChange={handleChange} step="any" /></td>
                <td>in</td>
              </tr>
              <tr>
                <td>Ground Elevation</td>
                <td><input type="number" name="ground_elev" value={form.ground_elev} onChange={handleChange} step="any" /></td>
                <td>ft</td>
              </tr>
              <tr>
                <td>Footing Top Elevation</td>
                <td><input type="number" name="footing_top_elev" value={form.footing_top_elev} onChange={handleChange} step="any" /></td>
                <td>ft</td>
              </tr>
              <tr>
                <td>Water Elevation</td>
                <td><input type="number" name="water_elev" value={form.water_elev} onChange={handleChange} step="any" /></td>
                <td>ft</td>
              </tr>
              <tr>
                <td>Soil Weight</td>
                <td><input type="number" name="soil_weight" value={form.soil_weight} onChange={handleChange} step="any" /></td>
                <td>kcf</td>
              </tr>
              <tr>
                <td>Seal Thickness</td>
                <td><input type="number" name="seal_thickness" value={form.seal_thickness} onChange={handleChange} step="any" /></td>
                <td>in</td>
              </tr>
            </tbody>
          </table>
          <table className="design-input-table" style={{width: '340px', minWidth: 260}}>
            <thead>
              <tr><th colSpan="3" style={{background:'#e0e0e0', color:'#234', fontWeight:700, fontSize:'1.1em'}}>Pile Data</th></tr>
              <tr>
                <th>Parameter</th>
                <th>Value</th>
                <th>Unit</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Number of Piles in X</td>
                <td><input type="number" name="n_x" value={pileForm.n_x} onChange={handlePileFormChange} min="1" step="1" /></td>
                <td></td>
              </tr>
              <tr>
                <td>Number of Piles in Y</td>
                <td><input type="number" name="n_y" value={pileForm.n_y} onChange={handlePileFormChange} min="1" step="1" /></td>
                <td></td>
              </tr>
              <tr>
                <td>Total Number of Piles</td>
                <td><input type="number" name="num_piles" value={pileForm.n_x * pileForm.n_y} readOnly tabIndex={-1} style={{background:'#f0f0f0'}} /></td>
                <td></td>
              </tr>
              <tr>
                <td>Pile Size</td>
                <td><input type="number" name="pile_size" value={form.pile_size || 15} onChange={handleChange} step="any" defaultValue={15} /></td>
                <td>in</td>
              </tr>
              <tr>
                <td>Max. Pile Driving Resistance</td>
                <td><input type="number" name="max_pile_driving_resistance" value={form.max_pile_driving_resistance || 225} onChange={handleChange} step="any" defaultValue={225} /></td>
                <td>kips</td>
              </tr>
              <tr>
                <td>Boring</td>
                <td><input type="text" name="boring" value={form.boring || 'P41-1'} onChange={e => setForm({ ...form, boring: e.target.value })} defaultValue={'P41-1'} /></td>
                <td></td>
              </tr>
              <tr>
                <td>Pile Tip Elevation</td>
                <td><input type="number" name="pile_tip_elevation" value={form.pile_tip_elevation || -8.4} onChange={handleChange} step="any" defaultValue={-8.4} /></td>
                <td>ft</td>
              </tr>
              <tr>
                <td>Nominal Pile Bearing Capacity</td>
                <td><input type="number" name="nominal_pile_bearing_capacity" value={form.nominal_pile_bearing_capacity || 225} onChange={handleChange} step="any" defaultValue={225} /></td>
                <td>kips</td>
              </tr>
              <tr>
                <td>Soil Ultimate Side Friction</td>
                <td><input type="number" name="soil_ultimate_side_friction" value={form.soil_ultimate_side_friction || 100} onChange={handleChange} step="any" defaultValue={100} /></td>
                <td>psf</td>
              </tr>
              <tr>
                <td>Comp. Reduction Factor, f</td>
                <td><input type="number" name="comp_reduction_factor" value={form.comp_reduction_factor || 0.75} onChange={handleChange} step="any" defaultValue={0.75} /></td>
                <td></td>
              </tr>
              <tr>
                <td>Uplift Reduction Factor, f</td>
                <td><input type="number" name="uplift_reduction_factor" value={form.uplift_reduction_factor || 0.6} onChange={handleChange} step="any" defaultValue={0.6} /></td>
                <td></td>
              </tr>
            </tbody>
          </table>
          <button type="submit" className="primary-button" style={{marginTop: 18, alignSelf: 'flex-start'}}>Calculate</button>
        </form>
        {result && (
          <div className="results">
            <h2>Results:</h2>
            <pre>{JSON.stringify(result, null, 2)}</pre>
          </div>
        )}
      </div>

      <div className="reactions-table-section">
        <ReactionTable onSave={handleReactionSave} />
        {loadCaseSaved && (
          <div className="status-success" style={{marginTop: 10, marginBottom: 10}}>
            <span className="status-icon">✓</span>
            Load combinations saved successfully
          </div>
        )}
      </div>

      <div className="pile-coordinates-section">
        <h2>Pile Layout Design</h2>
        <form onSubmit={handlePileCoordinatesSubmit} className="pile-form">
          <div className="form-row">
            <div className="form-group">
              <label>Number of piles in X direction (n_x):</label>
              <input
                type="number"
                name="n_x"
                value={pileForm.n_x}
                onChange={handlePileFormChange}
                min="1"
                step="1"
              />
            </div>
            <div className="form-group">
              <label>Spacing in X direction (s_x):</label>
              <input
                type="number"
                name="s_x"
                value={pileForm.s_x}
                onChange={handlePileFormChange}
                step="any"
                min="0.1"
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Number of piles in Y direction (n_y):</label>
              <input
                type="number"
                name="n_y"
                value={pileForm.n_y}
                onChange={handlePileFormChange}
                min="1"
                step="1"
              />
            </div>
            <div className="form-group">
              <label>Spacing in Y direction (s_y):</label>
              <input
                type="number"
                name="s_y"
                value={pileForm.s_y}
                onChange={handlePileFormChange}
                step="any"
                min="0.1"
              />
            </div>
          </div>
          <button type="submit" className="primary-button">Generate Pile Coordinates</button>
        </form>
        {pileCoordinates && (
          <div className="pile-results">
            <h2>Pile Coordinates and Layout:</h2>
            
            {/* Draw the pile layout first */}
            <div className="pile-drawing-container">
              <h3>Pile Layout Visualization</h3>
              <PileDrawing 
                coordinates={pileForces ? pileForces.coordinates : pileCoordinates}
                columnSize={{ colX: form.col_x_dim, colY: form.col_y_dim }}
                pileOverhang={form.pile_overhang}
                showForces={!!pileForces}
                advancedDesign={advancedDesign}
              />
            </div>

            {/* Legend and Instructions for Pile Table */}
            {Array.isArray(pileForces?.coordinates) && pileForces.coordinates.length > 0 && (
              <div style={{
                margin: '18px 0 8px 0',
                padding: '18px 20px',
                background: '#f3f7fb',
                border: '1.5px solid #c6daf7',
                borderRadius: 10,
                boxShadow: '0 1px 6px #bdd6fa33',
                maxWidth: 900,
                fontSize: 15,
                lineHeight: 1.6
              }}>
                <div style={{fontWeight: 700, fontSize: '1.12em', color: '#1c3a5a', marginBottom: 3}}>Pile Layout Legend &amp; Guidance</div>
                <ul style={{margin: '10px 0 0 22px', padding: 0, listStyle: 'disc'}}>
                  <li>
                    <span style={{color:'#d9534f',fontWeight:'bold'}}>Red Pmax</span> — Piles with <b>Pmax &gt; 100 kips</b> (high compression zone, check structural safety or layout)
                  </li>
                  <li>
                    <span style={{color:'#1976d2',fontWeight:'bold'}}>Blue Pmin</span> — Piles with <b>Pmin &lt; 0 kips</b> (tension zone, check for uplift or anchor requirements)
                  </li>
                  <li>
                    <span style={{color:'#654ea3',fontWeight:600}}>Load Case</span>: Shows which factored load governs <b>Pmax</b> or <b>Pmin</b> for each pile
                  </li>
                  <li>
                    <span style={{fontWeight:500}}>Components</span>: Decomposes pile load into <b>Axial</b>, <b>Mx</b>, and <b>My</b> moment effects
                  </li>
                  <li>
                    <span style={{fontWeight:500}}>Full Table:</span> View all governing and component values for every pile in the breakdown table below
                  </li>
                </ul>
                <div style={{marginTop:14, fontSize:13, color:'#345'}}>
                  <span style={{fontWeight:600, color:'#333'}}>Tips:</span> <br/>
                  – Hover over piles in the diagram for quick values.<br/>
                  – Use the table to identify piles with extreme tension or compression.<br/>
                  – Adjust pile count, spacing, or footing size if you see excessive pile loads.
                </div>
              </div>
            )}

            {/* Calculate Pile Forces Button: show as soon as pileCoordinates is available */}
            {pileCoordinates && (
              <div style={{margin: '16px 0'}}>
                <button
                  className="primary-button"
                  onClick={calculatePileForces}
                  disabled={!loadCaseSaved || !pileCoordinates}
                  type="button"
                >
                  Calculate Pile Forces (Pmax/Pmin)
                </button>
              </div>
            )}

            {/* Pile Forces Table (Detailed Pmax/Pmin breakdown) */}
            {Array.isArray(pileForces?.coordinates) && pileForces.coordinates.length > 0 && (
              <div className="pile-table" style={{marginTop: 8, marginBottom: 32}}>
                <h3>Pile Forces Table (Pmax/Pmin Details)</h3>
                <div className="table-wrapper" style={{overflowX: 'auto'}}>
                  <table>
                    <thead>
                      <tr>
                        <th>Pile #</th>
                        <th>X (ft)</th>
                        <th>Y (ft)</th>
                        <th>Pmax (k)</th>
                        <th>Max Load Case</th>
                        <th>Pmax Components</th>
                        <th>Pmin (k)</th>
                        <th>Min Load Case</th>
                        <th>Pmin Components</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pileForces.coordinates.slice(0, 200).map((pile, idx) => (
                        <tr key={idx}>
                          <td>{pile?.['No.'] ?? ''}</td>
                          <td>{pile?.['x (ft)'] ?? ''}</td>
                          <td>{pile?.['y (ft)'] ?? ''}</td>
                          <td className={pile?.['Pmax (k)'] > 100 ? 'extreme-high' : ''}>{pile?.['Pmax (k)'] ?? ''}</td>
                          <td className="load-case">{pile?.['Max Load Case'] ?? ''}</td>
                          <td style={{fontSize:'0.95em'}}>
                            {pile?.['Pmax Components'] ? `Axial: ${pile['Pmax Components'].axial}, Mx: ${pile['Pmax Components'].moment_x}, My: ${pile['Pmax Components'].moment_y}` : ''}
                          </td>
                          <td className={pile?.['Pmin (k)'] < 0 ? 'extreme-low' : ''}>{pile?.['Pmin (k)'] ?? ''}</td>
                          <td className="load-case">{pile?.['Min Load Case'] ?? ''}</td>
                          <td style={{fontSize:'0.95em'}}>
                            {pile?.['Pmin Components'] ? `Axial: ${pile['Pmin Components'].axial}, Mx: ${pile['Pmin Components'].moment_x}, My: ${pile['Pmin Components'].moment_y}` : ''}
                          </td>
                        </tr>
                      ))}
                      {pileForces.coordinates.length > 200 && (
                        <tr><td colSpan={9} style={{color:'#b00',fontWeight:600}}>Showing first 200 rows only (data truncated for performance)</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* --- Classic P values breakdown table for each pile --- */}
            {Array.isArray(pileForces?.coordinates) && pileForces.coordinates.length > 0 && (
              <div className="pile-pvalues-breakdown" style={{marginTop: 8, marginBottom: 32}}>
                <h3>Full Pile Load Breakdown (All Load Cases)</h3>
                <div style={{maxHeight: 400, overflowY: 'auto', background: '#f8fafc', borderRadius: 8, padding: 12, boxShadow: '0 1px 4px #0001'}}>
                  {pileForces.coordinates.slice(0, 200).map((pile, idx) => (
                    <div key={idx} style={{marginBottom: 24}}>
                      <div style={{fontWeight: 600, marginBottom: 4, color: '#234'}}>
                        Pile #{pile['No.']} (X: {pile['x (ft)']}, Y: {pile['y (ft)']})
                      </div>
                      <table style={{width: '100%', marginBottom: 4, background: '#fff', borderRadius: 4, boxShadow: '0 1px 2px #0001'}}>
                        <thead>
                          <tr style={{background:'#e0e0e0'}}>
                            <th>Load Case</th>
                            <th>P Value (k)</th>
                            <th>Axial</th>
                            <th>Mx</th>
                            <th>My</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(pile['P values'] || []).map((pv, j) => (
                            <tr key={j}>
                              <td>{pv.load_case}</td>
                              <td>{pv.value !== undefined ? pv.value.toFixed(2) : ''}</td>
                              <td>{pv.components ? pv.components.axial.toFixed(2) : ''}</td>
                              <td>{pv.components ? pv.components.moment_x.toFixed(2) : ''}</td>
                              <td>{pv.components ? pv.components.moment_y.toFixed(2) : ''}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                  {pileForces.coordinates.length > 200 && (
                    <div style={{color:'#b00',fontWeight:600}}>Showing first 200 piles only (data truncated for performance)</div>
                  )}
                </div>
              </div>
            )}
            {/* --- End Classic P values breakdown table --- */}
          </div>
        )}
      </div>

      {pileForces && (pileForces.footing_calculations || pileForces.shear_check) && (
        <div style={{marginTop: 32, display: 'flex', flexDirection: 'row', gap: 32, alignItems: 'flex-start'}}>
          {pileForces.footing_calculations && (
            <div className="footing-calculations-section" style={{background: '#f0f7fa', borderRadius: 8, padding: 18, boxShadow: '0 1px 4px #0001', maxWidth: 520, flex: 1}}>
              <h3 style={{marginBottom: 8}}>Step 3: Footing & Weight Calculations</h3>
              <table style={{width: '100%', marginBottom: 8}}>
                <tbody>
                  <tr><td>Footing Length</td><td style={{textAlign:'right'}}>{pileForces.footing_calculations?.footing_length ?? 'N/A'} ft</td></tr>
                  <tr><td>Footing Width</td><td style={{textAlign:'right'}}>{pileForces.footing_calculations?.footing_width ?? 'N/A'} ft</td></tr>
                  <tr><td>Effective Depth (d)</td><td style={{textAlign:'right'}}>{pileForces.footing_calculations?.footing_effective_depth ?? 'N/A'} ft</td></tr>
                  <tr><td>Shear Depth (d<sub>v</sub>)</td><td style={{textAlign:'right'}}>{pileForces.footing_calculations?.footing_shear_depth ?? 'N/A'} ft</td></tr>
                  <tr><td>Column Area</td><td style={{textAlign:'right'}}>{pileForces.footing_calculations?.column_gross_area ?? 'N/A'} ft²</td></tr>
                  <tr><td>Seal Weight</td><td style={{textAlign:'right'}}>{pileForces.footing_calculations?.footing_seal_weight ?? 'N/A'} kips</td></tr>
                  <tr><td>Soil Weight</td><td style={{textAlign:'right'}}>{pileForces.footing_calculations?.soil_weight_kips ?? 'N/A'} kips</td></tr>
                  <tr><td>Water Weight</td><td style={{textAlign:'right'}}>{pileForces.footing_calculations?.water_weight ?? 'N/A'} kips</td></tr>
                  <tr><td>Footing Thickness (D)</td><td style={{textAlign:'right'}}>{pileForces.footing_calculations?.D ?? 'N/A'} in</td></tr>
                  <tr><td>Seal Thickness</td><td style={{textAlign:'right'}}>{pileForces.footing_calculations?.seal_thickness ?? 'N/A'} in</td></tr>
                  <tr><td>Soil Unit Weight (γ)</td><td style={{textAlign:'right'}}>{pileForces.footing_calculations?.gamma_soil ?? 'N/A'} kcf</td></tr>
                  <tr><td>Bar Cover</td><td style={{textAlign:'right'}}>{pileForces.footing_calculations?.bar_cover ?? 'N/A'} in</td></tr>
                  <tr><td>Bottom Bar Size (Long)</td><td style={{textAlign:'right'}}>{pileForces.footing_calculations?.bottom_bar_size_long ?? 'N/A'} in</td></tr>
                  <tr><td>Bottom Bar Size (Trans)</td><td style={{textAlign:'right'}}>{pileForces.footing_calculations?.bottom_bar_size_trans ?? 'N/A'} in</td></tr>
                </tbody>
              </table>
              {/* Button to calculate advanced pile cap design, shown after footing calculations */}
              <div style={{marginTop: 16}}>
                <button 
                  className="secondary-button"
                  onClick={handleAdvancedDesign}
                  disabled={!pileCoordinates}
                >
                  Calculate Advanced Pile Cap Design
                </button>
              </div>
              {/* Advanced calculation results shown immediately after button, if available */}
              {advancedDesign && (
                <div className="advanced-pilecap-section" style={{marginTop: 32, background: '#f7f7fa', borderRadius: 8, padding: 24, boxShadow: '0 1px 4px #0001', maxWidth: 900, marginLeft: 'auto', marginRight: 'auto'}}>
                  <h2 style={{marginBottom: 16, color: '#234'}}>Step 5: Advanced Pile Cap Calculations</h2>
                  <table style={{width: '100%', marginBottom: 8, background: '#fff', borderRadius: 8, boxShadow: '0 1px 4px #0001'}}>
                    <tbody>
                      <tr style={{background:'#e0e0e0'}}><th colSpan={3} style={{textAlign:'left', fontWeight:700, fontSize:'1.1em'}}>Calculation Step</th><th style={{textAlign:'right'}}>Value</th><th style={{textAlign:'left'}}>Formula</th></tr>
                      <tr><td colSpan={3}>Effective Depth (d)</td><td style={{textAlign:'right'}}>{advancedDesign.effective_depth_in?.toFixed(2) ?? 'N/A'} in</td><td style={{fontFamily:'monospace', color:'#555'}}>{advancedDesign.formulas?.effective_depth}</td></tr>
                      <tr><td colSpan={3}>Shear Depth (d<sub>v</sub>)</td><td style={{textAlign:'right'}}>{advancedDesign.shear_depth_in?.toFixed(2) ?? 'N/A'} in</td><td style={{fontFamily:'monospace', color:'#555'}}>{advancedDesign.formulas?.shear_depth}</td></tr>
                      <tr><td colSpan={3}>Required Area of Steel (A<sub>s</sub>)</td><td style={{textAlign:'right'}}>{advancedDesign.required_As_in2?.toFixed(2) ?? 'N/A'} in²</td><td style={{fontFamily:'monospace', color:'#555'}}>{advancedDesign.formulas?.required_As}</td></tr>
                      <tr><td colSpan={3}>Moment Capacity (M<sub>n</sub>)</td><td style={{textAlign:'right'}}>{advancedDesign.moment_capacity_kipft?.toFixed(2) ?? 'N/A'} kip-ft</td><td style={{fontFamily:'monospace', color:'#555'}}>{advancedDesign.formulas?.moment_capacity}</td></tr>
                      <tr><td colSpan={3}>One-Way Shear Capacity (ϕV<sub>n</sub>)</td><td style={{textAlign:'right'}}>{advancedDesign.shear_capacity_kip?.toFixed(2) ?? 'N/A'} k</td><td style={{fontFamily:'monospace', color:'#555'}}>{advancedDesign.formulas?.one_way_shear}</td></tr>
                      <tr><td colSpan={3}>Shear Safe?</td><td style={{textAlign:'right'}}>{advancedDesign.shear_safe ? 'Yes' : 'No'}</td><td></td></tr>
                      <tr><td colSpan={3}>Strength I Moment (My<sub>Strength</sub>)</td><td style={{textAlign:'right'}}>{advancedDesign.My_Strength_I?.toFixed(2) ?? 'N/A'}</td><td style={{fontFamily:'monospace', color:'#555'}}>{advancedDesign.formulas?.strength_service_moments}</td></tr>
                      <tr><td colSpan={3}>Service I Moment (My<sub>Service</sub>)</td><td style={{textAlign:'right'}}>{advancedDesign.My_Service_I?.toFixed(2) ?? 'N/A'}</td><td></td></tr>
                      <tr><td colSpan={3}>Soil Weight</td><td style={{textAlign:'right'}}>{advancedDesign.soil_weight?.toFixed(2) ?? 'N/A'} kips</td><td style={{fontFamily:'monospace', color:'#555'}}>{advancedDesign.formulas?.soil_weight}</td></tr>
                      <tr><td colSpan={3}>Water Weight</td><td style={{textAlign:'right'}}>{advancedDesign.water_weight?.toFixed(2) ?? 'N/A'} kips</td><td style={{fontFamily:'monospace', color:'#555'}}>{advancedDesign.formulas?.water_weight}</td></tr>
                      <tr><td colSpan={3}>Min Bar Spacing</td><td style={{textAlign:'right'}}>{advancedDesign.reinforcement_spacing_limits?.min_spacing_in?.toFixed(2) ?? 'N/A'} in</td><td style={{fontFamily:'monospace', color:'#555'}}>{advancedDesign.formulas?.crack_control_spacing}</td></tr>
                      <tr><td colSpan={3}>Max Bar Spacing</td><td style={{textAlign:'right'}}>{advancedDesign.reinforcement_spacing_limits?.max_spacing_in?.toFixed(2) ?? 'N/A'} in</td><td></td></tr>
                      <tr><td colSpan={3}>Punching Shear Capacity (ϕV<sub>punch</sub>)</td><td style={{textAlign:'right'}}>{advancedDesign.punching_shear_capacity_kip?.toFixed(2) ?? 'N/A'} k</td><td style={{fontFamily:'monospace', color:'#555'}}>{advancedDesign.formulas?.punching_shear}</td></tr>
                      <tr><td colSpan={3}>Punching Shear Safe?</td><td style={{textAlign:'right'}}>{advancedDesign.punching_safe ? 'Yes' : 'No'}</td><td></td></tr>
                      <tr><td colSpan={3} style={{fontWeight:700}}>Compliant?</td><td style={{textAlign:'right', fontWeight:700}}>{advancedDesign.compliance ? 'Yes' : 'No'}</td><td></td></tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
          {pileForces.shear_check && (
            <div className="shear-check-section" style={{background: '#f8f4f0', borderRadius: 8, padding: 18, boxShadow: '0 1px 4px #0001', maxWidth: 520, flex: 1}}>
              <h3 style={{marginBottom: 8}}>Step 4: Shear Check</h3>
              <table style={{width: '100%', marginBottom: 8}}>
                <tbody>
                  <tr>
                    <td style={{fontWeight: 500}}>Shear Capacity Formula:</td>
                    <td colSpan={2}>
                      <span style={{marginLeft: 8, fontFamily: 'serif', fontWeight: 600, fontSize: '1.1em'}}>
                        V<sub>c</sub> = 0.0316 β √f'<sub>c</sub> b d<sub>v</sub>
                      </span>
                      <span style={{marginLeft: 8, color: '#888', fontSize: 13}}>
                        ({pileForces.shear_check?.aashto_ref ?? ''})
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td style={{fontWeight: 500}}>Nominal Shear Capacity, ϕV<sub>c</sub> =</td>
                    <td style={{textAlign: 'right'}}>{pileForces.shear_check?.nominal_shear_capacity_phi_vc ?? 'N/A'} k</td>
                  </tr>
                  <tr>
                    <td style={{fontWeight: 500}}>Shear Capacity/Demand =</td>
                    <td style={{textAlign: 'right'}}>{pileForces.shear_check?.shear_capacity_demand ?? 'N/A'}</td>
                  </tr>
                </tbody>
              </table>
              <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
                <span style={{background: pileForces.shear_check?.status === '< GOOD' ? '#dff0d8' : '#fbeee0', color: pileForces.shear_check?.status === '< GOOD' ? '#3c763d' : '#b94a48', fontWeight: 700, padding: '4px 16px', borderRadius: 4, border: '1px solid #ccc'}}>{pileForces.shear_check?.status ?? ''}</span>
                <span style={{fontSize: 13, color: '#888'}}>
                  ({pileForces.shear_check?.status === '< GOOD' ? 'OK' : 'Check design'})
                </span>
              </div>
            </div>
          )}
        </div>
      )}
      {/* --- Advanced Pile Cap Calculations Section --- */}
      {advancedDesign && (
        <div className="advanced-pilecap-section" style={{marginTop: 32, background: '#f7f7fa', borderRadius: 8, padding: 24, boxShadow: '0 1px 4px #0001', maxWidth: 900, marginLeft: 'auto', marginRight: 'auto'}}>
          <h2 style={{marginBottom: 16, color: '#234'}}>Step 5: Advanced Pile Cap Calculations</h2>
          <table style={{width: '100%', marginBottom: 8, background: '#fff', borderRadius: 8, boxShadow: '0 1px 4px #0001'}}>
            <tbody>
              <tr style={{background:'#e0e0e0'}}><th colSpan={3} style={{textAlign:'left', fontWeight:700, fontSize:'1.1em'}}>Calculation Step</th><th style={{textAlign:'right'}}>Value</th><th style={{textAlign:'left'}}>Formula</th></tr>
              <tr><td colSpan={3}>Effective Depth (d)</td><td style={{textAlign:'right'}}>{advancedDesign.effective_depth_in?.toFixed(2) ?? 'N/A'} in</td><td style={{fontFamily:'monospace', color:'#555'}}>{advancedDesign.formulas?.effective_depth}</td></tr>
              <tr><td colSpan={3}>Shear Depth (d<sub>v</sub>)</td><td style={{textAlign:'right'}}>{advancedDesign.shear_depth_in?.toFixed(2) ?? 'N/A'} in</td><td style={{fontFamily:'monospace', color:'#555'}}>{advancedDesign.formulas?.shear_depth}</td></tr>
              <tr><td colSpan={3}>Required Area of Steel (A<sub>s</sub>)</td><td style={{textAlign:'right'}}>{advancedDesign.required_As_in2?.toFixed(2) ?? 'N/A'} in²</td><td style={{fontFamily:'monospace', color:'#555'}}>{advancedDesign.formulas?.required_As}</td></tr>
              <tr><td colSpan={3}>Moment Capacity (M<sub>n</sub>)</td><td style={{textAlign:'right'}}>{advancedDesign.moment_capacity_kipft?.toFixed(2) ?? 'N/A'} kip-ft</td><td style={{fontFamily:'monospace', color:'#555'}}>{advancedDesign.formulas?.moment_capacity}</td></tr>
              <tr><td colSpan={3}>One-Way Shear Capacity (ϕV<sub>n</sub>)</td><td style={{textAlign:'right'}}>{advancedDesign.shear_capacity_kip?.toFixed(2) ?? 'N/A'} k</td><td style={{fontFamily:'monospace', color:'#555'}}>{advancedDesign.formulas?.one_way_shear}</td></tr>
              <tr><td colSpan={3}>Shear Safe?</td><td style={{textAlign:'right'}}>{advancedDesign.shear_safe ? 'Yes' : 'No'}</td><td></td></tr>
              <tr><td colSpan={3}>Strength I Moment (My<sub>Strength</sub>)</td><td style={{textAlign:'right'}}>{advancedDesign.My_Strength_I?.toFixed(2) ?? 'N/A'}</td><td style={{fontFamily:'monospace', color:'#555'}}>{advancedDesign.formulas?.strength_service_moments}</td></tr>
              <tr><td colSpan={3}>Service I Moment (My<sub>Service</sub>)</td><td style={{textAlign:'right'}}>{advancedDesign.My_Service_I?.toFixed(2) ?? 'N/A'}</td><td></td></tr>
              <tr><td colSpan={3}>Soil Weight</td><td style={{textAlign:'right'}}>{advancedDesign.soil_weight?.toFixed(2) ?? 'N/A'} kips</td><td style={{fontFamily:'monospace', color:'#555'}}>{advancedDesign.formulas?.soil_weight}</td></tr>
              <tr><td colSpan={3}>Water Weight</td><td style={{textAlign:'right'}}>{advancedDesign.water_weight?.toFixed(2) ?? 'N/A'} kips</td><td style={{fontFamily:'monospace', color:'#555'}}>{advancedDesign.formulas?.water_weight}</td></tr>
              <tr><td colSpan={3}>Min Bar Spacing</td><td style={{textAlign:'right'}}>{advancedDesign.reinforcement_spacing_limits?.min_spacing_in?.toFixed(2) ?? 'N/A'} in</td><td style={{fontFamily:'monospace', color:'#555'}}>{advancedDesign.formulas?.crack_control_spacing}</td></tr>
              <tr><td colSpan={3}>Max Bar Spacing</td><td style={{textAlign:'right'}}>{advancedDesign.reinforcement_spacing_limits?.max_spacing_in?.toFixed(2) ?? 'N/A'} in</td><td></td></tr>
              <tr><td colSpan={3}>Punching Shear Capacity (ϕV<sub>punch</sub>)</td><td style={{textAlign:'right'}}>{advancedDesign.punching_shear_capacity_kip?.toFixed(2) ?? 'N/A'} k</td><td style={{fontFamily:'monospace', color:'#555'}}>{advancedDesign.formulas?.punching_shear}</td></tr>
              <tr><td colSpan={3}>Punching Shear Safe?</td><td style={{textAlign:'right'}}>{advancedDesign.punching_safe ? 'Yes' : 'No'}</td><td></td></tr>
              <tr><td colSpan={3} style={{fontWeight:700}}>Compliant?</td><td style={{textAlign:'right', fontWeight:700}}>{advancedDesign.compliance ? 'Yes' : 'No'}</td><td></td></tr>
            </tbody>
          </table>
        </div>
      )}
      {/* --- End Advanced Pile Cap Calculations Section --- */}

    </div>
  );
}

export default App;
