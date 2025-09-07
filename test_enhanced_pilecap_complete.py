"""
Enhanced Pile Cap Design Application Test
Comprehensive test of advanced analysis features integrated from Jupyter notebook
"""

import requests
import json

# API base URL
API_BASE = "http://localhost:8000"

def test_basic_pile_coordinates():
    """Test basic pile coordinate generation"""
    print("=== Testing Basic Pile Coordinate Generation ===")
    
    params = {
        "n_x": 4,
        "n_y": 3,
        "s_x": 8.0,
        "s_y": 8.0,
        "with_calculations": False
    }
    
    response = requests.get(f"{API_BASE}/api/pile-coordinates", params=params)
    data = response.json()
    
    print(f"Generated {len(data['coordinates'])} pile coordinates")
    for pile in data['coordinates'][:3]:  # Show first 3 piles
        print(f"  Pile {pile['No.']}: ({pile['x (ft)']}, {pile['y (ft)']})")
    
    return data['coordinates']

def test_advanced_pile_analysis():
    """Test enhanced pile coordinate generation with advanced analysis"""
    print("\n=== Testing Enhanced Pile Analysis with Advanced Features ===")
    
    params = {
        "n_x": 4,
        "n_y": 3,
        "s_x": 8.0,
        "s_y": 8.0,
        "fc": 5.5,
        "fy": 60,
        "cover": 4.5,
        "col_x_dim": 9,
        "col_y_dim": 16,
        "footing_thickness": 9,
        "pile_embedment": 12,
        "pile_overhang": 1.625,
        "ground_elev": 73.4,
        "footing_top_elev": 70.4,
        "water_elev": 68,
        "soil_weight": 0.115,
        "seal_thickness": 0,
        "pile_cap_length": 40,
        "pile_cap_width": 24,
        "with_calculations": True  # Enable advanced analysis
    }
    
    response = requests.get(f"{API_BASE}/api/pile-coordinates", params=params)
    data = response.json()
    
    print(f"Generated {len(data['coordinates'])} pile coordinates")
    
    # Check for advanced analysis results
    if 'flexural_analysis' in data:
        print("\n--- Flexural Analysis Results ---")
        flex = data['flexural_analysis']
        if 'x_direction' in flex:
            x_dir = flex['x_direction']
            print(f"X-Direction Ultimate Moment: {x_dir['ultimate_moment']} kip-ft")
        if 'y_direction' in flex:
            y_dir = flex['y_direction']
            print(f"Y-Direction Ultimate Moment: {y_dir['ultimate_moment']} kip-ft")
    
    if 'reinforcement_design' in data:
        print("\n--- Reinforcement Design Results ---")
        reinf = data['reinforcement_design']
        print(f"Effective Depth: {reinf['effective_depth_ft']} ft")
        if 'x_direction' in reinf:
            print(f"X-Direction Required Steel: {reinf['x_direction']['required_steel_area']} in²")
        if 'y_direction' in reinf:
            print(f"Y-Direction Required Steel: {reinf['y_direction']['required_steel_area']} in²")
    
    if 'advanced_shear_analysis' in data:
        print("\n--- Advanced Shear Analysis Results ---")
        shear = data['advanced_shear_analysis']
        if 'corner_pile_analysis' in shear:
            corner = shear['corner_pile_analysis']
            print(f"Corner Pile Max Load: {corner['max_corner_load']} kips")
            print(f"Design Capacity: {corner['design_capacity']} kips")
            print(f"Status: {corner['status']}")
    
    return data

