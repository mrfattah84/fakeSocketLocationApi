const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");

// --- 1. Server Initialization ---
const app = express();
const httpServer = createServer(app);

// Initialize Socket.IO with CORS settings to allow the HTML client (running on a different port/origin)
const io = new Server(httpServer, {
  cors: {
    origin: "*", // Allow all origins for simplicity in this sandbox environment
    methods: ["GET", "POST"],
  },
});

const PORT = 3030;
const SPEED_FACTOR = 0.00001; // Controls how fast drivers move along the path
const SIMULATION_INTERVAL_MS = 100; // Update frequency (10 updates per second)

// --- 2. Mock Locations (Longitude, Latitude) ---
// Using coordinates around Tehran, Iran from your provided data
const allLocations = [
  {
    id: 1,
    locationName: "Digikala Central Warehouse",
    latitude: 35.6943,
    longitude: 51.3347,
  },
  { id: 2, locationName: "Iran Mall", latitude: 35.7533, longitude: 51.2183 },
  {
    id: 3,
    locationName: "Sa'adat Abad Cafe",
    latitude: 35.7876,
    longitude: 51.3787,
  },
  {
    id: 4,
    locationName: "Niavaran Residence",
    latitude: 35.8166,
    longitude: 51.4646,
  },
  {
    id: 5,
    locationName: "Vanak Office Tower",
    latitude: 35.7594,
    longitude: 51.411,
  },
  {
    id: 6,
    locationName: "Tehranpars Medical Clinic",
    latitude: 35.7289,
    longitude: 51.5273,
  },
  {
    id: 7,
    locationName: "Enghelab Sq. Bookstore",
    latitude: 35.7011,
    longitude: 51.3912,
  },
  {
    id: 8,
    locationName: "Ferdowsi Grand Hotel",
    latitude: 35.6924,
    longitude: 51.4208,
  },
  {
    id: 9,
    locationName: "Palladium Mall",
    latitude: 35.8048,
    longitude: 51.4348,
  },
  {
    id: 10,
    locationName: "Azadi Tower Maintenance",
    latitude: 35.6997,
    longitude: 51.3381,
  },
  {
    locationName: "amper",
    latitude: 35.69919118991611,
    longitude: 51.1812093456318,
    id: 11,
  },
  {
    locationName: "amper",
    latitude: 35.69972100617487,
    longitude: 51.18195450095837,
    id: 12,
  },
  {
    locationName: "ertyjk",
    latitude: 35.666594425399,
    longitude: 51.35883427773993,
    id: 13,
  },
  {
    locationName: "sedrfgjhj",
    latitude: 35.70341740273831,
    longitude: 51.35889843749993,
    id: 14,
  },
];

const WAREHOUSE = [allLocations[0].longitude, allLocations[0].latitude];
const DESTINATIONS = allLocations.slice(1);

// Utility function to get the location name from its coordinates
function getLocationName(coords) {
  const location = allLocations.find(
    (loc) => loc.longitude === coords[0] && loc.latitude === coords[1]
  );
  return location ? location.locationName : "Unknown Location";
}

