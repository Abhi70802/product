package com.example.product;

import com.example.product.dto.DeliveryRoute;
import com.example.product.dto.Location;
import com.example.product.dto.Order;
import com.example.product.service.DeliveryPlannerService;
import com.example.product.service.DeliveryRouteService;
import com.example.product.service.HaversineRouteCalculator;

import java.util.ArrayList;
import java.util.List;

public class DistanceCalculator {


    public static void main(String[] args) {
        // Create sample locations
        Location r1 = new Location(12.9715987, 77.594566); // Restaurant 1
        Location r2 = new Location(12.935223, 77.6244813); // Restaurant 2
        Location c1 = new Location(12.9667634, 77.6071228); // Customer 1
        Location c2 = new Location(12.9279232, 77.6271078); // Customer 2

        Order order1 = new Order(r1, c1);
        Order order2 = new Order(r2, c2);

        List<Order> orders = new ArrayList<>();
        orders.add(order1);
        orders.add(order2);

        DeliveryRouteService calculator = new HaversineRouteCalculator();

        DeliveryPlannerService planner = new DeliveryPlannerService(calculator);
        DeliveryRoute route = planner.planRoute(orders);
        System.out.println("Planned Delivery Route:");
        for (Location location : route.getLocations()) {
            System.out.println("Location: " + location.getLatitude() + ", " + location.getLongitude());
        }
        System.out.println("Total Distance: " + route.getTotalDistance() + " km");
    }
}


