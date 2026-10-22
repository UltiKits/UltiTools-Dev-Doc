package com.ultikits.docs.cache;

import com.ultikits.ultitools.abstracts.data.BaseDataEntity;
import com.ultikits.ultitools.annotations.Column;
import com.ultikits.ultitools.annotations.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

// Example domain type; not part of the framework. One row per finished play session.
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
@Table("play_sessions")
public class PlaySessionEntity extends BaseDataEntity<String> {
    @Column("player_id")
    private String playerId;

    @Column(value = "duration_millis", type = "BIGINT")
    private long durationMillis;
}