// --- 3. Driver Data Structure ---
const drivers = [
  {
    id: 1,
    driver_name: "Amir Rezvani",
    vehicle_type: "Van",
    status: "Available",
    order_id: null,
    delivery_location: null,
    path: [],
    current_index: 0,
    heading: 0,
    next_destination_coord: null,
    is_returning: false,
    order_type: null,
  },
  {
    id: 2,
    driver_name: "Leila Farhadi",
    vehicle_type: "Small Truck",
    status: "Available",
    order_id: null,
    delivery_location: null,
    path: [],
    current_index: 0,
    heading: 0,
    next_destination_coord: null,
    is_returning: false,
    order_type: null,
  },
  {
    id: 3,
    driver_name: "Babak Norouzi",
    vehicle_type: "Service Van",
    status: "Available",
    order_id: null,
    delivery_location: null,
    path: [],
    current_index: 0,
    heading: 0,
    next_destination_coord: null,
    is_returning: false,
    order_type: null,
  },
  {
    id: 4,
    driver_name: "Shirin Ebrahimi",
    vehicle_type: "Sedan",
    status: "Available",
    order_id: null,
    delivery_location: null,
    path: [],
    current_index: 0,
    heading: 0,
    next_destination_coord: null,
    is_returning: false,
    order_type: null,
  },
  {
    id: 5,
    driver_name: "Sina Mansouri",
    vehicle_type: "Large Truck",
    status: "Available",
    order_id: null,
    delivery_location: null,
    path: [],
    current_index: 0,
    heading: 0,
    next_destination_coord: null,
    is_returning: false,
    order_type: null,
  },
];

let nextOrderId = 1005;

// --- 4. Simulation Utilities (Mock Path Generation) ---

/**
 * Generates a mock curved route (Linestring) between two coordinates using a quadratic Bezier curve.
 * @param {Array} start [lng, lat]
 * @param {Array} end [lng, lat]
 * @param {number} steps The number of steps/segments in the path.
 * @returns {Array<Array>} Array of coordinates [[lng, lat], ...]
 */
function generateMockPath(start, end, steps = 100) {
  const [startLng, startLat] = start;
  const [endLng, endLat] = end;

  // Calculate a control point to make the path curve
  // This creates a curve that bulges out from the straight line
  const midLng = (startLng + endLng) / 2;
  const midLat = (startLat + endLat) / 2;
  const dx = endLng - startLng;
  const dy = endLat - startLat;
  const curvature = 0.3; // Adjust for more or less curve
  const controlLng = midLng - dy * curvature;
  const controlLat = midLat + dx * curvature;

  const path = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    // Quadratic Bezier curve formula: (1-t)^2 * P0 + 2 * (1-t) * t * P1 + t^2 * P2
    const lng =
      Math.pow(1 - t, 2) * startLng +
      2 * (1 - t) * t * controlLng +
      Math.pow(t, 2) * endLng;
    const lat =
      Math.pow(1 - t, 2) * startLat +
      2 * (1 - t) * t * controlLat +
      Math.pow(t, 2) * endLat;
    path.push([lng, lat]);
  }
  return path;
}

/**
 * Calculates the bearing (heading) in degrees between two coordinates.
 * This is used to make the driver icon point in the direction of travel.
 * @param {Array} start [lng, lat]
 * @param {Array} end [lng, lat]
 * @returns {number} Heading in degrees (0 to 360)
 */
function getHeading(start, end) {
  const startLat = (start[1] * Math.PI) / 180;
  const endLat = (end[1] * Math.PI) / 180;
  const startLng = (start[0] * Math.PI) / 180;
  const endLng = (end[0] * Math.PI) / 180;

  const dLon = endLng - startLng;

  const y = Math.sin(dLon) * Math.cos(endLat);
  const x =
    Math.cos(startLat) * Math.sin(endLat) -
    Math.sin(startLat) * Math.cos(endLat) * Math.cos(dLon);

  let brng = Math.atan2(y, x);
  brng = (brng * 180) / Math.PI; // Convert to degrees
  brng = (brng + 360) % 360; // Normalize to 0-360
  return brng;
}

// --- 5. Core Simulation Loop ---

