package com.example.product.service;

import com.example.product.dto.Location;


public interface DeliveryRouteService {
    double calculateDistance(Location start, Location end);

}
