package com.ultikits.docs.query;

import java.util.List;

// Example service contract; not part of the framework.
public interface HomeService {

    HomeEntity getHome(String playerUuid, String homeName);

    List<HomeEntity> getAllHomes(String playerUuid);

    boolean homeExists(String playerUuid, String homeName);

    void deleteHome(String playerUuid, String homeName);
}