function simulateMovement() {
  // 1. Update Driver Positions and Status
  drivers.forEach((driver) => {
    if (driver.status === "Available") {
      // Logic: Assign new order after a short delay
      if (Math.random() < 0.05) {
        // 5% chance of getting a new order every interval
        const destination =
          DESTINATIONS[Math.floor(Math.random() * DESTINATIONS.length)];
        driver.next_destination_coord = [
          destination.longitude,
          destination.latitude,
        ];

        driver.order_id = `O${nextOrderId++}`;
        driver.delivery_location = destination.locationName;
        driver.order_type = "Pickup"; // Start with a pickup
        driver.status = "Picking Up";
        driver.is_returning = false;
        driver.current_index = 0;
        driver.path = generateMockPath(
          WAREHOUSE,
          driver.next_destination_coord
        );
        console.log(
          `Driver ${driver.id} assigned new order ${driver.order_id} to pick up at ${driver.delivery_location}`
        );
      }
      // If available, ensure they are exactly at the warehouse
      driver.current_index = 0;
      driver.path = [WAREHOUSE];
    } else {
      // Driver is Moving (Delivering or Returning)

      if (driver.current_index < driver.path.length - 1) {
        // Move to the next point on the path
        const nextPointIndex = driver.current_index + 1;

        // Calculate heading before moving
        const currentPoint = driver.path[driver.current_index];
        const nextPoint = driver.path[nextPointIndex];
        driver.heading = getHeading(currentPoint, nextPoint);

        driver.current_index = nextPointIndex;
      } else {
        // Arrived at the destination!
        driver.current_index = driver.path.length - 1; // Ensure position is exactly the final point

        if (driver.status === "Picking Up") {
          // Completed Pickup -> Start Delivering to Warehouse
          console.log(
            `Driver ${driver.id} completed pickup for ${driver.order_id}. Returning to warehouse.`
          );
          driver.status = "Delivering";
          driver.order_type = "Delivery";
          driver.is_returning = true; // Technically delivering to warehouse
          driver.current_index = 0;
          driver.path = generateMockPath(
            driver.next_destination_coord,
            WAREHOUSE
          ); // Path back to HUB
          driver.next_destination_coord = WAREHOUSE; // Set new target
        } else if (driver.status === "Delivering") {
          // Completed Delivery -> Start Returning
          console.log(
            `Driver ${driver.id} delivered ${driver.order_id} to warehouse. Now available.`
          );
          driver.status = "Available";
          driver.is_returning = false;
          driver.order_id = null;
          driver.delivery_location = null;
          driver.order_type = null;
          driver.next_destination_coord = null;
          driver.path = [WAREHOUSE]; // Reset path to just the hub point
          driver.current_index = 0;
        }
      }
    }
  });

  // 2. Prepare GeoJSON Feature Collection for broadcast
  const geoJsonFeatures = drivers.map((driver) => {
    const currentCoord =
      driver.path.length > 0 ? driver.path[driver.current_index] : WAREHOUSE;
    const totalPathSteps = driver.path.length > 0 ? driver.path.length : 1;

    // Calculate progress percentage
    const progressPercent =
      Math.min(
        100,
        Math.round((driver.current_index / (totalPathSteps - 1)) * 100)
      ) || 0;

    return {
      type: "Feature",
      id: driver.id,
      geometry: {
        type: "Point",
        coordinates: currentCoord, // [lng, lat]
      },
      properties: {
        driver_name: driver.driver_name,
        vehicle_type: driver.vehicle_type,
        status: driver.status,
        heading: driver.heading,
        order_id: driver.order_id,
        delivery_location: driver.delivery_location,
        order_type: driver.order_type,
        progress_percent: progressPercent,
        // Send the full path coordinates for the map to draw the polyline
        path: driver.path,
      },
    };
  });

  const geoJsonCollection = {
    type: "FeatureCollection",
    features: geoJsonFeatures,
  };

  // 3. Broadcast to all connected clients
  io.emit("driverUpdate", geoJsonCollection);
}

// Start the simulation loop
setInterval(simulateMovement, SIMULATION_INTERVAL_MS);

// --- 6. Server Listeners ---

io.on("connection", (socket) => {
  console.log(`A client connected: ${socket.id}`);

  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`✅ Simulation server running at http://localhost:${PORT}`);
  console.log(`Connect your HTML map to ws://localhost:${PORT}`);
});
