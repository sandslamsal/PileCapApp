# backend/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import math

app = FastAPI()

# Fix: Allow all origins for local dev and ensure CORS is set before any routes
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For local dev, allow all. Change to specific origins for prod.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic input model for the form data
class DesignInputs(BaseModel):
    fc: float
    fy: float
    cover: float
    col_x_dim: float
    col_y_dim: float
    ecc_x: float
    ecc_y: float
    footing_thickness: float
    pile_embedment: float
    pile_overhang: float
    ground_elev: float
    footing_top_elev: float
    water_elev: float
    soil_weight: float
    seal_thickness: float
    pile_size: Optional[float] = 15
    max_pile_driving_resistance: Optional[float] = 225
    boring: Optional[str] = "P41-1"
    pile_tip_elevation: Optional[float] = -8.4
    nominal_pile_bearing_capacity: Optional[float] = 225
    soil_ultimate_side_friction: Optional[float] = 100
    comp_reduction_factor: Optional[float] = 0.75
    uplift_reduction_factor: Optional[float] = 0.6

# Model for a single reaction case
class ReactionCase(BaseModel):
    load_case: str
    dc_factor: Optional[float] = 1.0
    fx: float
    fy: float
    fz: float
    mx: float
    my: float

# Model for reaction table data
class ReactionTableData(BaseModel):
    reactions: List[ReactionCase]

# Advanced pile cap design input model
class PileCapInputs(BaseModel):
    bFtg: float
    LFtg: float
    hFtg: float
    Pileembed: float
    fc: float
    fy: float
    cover: float
    bar_size_x: Optional[float] = 1.0
    bar_size_y: Optional[float] = 1.0
    My: Optional[float] = 0.0
    Mx: Optional[float] = 0.0
    Vu: Optional[float] = 0.0
    Npiles: int
    pile_coords: List[dict]
    wtFtg: Optional[float] = 0.0
    Py: Optional[float] = 0.0
    MyFtg: Optional[float] = 0.0
    MySurcharge: Optional[float] = 0.0
    MuyPile: Optional[float] = 0.0
    gamma_conc: Optional[float] = 0.15
    gamma_soil: float
    G_elev: float
    F_elev: float
    W_elev: float
    D_seal: float
    col_x_dim: float
    col_y_dim: float

