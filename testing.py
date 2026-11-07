# GeoSentry Lite Simple Unit Test Example
vehicles = {"V001": "Active", "V002": "Active"}
geofence_status = {}
alerts = []

def track_vehicle(vehicle_id, location):
    if vehicle_id not in vehicles:
        return "Invalid Vehicle ID"
    
    geofence = "Inside"
    
    if location == "Outside":
        geofence = "Outside"
        alerts.append(vehicle_id)
        return "Alert: Vehicle crossed geofence"
    
    geofence_status[vehicle_id] = geofence
    return "Vehicle inside geofence"

print("Test Case 1:", track_vehicle("V001", "Inside"))
print("Test Case 2:", track_vehicle("V001", "Outside"))
print("Test Case 3:", track_vehicle("V003", "Inside"))

print("\nGeofence Status:")
print(geofence_status)

print("\nGenerated Alerts:")
print(alerts)