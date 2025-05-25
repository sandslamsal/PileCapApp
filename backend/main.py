# backend/main.py
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any
from fastapi import Body
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

# Model for a single reaction case
class ReactionCase(BaseModel):
    load_case: str
    dc_factor: float
    fx: float
    fy: float
    fz: float
    mx: float
    my: float

# Model for reaction table data
class ReactionTableData(BaseModel):
    reactions: List[ReactionCase]

@app.post("/api/calculate")
def calculate(inputs: DesignInputs):
    # Example calculation (just echoing inputs)
    result = {
        "gross_area": (inputs.col_x_dim + inputs.pile_overhang * 2) * (inputs.col_y_dim + inputs.pile_overhang * 2),
        "depth_to_tip": inputs.footing_top_elev - inputs.ground_elev + inputs.pile_embedment
    }
    return {"inputs": inputs.dict(), "results": result}

# Pile coordinates generation function
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
    
    latest_reactions = valid_reactions
    return {"message": f"Saved {len(valid_reactions)} reactions successfully"}

# Default load cases
DEFAULT_LOAD_CASES = [
    {"load_case": "Fx Maximum", "dc_factor": 1.00, "fx": -131, "fy": -235, "fz": 7562, "mx": 9909, "my": -4939},
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
    if not reactions or not coordinates:
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
        
        for reaction in reactions:
            # Step 1: Calculate Fz_max using the provided formula
            if reaction.dc_factor <= 1:
                soil_weight_factor = wt_soil
            else:
                soil_weight_factor = wt_soil * 1.3/1.25
                
            fz_max = reaction.fz + (wt_foot + soil_weight_factor - wt_water) * reaction.dc_factor
            
            # Step 2: Calculate Mx_max using the provided formula
            if reaction.dc_factor <= 1:
                weight_factor = (wt_foot - wt_water + wt_soil)
            else:
                weight_factor = (wt_foot - wt_water + wt_soil * 1.35/1.25)
            
            mx_max = (reaction.mx - 
                     reaction.fy * (footing_thickness - pile_diameter/12) + 
                     reaction.fz * (col_center_y - pile_center_y) + 
                     weight_factor * reaction.dc_factor * (footing_center_y - pile_center_y))
            
            # Step 3: Calculate My_max using the provided formula
            my_max = (reaction.my + 
                     reaction.fx * (footing_thickness - pile_diameter/12) + 
                     reaction.fz * (pile_center_x - col_center_x) + 
                     weight_factor * reaction.dc_factor * (pile_center_x - footing_center_x))
            
            # Step 4: Calculate pile force using the general formula
            p_axial = fz_max / n_piles
            p_mx = mx_max * (pile_y - pile_center_y) / iy if iy != 0 else 0
            p_my = my_max * (pile_x - pile_center_x) / ix if ix != 0 else 0
            
            p_value = p_axial + p_mx + p_my
            p_values.append({
                "load_case": reaction.load_case,
                "value": p_value,
                "components": {
                    "axial": p_axial,
                    "moment_x": p_mx,
                    "moment_y": p_my
                }
            })            # Store max and min values for all load cases
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
async def get_pile_coords(n_x: int, s_x: float, n_y: int, s_y: float, with_calculations: bool = False, 
                         fc: float = 5.5, fy: float = 60, cover: float = 4.5, col_x_dim: float = 9, 
                         col_y_dim: float = 16, ecc_x: float = 0, ecc_y: float = 0, footing_thickness: float = 9, 
                         pile_embedment: float = 12, pile_overhang: float = 1.625, ground_elev: float = 73.4, 
                         footing_top_elev: float = 70.4, water_elev: float = 68, soil_weight: float = 0.115, 
                         seal_thickness: float = 0, pile_cap_length: float = 40, pile_cap_width: float = 24, 
                         D: float = 9, pile_diameter: float = 1, bar_cover: float = 4.5, bottom_bar_size_long: float = 1, bottom_bar_size_trans: float = 1, gamma_soil: float = 0.115):
    try:
        coords = generate_pile_coordinates(n_x, s_x, n_y, s_y)
        print(f"Generated {len(coords)} pile coordinates")
        shear_check = None
        footing_calculations = None
        # Always perform calculations and include details in response
        if latest_reactions:
            load_cases = [r.load_case for r in latest_reactions]
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
        return {"coordinates": coords, "footing_calculations": footing_calculations, "shear_check": shear_check}
    except Exception as e:
        print(f"Error in /api/pile-coordinates: {e}")
        return {"error": str(e)}
