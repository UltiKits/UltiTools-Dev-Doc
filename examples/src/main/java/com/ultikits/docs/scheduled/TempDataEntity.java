package com.ultikits.docs.scheduled;

import com.ultikits.ultitools.abstracts.data.BaseDataEntity;
import com.ultikits.ultitools.annotations.Column;
import com.ultikits.ultitools.annotations.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

// Example domain type; not part of the framework.
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
@Table("temp_data")
public class TempDataEntity extends BaseDataEntity<String> {
    @Column(value = "expire_time", type = "BIGINT")
    private long expireTime;
}
