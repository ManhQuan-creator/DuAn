package org.example.oracleconnectionpool.repository;

import org.example.oracleconnectionpool.entity.CommentsEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CommentsRepository extends JpaRepository<CommentsEntity, Long>, JpaSpecificationExecutor<CommentsEntity> {

    List<CommentsEntity> findAllByTypeAndGroupIdOrderByCreatedAtDesc(String type, Long groupId);

    @Query("SELECT c FROM CommentsEntity c WHERE c.type = :type AND c.groupId IN :groupIds ORDER BY c.createdAt DESC")
    List<CommentsEntity> findAllByTypeAndGroupIdIn(String type, List<Long> groupIds);
}
