package org.example.oracleconnectionpool.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "COMMENTS")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class CommentsEntity extends AbstractAuditingTimeEntity {
    @Id
    @SequenceGenerator(
            name = "COMMENTS_SEQ",
            sequenceName = "COMMENTS_SEQ",
            allocationSize = 1
    )
    @GeneratedValue(
            strategy = GenerationType.SEQUENCE,
            generator = "COMMENTS_SEQ"
    )
    private Long id;

    @Column(name = "USER_ID")
    private Long userId;// reference tới UserDto

    @Column(name = "CONTENT", columnDefinition = "CLOB")
    private String content;

    @Column(name = "TAG")
    private String tag;

    @Column(name = "TAG_NAME")
    private String tagName;

    @Column(name = "TYPE")
    private String type;

    @Column(name = "GROUP_ID")
    private Long groupId;

    @Column(name = "IS_DELETED")
    private String isDeleted = "N" ;
}
