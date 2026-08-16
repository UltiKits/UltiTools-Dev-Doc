package com.ultikits.docs.gui;

import com.ultikits.ultitools.annotations.Service;
import org.bukkit.Bukkit;
import org.bukkit.Location;

import java.util.ArrayList;
import java.util.List;

@Service
public class WarpService {

    public List<WarpData> getAllWarps() {
        return new ArrayList<>();
    }

    public void delete(String id) {
        // remove the warp with this id
    }

    /** Parses the "world,x,y,z" form stored on WarpData. */
    public static Location toLocation(String serialised) {
        String[] parts = serialised.split(",");
        return new Location(
            Bukkit.getWorld(parts[0]),
            Double.parseDouble(parts[1]),
            Double.parseDouble(parts[2]),
            Double.parseDouble(parts[3])
        );
    }
}
