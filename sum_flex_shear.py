def sum_flex_shear(no_piles, pile_size, foot_load, dist, force, index,
                   foot_load2=None, dist2=None):
    """
    Python translation of VBA SumFlexShear function.

    Parameters:
        no_piles (int): Number of piles
        pile_size (float): Pile size in feet
        foot_load (float): Primary footing load (shear or moment)
        dist (List[float]): Distances from column face to pile center (ft)
        force (List[float]): Corresponding pile forces (kips)
        index (int): 1 or 2 = shear left/right, 3 or 4 = moment left/right
        foot_load2 (float): Optional second footing load for negative shear
        dist2 (List[float]): Optional second distance array for negative shear

    Returns:
        float: Maximum critical shear or moment
    """
    if foot_load2 is None:
        foot_load2 = foot_load
    if dist2 is None:
        dist2 = dist

    sum_val = 0

    if index == 1:
        for i in range(no_piles):
            d = dist[i]
            if d == "":
                continue
            elif abs(d) < pile_size / 2:
                sum_val += force[i] * (1 - (pile_size / 2 + d) / pile_size)
            elif d < 0:
                sum_val += force[i]

        sum_val = abs(sum_val - foot_load)
        sum_val1 = sum_val

        sum_val = 0
        for i in range(no_piles):
            d = dist2[i]
            if d == "":
                continue
            elif abs(d) < pile_size / 2:
                sum_val += force[i] * (1 - (pile_size / 2 + d) / pile_size)
            elif d < 0:
                sum_val += force[i]

        sum_val = abs(sum_val - foot_load2)
        if sum_val > 0:
            sum_val = 0
        if sum_val1 > sum_val:
            sum_val = sum_val1

    elif index == 2:
        for i in range(no_piles):
            d = dist[i]
            if d == "":
                continue
            elif abs(d) < pile_size / 2:
                sum_val += force[i] * (1 - (pile_size / 2 - d) / pile_size)
            elif d > 0:
                sum_val += force[i]

        sum_val = abs(sum_val - foot_load)
        sum_val1 = sum_val

        sum_val = 0
        for i in range(no_piles):
            d = dist2[i]
            if d == "":
                continue
            elif abs(d) < pile_size / 2:
                sum_val += force[i] * (1 - (pile_size / 2 - d) / pile_size)
            elif d > 0:
                sum_val += force[i]

        sum_val = abs(sum_val - foot_load2)
        if sum_val > 0:
            sum_val = 0
        if sum_val1 > sum_val:
            sum_val = sum_val1

    elif index == 3:
        for i in range(no_piles):
            d = dist[i]
            if d == "":
                continue
            elif d < 0:
                sum_val += force[i] * -d
        sum_val = sum_val - foot_load

    elif index == 4:
        for i in range(no_piles):
            d = dist[i]
            if d == "":
                continue
            elif d > 0:
                sum_val += force[i] * d
        sum_val = sum_val - foot_load

    return sum_val


# Geometry and Pile Data
pile_center_x = sum(p["x (ft)"] for p in pile_coordinates) / len(pile_coordinates)
pile_center_y = sum(p["y (ft)"] for p in pile_coordinates) / len(pile_coordinates)
min_x = min(p["x (ft)"] for p in pile_coordinates)
max_x = max(p["x (ft)"] for p in pile_coordinates)
min_y = min(p["y (ft)"] for p in pile_coordinates)
max_y = max(p["y (ft)"] for p in pile_coordinates)

# Column and Footing Geometry
col_face_x = pile_center_x - column_x_dim_ft / 2
col_face_y = pile_center_y - column_y_dim_ft / 2
dv = footing_thickness_ft  # Assuming dv is the footing thickness

# Failure Planes
shear_plane_1_x = min_x - dv
shear_plane_2_x = max_x + dv
moment_plane_1_x = col_face_x
moment_plane_2_x = col_face_x