@app.post("/api/calculate")
def calculate(inputs: DesignInputs):
    result = {
        "gross_area": (inputs.col_x_dim + inputs.pile_overhang * 2) * (inputs.col_y_dim + inputs.pile_overhang * 2),
        "depth_to_tip": inputs.footing_top_elev - inputs.ground_elev + inputs.pile_embedment
    }

    # Generate pile layout based on user inputs (use column and overhang dims for grid size and spacing)
    # Example logic: estimate n_x, n_y, s_x, s_y from input dimensions
    n_x = max(2, int((inputs.col_x_dim + 2 * inputs.pile_overhang) // 5))  # at least 2 piles
    n_y = max(2, int((inputs.col_y_dim + 2 * inputs.pile_overhang) // 5))
    s_x = 5.0  # default spacing, could be parameterized
    s_y = 5.0
    coords = generate_pile_coordinates(n_x, s_x, n_y, s_y)
    pile_forces = calculate_pile_forces(coords, latest_reactions or DEFAULT_LOAD_CASES, inputs)

    return {
        "inputs": inputs.model_dump(),
        "results": result,
        "pile_coordinates": coords,  # raw coordinates for layout
        "pile_forces": pile_forces    # full calculation output for each pile
    }

def generate_pile_coordinates(n_x, s_x, n_y, s_y):
    all_coords = []
    pile_number = 1
    x_origin = -(n_x - 1) * s_x / 2
    y_origin = -(n_y - 1) * s_y / 2
    for i in range(n_x):
        for j in range(n_y):
            x = round(x_origin + i * s_x, 2)
            y = round(y_origin + j * s_y, 2)
            all_coords.append({"No.": pile_number, "x (ft)": x, "y (ft)": y})
            pile_number += 1
    return all_coords

# Global variable to store the latest reaction data
# In a production app, you'd use a database instead
latest_reactions = []

@app.post("/api/reactions")
async def save_reactions(data: ReactionTableData):
    global latest_reactions
    
    # Remove any empty reactions (no load case)
    valid_reactions = [r for r in data.reactions if r.load_case and r.load_case.strip()]
    
    print(f"Saving {len(valid_reactions)} valid reactions from {len(data.reactions)} total")
    for idx, reaction in enumerate(valid_reactions):
        print(f"Reaction {idx+1}: Load Case={reaction.load_case}, Fz={reaction.fz}, Mx={reaction.mx}, My={reaction.my}")
    
    latest_reactions = [r.model_dump() for r in valid_reactions]
    return {"message": f"Saved {len(valid_reactions)} reactions successfully"}

DEFAULT_LOAD_CASES = [
    {"load_case": "Fx Minimum", "dc_factor": 1.00, "fx": -131, "fy": 235, "fz": 7562, "mx": 9864, "my": -4939},
    {"load_case": "Fy Maximum", "dc_factor": 1.00, "fx": -119, "fy": 0, "fz": 8967, "mx": 18290, "my": 6407},
    {"load_case": "Fy Minimum", "dc_factor": 1.00, "fx": -33, "fy": 211, "fz": 5183, "mx": -15270, "my": -1417},
    {"load_case": "Fz Maximum", "dc_factor": 1.00, "fx": 227, "fy": 132, "fz": 7562, "mx": 5331, "my": 8415},
    {"load_case": "Fz Minimum", "dc_factor": 1.00, "fx": -228, "fy": 132, "fz": 7562, "mx": 5331, "my": -8447},
    {"load_case": "Mx Maximum", "dc_factor": 1.00, "fx": -119, "fy": 0, "fz": 8646, "mx": 10150, "my": -13910},
    {"load_case": "Mx Minimum", "dc_factor": 1.00, "fx": 118, "fy": 0, "fz": 8646, "mx": 10150, "my": 13880},
    {"load_case": "My Maximum", "dc_factor": 1.00, "fx": -228, "fy": 132, "fz": 7562, "mx": 5331, "my": -8447},
    {"load_case": "My Minimum", "dc_factor": 1.00, "fx": 227, "fy": 132, "fz": 7562, "mx": 5331, "my": 8415},
    {"load_case": "Mz Maximum", "dc_factor": 1.00, "fx": -89, "fy": 0, "fz": 8481, "mx": 25740, "my": 4669},
    {"load_case": "Mz Minimum", "dc_factor": 1.00, "fx": -89, "fy": 0, "fz": 6363, "mx": -25690, "my": 4669},
]

@app.get("/api/reactions")
async def get_reactions():
    global latest_reactions
    if not latest_reactions:
        latest_reactions = DEFAULT_LOAD_CASES  # Use default load cases if none are saved
    print(f"Returning {len(latest_reactions)} saved reactions")
    return {"reactions": latest_reactions}

# Function to calculate Pmax and Pmin for each pile
def calculate_pile_forces(coordinates, reactions, design_inputs):
    """
    Calculate Pmax and Pmin for each pile based on reactions and design inputs.
    """
    # Ensure each reaction is a dict with expected keys
    normalized_reactions = [
        r if isinstance(r, dict) else r.dict()
        for r in reactions
    ]
    if not normalized_reactions or not coordinates:
        return coordinates
    
    # Extract design input values needed for calculations
    footing_thickness = design_inputs.footing_thickness
    pile_diameter = 12.0  # Assuming 12 inches or 1 ft diameter, adjust as needed
    
    # Calculate weights
    area_of_footing = (design_inputs.col_x_dim + design_inputs.pile_overhang * 2) * (design_inputs.col_y_dim + design_inputs.pile_overhang * 2)
    wt_foot = 0.150 * area_of_footing * design_inputs.footing_thickness  # 0.150 kcf for concrete
    
    water_depth = max(0, design_inputs.footing_top_elev - design_inputs.water_elev)
    soil_depth = max(0, design_inputs.ground_elev - design_inputs.footing_top_elev - design_inputs.footing_thickness)
    
    wt_water = 0.0624 * area_of_footing * water_depth  # 0.0624 kcf for water
    wt_soil = design_inputs.soil_weight * area_of_footing * soil_depth
    
    # Calculate centroids
    # Pile group centroid
    pile_center_x = sum(p["x (ft)"] for p in coordinates) / len(coordinates)
    pile_center_y = sum(p["y (ft)"] for p in coordinates) / len(coordinates)
    
    # Column centroid - assume at the origin (0,0) unless specified otherwise
    col_center_x = 0 + design_inputs.ecc_x  # Include column eccentricity
    col_center_y = 0 + design_inputs.ecc_y  # Include column eccentricity
    
    # Footing centroid - same as pile group centroid for a balanced design
    footing_center_x = pile_center_x
    footing_center_y = pile_center_y
    
    # Calculate moments of inertia for pile group
    ix = sum((p["x (ft)"] - pile_center_x) ** 2 for p in coordinates)
    iy = sum((p["y (ft)"] - pile_center_y) ** 2 for p in coordinates)
    
    n_piles = len(coordinates)
    
    # For each pile, calculate and store Pmax and Pmin for each load case
    for pile in coordinates:
        pile_x = pile["x (ft)"]
        pile_y = pile["y (ft)"]
        
        # Initialize lists to store P values for each load case
        p_values = []
        
        for reaction in normalized_reactions:
            # Step 1: Calculate Fz_max using the provided formula
            if reaction['dc_factor'] <= 1:
                soil_weight_factor = wt_soil
            else:
                soil_weight_factor = wt_soil * 1.3/1.25
                
            fz_max = reaction['fz'] + (wt_foot + soil_weight_factor - wt_water) * reaction['dc_factor']
            
            # Step 2: Calculate Mx_max using the provided formula
            if reaction['dc_factor'] <= 1:
                weight_factor = (wt_foot - wt_water + wt_soil)
            else:
                weight_factor = (wt_foot - wt_water + wt_soil * 1.35/1.25)
            
            mx_max = (reaction['mx'] - 
                     reaction['fy'] * (footing_thickness - pile_diameter/12) + 
                     reaction['fz'] * (col_center_y - pile_center_y) + 
                     weight_factor * reaction['dc_factor'] * (footing_center_y - pile_center_y))
            
            # Step 3: Calculate My_max using the provided formula
            my_max = (reaction['my'] + 
                     reaction['fx'] * (footing_thickness - pile_diameter/12) + 
                     reaction['fz'] * (pile_center_x - col_center_x) + 
                     weight_factor * reaction['dc_factor'] * (pile_center_x - footing_center_x))
            
            # Step 4: Calculate pile force using the general formula
            p_axial = fz_max / n_piles
            p_mx = mx_max * (pile_y - pile_center_y) / iy if iy != 0 else 0
            p_my = my_max * (pile_x - pile_center_x) / ix if ix != 0 else 0
            
            p_value = p_axial + p_mx + p_my
            p_values.append({
                "load_case": reaction['load_case'],
                "value": p_value,
                "components": {
                    "axial": p_axial,
                    "moment_x": p_mx,
                    "moment_y": p_my
                }
            })
        # Add all P values for this pile for frontend breakdown
        pile["P values"] = p_values
        if p_values:
            # Find max and min values and their corresponding load cases
            max_p = max(p_values, key=lambda x: x["value"])
            min_p = min(p_values, key=lambda x: x["value"])
            
            pile["Pmax (k)"] = round(max_p["value"], 2)
            pile["Pmin (k)"] = round(min_p["value"], 2)
            pile["Max Load Case"] = max_p["load_case"]
            pile["Min Load Case"] = min_p["load_case"]
            
            # Store components for advanced analysis
            pile["Pmax Components"] = {
                "axial": round(max_p["components"]["axial"], 2),
                "moment_x": round(max_p["components"]["moment_x"], 2),
                "moment_y": round(max_p["components"]["moment_y"], 2)
            }
            pile["Pmin Components"] = {
                "axial": round(min_p["components"]["axial"], 2),
                "moment_x": round(min_p["components"]["moment_x"], 2),
                "moment_y": round(min_p["components"]["moment_y"], 2)
            }
        else:
            pile["Pmax (k)"] = 0
            pile["Pmin (k)"] = 0
            pile["Max Load Case"] = "N/A"
            pile["Min Load Case"] = "N/A"
            pile["Pmax Components"] = {"axial": 0, "moment_x": 0, "moment_y": 0}
            pile["Pmin Components"] = {"axial": 0, "moment_x": 0, "moment_y": 0}
    
    return coordinates

@app.get("/api/pile-coordinates")
async def get_pile_coords(
    n_x: int,
    s_x: float,
    n_y: int,
    s_y: float,
    with_calculations: bool = False,
    fc: float = 5.5,
    fy: float = 60,
    cover: float = 4.5,
    col_x_dim: float = 9,
    col_y_dim: float = 16,
    ecc_x: float = 0,
    ecc_y: float = 0,
    footing_thickness: float = 9,
    pile_embedment: float = 12,
    pile_overhang: float = 1.625,
    ground_elev: float = 73.4,
    footing_top_elev: float = 70.4,
    water_elev: float = 68,
    soil_weight: float = 0.115,
    seal_thickness: float = 0,
    pile_cap_length: float = 40,
    pile_cap_width: float = 24,
    D: float = 9,
    pile_diameter: float = 1,
    bar_cover: float = 4.5,
    bottom_bar_size_long: float = 1,
    bottom_bar_size_trans: float = 1,
    gamma_soil: float = 0.115
):
    try:
        if n_x < 1 or n_y < 1 or s_x <= 0 or s_y <= 0:
            return {
                "coordinates": [],
                "footing_calculations": None,
                "shear_check": None,
                "error": "Invalid input: number of piles and spacing must be positive."
            }
        coords = generate_pile_coordinates(n_x, s_x, n_y, s_y)
        # Validate coordinate generation
        if not coords:
            return {
                "coordinates": [],
                "footing_calculations": None,
                "shear_check": None,
                "error": "Failed to generate pile coordinates. Please check your input values for grid size and spacing."
            }
        print(f"Generated {len(coords)} pile coordinates")
        shear_check = None
        footing_calculations = None
        # Always perform calculations and include details in response
        if latest_reactions:
            load_cases = [r['load_case'] for r in latest_reactions]
            print(f"Using load cases: {load_cases}")
            class_inputs = DesignInputs(
                fc=fc, fy=fy, cover=cover, col_x_dim=col_x_dim, col_y_dim=col_y_dim, 
                ecc_x=ecc_x, ecc_y=ecc_y, footing_thickness=footing_thickness, pile_embedment=pile_embedment, 
                pile_overhang=pile_overhang, ground_elev=ground_elev, footing_top_elev=footing_top_elev,
                water_elev=water_elev, soil_weight=soil_weight, seal_thickness=seal_thickness
            )
            coords = calculate_pile_forces(coords, latest_reactions, class_inputs)

            # --- Footing/Weight Calculations (Separate Section) ---
            footing_length = pile_cap_length
            footing_width = pile_cap_width
            footing_effective_depth = (D - pile_diameter) / 12 - bar_cover / 12 - max(bottom_bar_size_long, bottom_bar_size_trans) / 12
            footing_shear_depth = 0.9 * footing_effective_depth
            column_effective_long_dim = col_x_dim
            column_effective_trans_dim = col_y_dim
            column_gross_area = column_effective_long_dim * column_effective_trans_dim
            footing_seal_weight = footing_length * footing_width * 0.15 * D + footing_length * footing_width * seal_thickness * 0.15
            soil_weight_kips = (footing_length * footing_width - column_gross_area) * gamma_soil * max(ground_elev - footing_top_elev, 0)
            water_weight = max(min(water_elev, max(ground_elev, footing_top_elev)) - (footing_top_elev - D - seal_thickness), 0) * 0.0624 * footing_length * footing_width

            footing_calculations = {
                "footing_length": footing_length,
                "footing_width": footing_width,
                "footing_effective_depth": round(footing_effective_depth, 3),
                "footing_shear_depth": round(footing_shear_depth, 3),
                "column_effective_long_dim": column_effective_long_dim,
                "column_effective_trans_dim": column_effective_trans_dim,
                "column_gross_area": round(column_gross_area, 2),
                "footing_seal_weight": round(footing_seal_weight, 2),
                "soil_weight_kips": round(soil_weight_kips, 2),
                "water_weight": round(water_weight, 2),
                "D": D,
                "seal_thickness": seal_thickness,
                "gamma_soil": gamma_soil,
                "bar_cover": bar_cover,
                "bottom_bar_size_long": bottom_bar_size_long,
                "bottom_bar_size_trans": bottom_bar_size_trans
            }

            # --- One Way Shear Check (Longitudinal Axis) ---
            max_vu = 0.0
            if coords and any("Pmax (k)" in p for p in coords):
                max_vu = max([p.get("Pmax (k)", 0.0) for p in coords])
            print(f"Max Vu (Ultimate Shear): {max_vu}")
            beta = 1.0
            phi = 0.9
            b = footing_length * 12  # Use calculated footing length
            dv = footing_shear_depth * 12  # Use calculated shear depth in inches
            fc_psi = fc * 1000
            sqrt_fc = fc_psi ** 0.5
            phi_vc = phi * 0.0316 * beta * sqrt_fc * b * dv / 1000
            print(f"Nominal Shear Capacity (phiVc): {phi_vc}")
            shear_capacity_demand = phi_vc / max_vu if max_vu > 0 else float('inf')
            shear_status = "< GOOD" if shear_capacity_demand > 1 else "< NG"
            print(f"Shear Capacity/Demand: {shear_capacity_demand}, Status: {shear_status}")
            shear_check = {
                "title": "One Way Shear - Longitudinal Axis",
                "equation": r"V_c = 0.0316 \\beta \\sqrt{f'_c} b d_v",
                "aashto_ref": "AASHTO 5.8.3.3",
                "max_ultimate_shear_vu": round(max_vu, 2),
                "nominal_shear_capacity_phi_vc": round(phi_vc, 2),
                "shear_capacity_demand": round(shear_capacity_demand, 2),
                "status": shear_status
            }
        else:
            print("No reactions data available - cannot calculate forces")
        # Always return all three keys, even if some are None
        response_data = {"coordinates": coords, "footing_calculations": footing_calculations, "shear_check": shear_check}
        
        # Add advanced analysis if requested and calculations were performed
        if with_calculations and coords and latest_reactions:
            try:
                # Create design inputs for advanced analysis
                design_inputs = DesignInputs(
                    fc=fc, fy=fy, cover=cover, col_x_dim=col_x_dim, col_y_dim=col_y_dim,
                    ecc_x=ecc_x, ecc_y=ecc_y, footing_thickness=footing_thickness, 
                    pile_embedment=pile_embedment, pile_overhang=pile_overhang,
                    ground_elev=ground_elev, footing_top_elev=footing_top_elev, 
                    water_elev=water_elev, soil_weight=soil_weight, seal_thickness=seal_thickness,
                    pile_size=15  # Default value
                )
                
                # Prepare pile forces data
                pile_forces = [
                    {
                        "No.": pile["No."],
                        "x (ft)": pile["x (ft)"],
                        "y (ft)": pile["y (ft)"],
                        "Pmax (k)": pile.get("Pmax (k)", 0),
                        "Pmin (k)": pile.get("Pmin (k)", 0)
                    }
                    for pile in coords
                ]
                
                # Footing dimensions for advanced analysis
                footing_dimensions = {
                    "footing_length": pile_cap_length,
                    "footing_width": pile_cap_width,
                    "footing_area": pile_cap_length * pile_cap_width
                }
                
                # Run advanced analyses
                flexural_results = flexural_moment_check(coords, pile_forces, design_inputs)
                if flexural_results:
                    response_data["flexural_analysis"] = flexural_results
                
                # Calculate reinforcement if flexural analysis succeeded
                if flexural_results and footing_calculations:
                    reinforcement_results = calculate_reinforcement_requirements(
                        flexural_results, design_inputs, footing_dimensions
                    )
                    if reinforcement_results:
                        response_data["reinforcement_design"] = reinforcement_results
                
                # Advanced shear analysis
                advanced_shear_results = advanced_shear_analysis(coords, pile_forces, design_inputs)
                if advanced_shear_results:
                    response_data["advanced_shear_analysis"] = advanced_shear_results
                    
            except Exception as e:
                print(f"Error in advanced analysis: {e}")
                # Don't fail the whole request if advanced analysis fails
                pass
        
        return response_data
    except Exception as e:
        print(f"Error in /api/pile-coordinates: {e}")
        # Always return all three keys, even if error
        return {"coordinates": [], "footing_calculations": None, "shear_check": None, "error": str(e)}

# Advanced analysis functions from your notebook

def flexural_moment_check(pile_coordinates, pile_forces, design_inputs):
    """
    Advanced flexural moment check analysis
    """
    try:
        # Calculate pile group centroid
        pile_center_x = sum(p["x (ft)"] for p in pile_coordinates) / len(pile_coordinates)
        pile_center_y = sum(p["y (ft)"] for p in pile_coordinates) / len(pile_coordinates)
        
        # Footing dimensions
        footing_x_ft = design_inputs.col_x_dim + 2 * design_inputs.pile_overhang
        footing_y_ft = design_inputs.col_y_dim + 2 * design_inputs.pile_overhang
        footing_thickness_ft = design_inputs.footing_thickness
        
        # Flexural moment check along x-direction
        col_dim_x = design_inputs.col_x_dim
        edge_x = (footing_x_ft - col_dim_x) / 2
        crit_x = edge_x - design_inputs.pile_overhang  # Critical section distance in feet

        # Find critical pile groups
        col_x_min = pile_center_x - col_dim_x / 2
        col_x_max = pile_center_x + col_dim_x / 2
        
        piles_right = [i for i, coord in enumerate(pile_coordinates) if coord["x (ft)"] > col_x_max]
        piles_left = [i for i, coord in enumerate(pile_coordinates) if coord["x (ft)"] < col_x_min]
        
        Pu_right = sum(pile_forces[i]["Pmax (k)"] for i in piles_right)
        Pu_left = sum(pile_forces[i]["Pmax (k)"] for i in piles_left)
        Pu_x = max(Pu_right, Pu_left)
        Mpile_x = Pu_x * crit_x  # Moment from pile group in x-direction

        # Flexural moment check along y-direction
        col_dim_y = design_inputs.col_y_dim
        edge_y = (footing_y_ft - col_dim_y) / 2
        crit_y = edge_y - design_inputs.pile_overhang  # Critical section distance in feet

        col_y_min = pile_center_y - col_dim_y / 2
        col_y_max = pile_center_y + col_dim_y / 2
        
        piles_above = [i for i, coord in enumerate(pile_coordinates) if coord["y (ft)"] > col_y_max]
        piles_below = [i for i, coord in enumerate(pile_coordinates) if coord["y (ft)"] < col_y_min]
        
        Pu_above = sum(pile_forces[i]["Pmax (k)"] for i in piles_above)
        Pu_below = sum(pile_forces[i]["Pmax (k)"] for i in piles_below)
        Pu_y = max(Pu_above, Pu_below)
        Mpile_y = Pu_y * crit_y  # Moment from pile group in y-direction

        # Moment from footing self-weight
        Mfooting_x = footing_x_ft * footing_thickness_ft * 0.15 * (edge_x**2 / 2)
        Mfooting_y = footing_y_ft * footing_thickness_ft * 0.15 * (edge_y**2 / 2)

        # Moment from surcharge (if any)
        Msurcharge_x = footing_x_ft * design_inputs.seal_thickness * design_inputs.soil_weight * (edge_x**2 / 2)
        Msurcharge_y = footing_y_ft * design_inputs.seal_thickness * design_inputs.soil_weight * (edge_y**2 / 2)

        # Total factored moments
        Mu_total_x = Mpile_x + Mfooting_x + Msurcharge_x
        Mu_total_y = Mpile_y + Mfooting_y + Msurcharge_y

        # Strength I and Service I design moments
        Mstrength_x = Mpile_x - 0.9 * Mfooting_x - 0.9 * Msurcharge_x
        Mstrength_y = Mpile_y - 0.9 * Mfooting_y - 0.9 * Msurcharge_y
        Mservice_x = Mpile_x - 1.0 * Mfooting_x - 1.0 * Msurcharge_x
        Mservice_y = Mpile_y - 1.0 * Mfooting_y - 1.0 * Msurcharge_y

        return {
            "x_direction": {
                "edge_distance": round(edge_x, 3),
                "critical_distance": round(crit_x, 3),
                "pile_force": round(Pu_x, 2),
                "pile_moment": round(Mpile_x, 2),
                "footing_moment": round(Mfooting_x, 2),
                "surcharge_moment": round(Msurcharge_x, 2),
                "total_moment": round(Mu_total_x, 2),
                "strength_moment": round(Mstrength_x, 2),
                "service_moment": round(Mservice_x, 2),
                "ultimate_moment": round(max(Mstrength_x, Mservice_x), 2)
            },
            "y_direction": {
                "edge_distance": round(edge_y, 3),
                "critical_distance": round(crit_y, 3),
                "pile_force": round(Pu_y, 2),
                "pile_moment": round(Mpile_y, 2),
                "footing_moment": round(Mfooting_y, 2),
                "surcharge_moment": round(Msurcharge_y, 2),
                "total_moment": round(Mu_total_y, 2),
                "strength_moment": round(Mstrength_y, 2),
                "service_moment": round(Mservice_y, 2),
                "ultimate_moment": round(max(Mstrength_y, Mservice_y), 2)
            }
        }
        
    except Exception as e:
        print(f"Error in flexural_moment_check: {e}")
        return None

def calculate_reinforcement_requirements(flexural_results, design_inputs, footing_dimensions):
    """
    Calculate required reinforcement based on flexural moments
    """
    try:
        if not flexural_results:
            return None
            
        fc = design_inputs.fc
        fy = design_inputs.fy
        footing_thickness_ft = design_inputs.footing_thickness
        cover_in = design_inputs.cover
        
        # Effective depth calculation
        pile_size_in = design_inputs.pile_size
        bar_dia_in = 1.41  # Assume #11 bar
        de_ft = footing_thickness_ft - pile_size_in/12 - cover_in/12 - bar_dia_in/12
        
        # X direction reinforcement
        Multimate_x = flexural_results["x_direction"]["ultimate_moment"]
        Multimate_x_per_ft = Multimate_x / footing_dimensions["footing_length"]
        
        # Calculate As_x using the formula from your notebook
        As_x = 0.85 * (fc / fy) * footing_dimensions["footing_length"] * footing_thickness_ft * \
               (1 - math.sqrt(1 - (4 * Multimate_x_per_ft) / (1.7 * 0.9 * fc * 144 * de_ft**2)))
        
        # Y direction reinforcement
        Multimate_y = flexural_results["y_direction"]["ultimate_moment"]
        Multimate_y_per_ft = Multimate_y / footing_dimensions["footing_width"]
        
        As_y = 0.85 * (fc / fy) * footing_dimensions["footing_width"] * footing_thickness_ft * \
               (1 - math.sqrt(1 - (4 * Multimate_y_per_ft) / (1.7 * 0.9 * fc * 144 * de_ft**2)))
        
        return {
            "effective_depth_ft": round(de_ft, 3),
            "x_direction": {
                "moment_per_ft": round(Multimate_x_per_ft, 2),
                "required_steel_area": round(As_x, 2)
            },
            "y_direction": {
                "moment_per_ft": round(Multimate_y_per_ft, 2),
                "required_steel_area": round(As_y, 2)
            }
        }
        
    except Exception as e:
        print(f"Error in calculate_reinforcement_requirements: {e}")
        return None

def advanced_shear_analysis(pile_coordinates, pile_forces, design_inputs):
    """
    Advanced shear analysis including corner pile punching shear
    """
    try:
        # Calculate pile group centroid
        pile_center_x = sum(p["x (ft)"] for p in pile_coordinates) / len(pile_coordinates)
        pile_center_y = sum(p["y (ft)"] for p in pile_coordinates) / len(pile_coordinates)
        
        # Find corner piles and get their maximum load
        xs = [p["x (ft)"] for p in pile_coordinates]
        ys = [p["y (ft)"] for p in pile_coordinates]
        min_x, max_x = min(xs), max(xs)
        min_y, max_y = min(ys), max(ys)
        
        corner_piles = [
            p for i, p in enumerate(pile_coordinates)
            if (p["x (ft)"] in [min_x, max_x]) and (p["y (ft)"] in [min_y, max_y])
        ]
        
        corner_pmax = [pile_forces[pile_coordinates.index(p)]["Pmax (k)"] for p in corner_piles]
        Vu = max(corner_pmax) if corner_pmax else 0
        
        # Effective depth
        pile_size_in = design_inputs.pile_size
        cover_in = design_inputs.cover
        bar_dia_in = 1.41
        footing_thickness_ft = design_inputs.footing_thickness
        de_ft = footing_thickness_ft - pile_size_in/12 - cover_in/12 - bar_dia_in/12
        dv = de_ft * 12  # Convert to inches
        dv2 = 0.5 * dv / 12  # ft
        
        # Perimeter of critical section
        pile_size_ft = pile_size_in / 12
        pile_edge_ft = design_inputs.pile_overhang
        b0_opt1 = 4 * (pile_size_ft + 2 * dv2)
        b0_opt2 = pile_size_ft + 2 * (dv2 + pile_edge_ft)
        b0 = min(b0_opt1, b0_opt2)  # ft
        b0_in = b0 * 12  # Convert to inches
        
        # Nominal shear resistance (punching shear)
        beta_c = 2.0
        fc = design_inputs.fc
        phi = 0.9
        
        Vn1 = (0.063 + 0.126 / beta_c) * math.sqrt(fc) * b0_in * dv  # kips
        Vn2 = 0.126 * math.sqrt(fc) * b0_in * dv  # kips
        Vn = min(Vn1, Vn2)
        
        phiVn = phi * Vn
        dc_ratio = Vu / phiVn if phiVn != 0 else float('inf')
        status = "PASS" if phiVn > Vu else "FAIL"
        
        return {
            "corner_pile_analysis": {
                "corner_piles_count": len(corner_piles),
                "max_corner_load": round(Vu, 2),
                "effective_depth_in": round(dv, 1),
                "critical_perimeter_ft": round(b0, 2),
                "nominal_capacity": round(Vn, 2),
                "design_capacity": round(phiVn, 2),
                "demand_capacity_ratio": round(dc_ratio, 3),
                "status": status
            }
        }
        
    except Exception as e:
        print(f"Error in advanced_shear_analysis: {e}")
        return None

@app.post("/api/pile-cap/design")
async def advanced_pile_cap_design(inputs: PileCapInputs):
    """
    Advanced pile cap design endpoint with comprehensive analysis
    """
    try:
        # Convert PileCapInputs to DesignInputs format
        design_inputs = DesignInputs(
            fc=inputs.fc,
            fy=inputs.fy,
            cover=inputs.cover,
            col_x_dim=inputs.col_x_dim,
            col_y_dim=inputs.col_y_dim,
            ecc_x=0,  # Default values
            ecc_y=0,
            footing_thickness=inputs.hFtg * 12,  # Convert to inches
            pile_embedment=inputs.Pileembed,
            pile_overhang=inputs.bFtg / 4,  # Estimate
            ground_elev=inputs.G_elev,
            footing_top_elev=inputs.F_elev,
            water_elev=inputs.W_elev,
            soil_weight=inputs.gamma_soil,
            seal_thickness=inputs.D_seal,
            pile_size=15  # Default
        )
        
        # Get current reactions
        global latest_reactions
        if not latest_reactions:
            latest_reactions = DEFAULT_LOAD_CASES
            
        # Calculate pile forces
        pile_forces = []
        for pile in inputs.pile_coords:
            pile_forces.append({
                "No.": pile["No."],
                "x (ft)": pile["x (ft)"],
                "y (ft)": pile["y (ft)"],
                "Pmax (k)": 100,  # Placeholder - would calculate from reactions
                "Pmin (k)": -20   # Placeholder
            })
        
        # Footing dimensions
        footing_dimensions = {
            "footing_length": inputs.bFtg,
            "footing_width": inputs.LFtg,
            "footing_area": inputs.bFtg * inputs.LFtg
        }
        
        # Run advanced analyses
        flexural_results = flexural_moment_check(inputs.pile_coords, pile_forces, design_inputs)
        reinforcement_results = calculate_reinforcement_requirements(flexural_results, design_inputs, footing_dimensions)
        shear_results = advanced_shear_analysis(inputs.pile_coords, pile_forces, design_inputs)
        
        return {
            "status": "success",
            "footing_dimensions": footing_dimensions,
            "flexural_analysis": flexural_results,
            "reinforcement_design": reinforcement_results,
            "advanced_shear_analysis": shear_results,
            "pile_count": inputs.Npiles,
            "design_summary": {
                "concrete_strength": inputs.fc,
                "steel_strength": inputs.fy,
                "footing_thickness": inputs.hFtg,
                "total_piles": inputs.Npiles
            }
        }
        
    except Exception as e:
        return {"error": f"Advanced design calculation failed: {str(e)}"}

# Update the pile-coordinates endpoint to include advanced analysis
