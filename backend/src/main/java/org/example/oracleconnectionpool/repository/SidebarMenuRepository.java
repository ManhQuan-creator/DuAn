package org.example.oracleconnectionpool.repository;

import org.example.oracleconnectionpool.entity.SidebarMenu;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SidebarMenuRepository extends JpaRepository<SidebarMenu, Long> {

    List<SidebarMenu> findAllByOrderBySortOrderAscIdAsc();

    List<SidebarMenu> findByActiveTrueOrderBySortOrderAscIdAsc();

    List<SidebarMenu> findByParentId(Long parentId);

    Optional<SidebarMenu> findByMenuKey(String menuKey);

    boolean existsByMenuKey(String menuKey);
}