shear_plane_1_y = min_y - dv
shear_plane_2_y = max_y + dv
moment_plane_1_y = min_y
moment_plane_2_y = max_y

# Ensure units are consistent
shear_plane_2_x = min(shear_plane_2_x, 30.0)  # Cap to a reasonable value
shear_plane_2_y = min(shear_plane_2_y, 30.0)  # Cap to a reasonable value

# Pile Forces and Distances
x_dist = [p["x (ft)"] - pile_center_x for p in pile_coordinates]
y_dist = [p["y (ft)"] - pile_center_y for p in pile_coordinates]
forces = [p["Pmax (k)"] for p in pile_coordinates]

# Calculate Arms and Foot Loads
pile_size_ft = pile_size_in / 12  # Convert pile size to feet
overhang = pile_overhang_in / 12  # Convert overhang to feet
arm1_x = min(shear_plane_1_x - col_face_x, overhang + pile_size_ft / 2 + dv / 2)
arm2_x = max(moment_plane_1_x - col_face_x, 0)
foot_load_x = arm1_x / Footing_x_ft
foot_load2_x = arm2_x / Footing_x_ft

arm1_y = min(shear_plane_1_y - col_face_y, overhang + pile_size_ft / 2 + dv / 2)
arm2_y = max(moment_plane_1_y - col_face_y, 0)
foot_load_y = arm1_y / Footing_y_ft
foot_load2_y = arm2_y / Footing_y_ft

# Shear and Moment Calculations for X Direction
shear_neg_x = sum_flex_shear(
    no_piles=len(forces),
    pile_size=pile_size_ft,
    foot_load=foot_load_x,
    dist=x_dist,
    force=forces,
    index=1,
    foot_load2=foot_load2_x,
    dist2=x_dist
)

shear_pos_x = sum_flex_shear(
    no_piles=len(forces),
    pile_size=pile_size_ft,
    foot_load=foot_load_x,
    dist=x_dist,
    force=forces,
    index=2,
    foot_load2=foot_load2_x,
    dist2=x_dist
)

moment_neg_x = sum_flex_shear(
    no_piles=len(forces),
    pile_size=pile_size_ft,
    foot_load=foot_load_x,
    dist=x_dist,
    force=forces,
    index=3
)

moment_pos_x = sum_flex_shear(
    no_piles=len(forces),
    pile_size=pile_size_ft,
    foot_load=foot_load_x,
    dist=x_dist,
    force=forces,
    index=4
)

# Shear and Moment Calculations for Y Direction
shear_neg_y = sum_flex_shear(
    no_piles=len(forces),
    pile_size=pile_size_ft,
    foot_load=foot_load_y,
    dist=y_dist,
    force=forces,
    index=1,
    foot_load2=foot_load2_y,
    dist2=y_dist
)

shear_pos_y = sum_flex_shear(
    no_piles=len(forces),
    pile_size=pile_size_ft,
    foot_load=foot_load_y,
    dist=y_dist,
    force=forces,
    index=2,
    foot_load2=foot_load2_y,
    dist2=y_dist
)

moment_neg_y = sum_flex_shear(
    no_piles=len(forces),
    pile_size=pile_size_ft,
    foot_load=foot_load_y,
    dist=y_dist,
    force=forces,
    index=3
)

moment_pos_y = sum_flex_shear(
    no_piles=len(forces),
    pile_size=pile_size_ft,
    foot_load=foot_load_y,
    dist=y_dist,
    force=forces,
    index=4
)

# Store Results
results = {
    "Shear Negative X": shear_neg_x,
    "Shear Positive X": shear_pos_x,
    "Moment Negative X": moment_neg_x,
    "Moment Positive X": moment_pos_x,
    "Shear Negative Y": shear_neg_y,
    "Shear Positive Y": shear_pos_y,
    "Moment Negative Y": moment_neg_y,
    "Moment Positive Y": moment_pos_y
}

# Print Results
for key, value in results.items():
    print(f"{key}: {value:.2f}")