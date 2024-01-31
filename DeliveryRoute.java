package com.example.product.dto;

import java.util.ArrayList;
import java.util.List;

public class DeliveryRoute {
    private List<Location> route;
    private double totalDistance;

    public DeliveryRoute() {
        this.route = new ArrayList<>();
        this.totalDistance = 0.0;
    }

    public void addLocation(Location location) {
        route.add(location);
    }

    public List<Location> getLocations() {
        return route;
    }

    public double getTotalDistance() {
        return totalDistance;
    }

    public void setTotalDistance(double totalDistance) {
        this.totalDistance = totalDistance;
    }
}
