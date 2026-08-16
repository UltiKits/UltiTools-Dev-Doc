package com.ultikits.docs.gui;

import com.ultikits.ultitools.abstracts.data.BaseDataEntity;
import com.ultikits.ultitools.annotations.Column;
import com.ultikits.ultitools.annotations.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
@Table("warp_data")
public class WarpData extends BaseDataEntity<String> {
    @Column("name")
    private String name;

    /** Serialised as "world,x,y,z" -- see WarpService.toLocation. */
    @Column("location")
    private String location;
}
