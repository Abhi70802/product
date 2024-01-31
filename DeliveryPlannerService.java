package com.example.product.service;

import com.example.product.dto.DeliveryRoute;
import com.example.product.dto.Location;
import com.example.product.dto.Order;

import java.util.ArrayList;
import java.util.List;

public class DeliveryPlannerService {
    private DeliveryRouteService calculator;

    public DeliveryPlannerService(DeliveryRouteService calculator) {
        this.calculator = calculator;
    }

    public DeliveryRoute planRoute(List<Order> orders) {
        List<Location> unvisitedLocations = new ArrayList<>();
        for (Order order : orders) {
            unvisitedLocations.add(order.getPickupLocation());
            unvisitedLocations.add(order.getDeliveryLocation());
        }

        DeliveryRoute deliveryRoute = new DeliveryRoute();
        Location currentLocation = unvisitedLocations.remove(0); // Start from the first pickup location
        while (!unvisitedLocations.isEmpty()) {
            Location nearestLocation = findNearestLocation(currentLocation, unvisitedLocations);
            deliveryRoute.addLocation(nearestLocation);
            currentLocation = nearestLocation;
            unvisitedLocations.remove(nearestLocation);
        }

        double totalDistance = calculateTotalDistance(deliveryRoute);
        deliveryRoute.setTotalDistance(totalDistance);

        return deliveryRoute;
    }

    private Location findNearestLocation(Location currentLocation, List<Location> locations) {
        Location nearestLocation = null;
        double nearestDistance = Double.MAX_VALUE;
        for (Location location : locations) {
            double distance = calculator.calculateDistance(currentLocation, location);
            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestLocation = location;
            }
        }
        return nearestLocation;
    }

    private double calculateTotalDistance(DeliveryRoute route) {
        double totalDistance = 0;
        List<Location> locations = route.getLocations();
        for (int i = 0; i < locations.size() - 1; i++) {
            totalDistance += calculator.calculateDistance(locations.get(i), locations.get(i + 1));
        }
        return totalDistance;
    }
}
