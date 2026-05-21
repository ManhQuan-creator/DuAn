package org.example.oracleconnectionpool.entity;


import jakarta.persistence.Column;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.MappedSuperclass;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.example.oracleconnectionpool.config.CustomAuditingEntityListener;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.LastModifiedBy;

import java.io.Serializable;

@Data
@EqualsAndHashCode(callSuper = true)
@MappedSuperclass
@EntityListeners(CustomAuditingEntityListener.class)
public class AbstractAuditingUserEntity extends AbstractAuditingTimeEntity implements Serializable {

    @CreatedBy
    @Column(name = "CREATED_BY")
    private String createdBy;
    @LastModifiedBy
    @Column(name = "UPDATED_BY")
    private String updatedBy;

}
