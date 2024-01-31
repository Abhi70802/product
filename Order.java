package com.example.product.dto;

import lombok.Data;


public class Order {
    private Location pickupLocation;
    private Location deliveryLocation;
    public Order(Location pickupLocation,Location deliveryLocation){
        this.deliveryLocation = deliveryLocation;
        this.pickupLocation = pickupLocation;
    }

    public Location getPickupLocation(){
        return pickupLocation;
    }

    public Location getDeliveryLocation(){
        return deliveryLocation;
    }
}
