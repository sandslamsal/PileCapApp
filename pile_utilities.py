def generate_pile_coordinates(n_x, s_x, n_y, s_y):
    """
    Generate coordinates for piles based on the number of piles and spacing.

    Args:
        n_x (int): Number of piles in the x direction.
        s_x (float): Spacing between piles in the x direction (ft).
        n_y (int): Number of piles in the y direction.
        s_y (float): Spacing between piles in the y direction (ft).

    Returns:
        list: A list of dictionaries containing pile numbers and their coordinates.
    """
    coords = []
    for i in range(n_x):
        for j in range(n_y):
            coords.append({
                "No.": i * n_y + j + 1,
                "x (ft)": round(i * s_x, 2),
                "y (ft)": round(j * s_y, 2)
            })
    return coords



def calculate_pile_forces(coords, design_inputs, reactions):
    """
    Calculate pile forces based on coordinates, design inputs, and reactions.

    Args:
        coords (list): List of pile coordinates (dictionaries with x and y values).
        design_inputs (object): Object containing design input parameters.
        reactions (list): List of reaction forces and moments for load cases.

    Returns:
        None: Updates the `coords` list with calculated forces.
    """
    n_piles = len(coords)
    pile_center_x = sum(p["x (ft)"] for p in coords) / n_piles
    pile_center_y = sum(p["y (ft)"] for p in coords) / n_piles
    ix = sum((p["y (ft)"] - pile_center_y) ** 2 for p in coords)
    iy = sum((p["x (ft)"] - pile_center_x) ** 2 for p in coords)

    footing_length = design_inputs.s_x * (design_inputs.n_x - 1) + 2 * design_inputs.pile_overhang
    footing_width = design_inputs.s_y * (design_inputs.n_y - 1) + 2 * design_inputs.pile_overhang
    col_x = footing_length / 2
    col_y = footing_width / 2
    fct_x = pile_center_x
    fct_y = pile_center_y
    d = design_inputs.footing_thickness / 12
    d_embed = 12 / 12

    wt_foot = 0.15 * footing_length * footing_width * d
    wt_soil = (footing_length * footing_width - design_inputs.col_x_dim * design_inputs.col_y_dim) * \
              design_inputs.soil_weight * max(design_inputs.ground_elev - design_inputs.footing_top_elev, 0)
    wt_water = max(min(design_inputs.water_elev, max(design_inputs.ground_elev, design_inputs.footing_top_elev))
                   - (design_inputs.footing_top_elev - d - 0), 0) * 0.0624 * footing_length * footing_width

    for pile in coords:
        pile_x = pile["x (ft)"]
        pile_y = pile["y (ft)"]
        p_values = []

        for r in reactions:
            dc = r['dc_factor']
            fz = r['fz'] + (wt_foot + wt_soil - wt_water) * dc
            mx = r['mx'] - r['fz'] * (col_y - pile_center_y) + (wt_foot - wt_water + wt_soil) * (fct_y - pile_center_y)
            my = r['my'] + r['fz'] * (pile_center_x - col_x) + (wt_foot - wt_water + wt_soil) * (pile_center_x - fct_x)

            paxial = fz / n_piles
            pmy = my * (pile_x - pile_center_x) / ix if ix else 0
            pmx = mx * (pile_y - pile_center_y) / iy if iy else 0
            total = paxial + pmx + pmy
            p_values.append({"load_case": r['load_case'], "value": total})

        max_p = max(p_values, key=lambda x: x['value'])
        min_p = min(p_values, key=lambda x: x['value'])
        pile["Pmax (k)"] = round(max_p['value'], 2)
        pile["Pmax Load Case"] = max_p['load_case']
        pile["Pmin (k)"] = round(min_p['value'], 2)
        pile["Pmin Load Case"] = min_p['load_case']