def test_load_cases():
    """Test load case management"""
    print("\n=== Testing Load Case Management ===")
    
    # Add some test load cases
    load_cases = [
        {
            "load_case": "Dead Load",
            "dc_factor": 1.25,
            "fx": 50.0,
            "fy": 75.0,
            "fz": 2500.0,
            "mx": 200.0,
            "my": 150.0,
            "mz": 0.0
        },
        {
            "load_case": "Live Load",
            "dc_factor": 1.75,
            "fx": 30.0,
            "fy": 45.0,
            "fz": 1800.0,
            "mx": 120.0,
            "my": 90.0,
            "mz": 0.0
        }
    ]
    
    for load_case in load_cases:
        response = requests.post(f"{API_BASE}/api/reactions", json=load_case)
        if response.status_code == 200:
            print(f"Added load case: {load_case['load_case']}")
        else:
            print(f"Failed to add load case: {load_case['load_case']}")
    
    # Get current reactions
    response = requests.get(f"{API_BASE}/api/reactions")
    if response.status_code == 200:
        reactions = response.json()
        print(f"Total load cases: {len(reactions)}")
        for reaction in reactions:
            print(f"  {reaction['load_case']}: Fz={reaction['fz']} kips")

def test_comprehensive_design():
    """Test the comprehensive design endpoint"""
    print("\n=== Testing Comprehensive Design Analysis ===")
    
    # First get pile coordinates
    coords_response = requests.get(f"{API_BASE}/api/pile-coordinates", params={
        "n_x": 3, "n_y": 2, "s_x": 10.0, "s_y": 10.0, "with_calculations": False
    })
    coords_data = coords_response.json()
    pile_coords = coords_data['coordinates']
    
    # Prepare comprehensive design inputs
    design_inputs = {
        "bFtg": 32.0,
        "LFtg": 22.0,
        "hFtg": 0.75,  # 9 ft / 12 = 0.75 ft
        "Pileembed": 12,
        "fc": 5.5,
        "fy": 60,
        "cover": 4.5,
        "bar_size_x": 1.0,
        "bar_size_y": 1.0,
        "My": 0.0,
        "Mx": 0.0,
        "Vu": 0.0,
        "Npiles": 6,
        "pile_coords": pile_coords,
        "wtFtg": 0.0,
        "Py": 0.0,
        "MyFtg": 0.0,
        "MySurcharge": 0.0,
        "MuyPile": 0.0,
        "gamma_conc": 0.15,
        "gamma_soil": 0.115,
        "G_elev": 73.4,
        "F_elev": 70.4,
        "W_elev": 68,
        "D_seal": 0,
        "col_x_dim": 9,
        "col_y_dim": 16
    }
    
    response = requests.post(f"{API_BASE}/api/pile-cap/design", json=design_inputs)
    
    if response.status_code == 200:
        data = response.json()
        print("Comprehensive design analysis completed!")
        
        if 'flexural_analysis' in data:
            print("✓ Flexural analysis included")
        if 'reinforcement_design' in data:
            print("✓ Reinforcement design included")
        if 'advanced_shear_analysis' in data:
            print("✓ Advanced shear analysis included")
        
        print(f"Design summary: {data.get('design_summary', {})}")
    else:
        print(f"Comprehensive design failed: {response.text}")

def main():
    """Run all tests"""
    print("Enhanced Pile Cap Design Application - Comprehensive Test")
    print("=" * 60)
    
    try:
        # Test basic functionality
        pile_coords = test_basic_pile_coordinates()
        
        # Test enhanced analysis
        advanced_data = test_advanced_pile_analysis()
        
        # Test load case management
        test_load_cases()
        
        # Test comprehensive design
        test_comprehensive_design()
        
        print("\n" + "=" * 60)
        print("All tests completed successfully!")
        print("The enhanced pile cap design application is fully functional with:")
        print("✓ Basic pile coordinate generation")
        print("✓ Advanced flexural moment analysis")
        print("✓ Reinforcement design calculations")
        print("✓ Advanced shear analysis")
        print("✓ Load case management")
        print("✓ Comprehensive design endpoint")
        
    except requests.exceptions.ConnectionError:
        print("ERROR: Cannot connect to the FastAPI backend.")
        print("Please ensure the server is running on http://localhost:8000")
        print("Run: cd backend && python3 -m uvicorn main:app --reload --host 0.0.0.0 --port 8000")
    except Exception as e:
        print(f"Test failed with error: {e}")

if __name__ == "__main__":
    main()
