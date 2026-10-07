package com.ultikits.docs.data;

import com.ultikits.ultitools.abstracts.UltiToolsPlugin;
import com.ultikits.ultitools.entities.WhereCondition;
import com.ultikits.ultitools.interfaces.DataOperator;

import java.util.List;

public class UserDataService {

    public void save(UltiToolsPlugin plugin, UserData data) {
        DataOperator<UserData> operator = plugin.getDataOperator(UserData.class);
        operator.insert(data);
    }

    public List<UserData> findByName(UltiToolsPlugin plugin, String name) {
        DataOperator<UserData> operator = plugin.getDataOperator(UserData.class);
        return operator.getAll(
                WhereCondition.builder().column("player_name").value(name).build()
        );
    }
}
