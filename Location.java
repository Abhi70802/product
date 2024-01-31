package com.example.product.dto;

public class Location {
    private double latitude;
    private double longitude;
    public  Location(double lat,double lon){
        this.latitude = lat;
        this.longitude = lon;
    }

    public double getLatitude(){
        return latitude;
    }
    public double getLongitude(){
        return longitude;
    }
}
