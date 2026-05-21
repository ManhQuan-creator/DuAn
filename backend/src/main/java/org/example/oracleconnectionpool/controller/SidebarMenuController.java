package org.example.oracleconnectionpool.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.example.oracleconnectionpool.constant.Api;
import org.example.oracleconnectionpool.constant.CommonResponseCode;
import org.example.oracleconnectionpool.entity.SidebarMenu;
import org.example.oracleconnectionpool.model.base.ResponseData;
import org.example.oracleconnectionpool.model.request.sidebarmenu.CreateSidebarMenuRequest;
import org.example.oracleconnectionpool.model.request.sidebarmenu.UpdateSidebarMenuRequest;
import org.example.oracleconnectionpool.model.response.sidebarmenu.SidebarMenuNode;
import org.example.oracleconnectionpool.service.SidebarMenuService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RequiredArgsConstructor
@RestController
@RequestMapping(Api.V1.SIDEBAR_MENUS)
public class SidebarMenuController {

    private final SidebarMenuService service;

    /** Cây menu đang active — dùng cho sidebar runtime */
    @GetMapping("/tree")
    public ResponseEntity<ResponseData<List<SidebarMenuNode>>> getActiveTree() {
        return ResponseEntity.ok(new ResponseData<List<SidebarMenuNode>>().success(service.getActiveTree()));
    }

    /** Cây menu đầy đủ (cả inactive) — dùng cho admin manager */
    @GetMapping("/tree/full")
    public ResponseEntity<ResponseData<List<SidebarMenuNode>>> getFullTree() {
        return ResponseEntity.ok(new ResponseData<List<SidebarMenuNode>>().success(service.getFullTree()));
    }

    @GetMapping
    public ResponseEntity<ResponseData<List<SidebarMenu>>> findAll() {
        return ResponseEntity.ok(new ResponseData<List<SidebarMenu>>().success(service.findAll()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ResponseData<SidebarMenu>> getById(@PathVariable Long id) {
        return ResponseEntity.ok(new ResponseData<SidebarMenu>().success(service.getById(id)));
    }

    @PostMapping
    public ResponseEntity<ResponseData<SidebarMenu>> create(@Valid @RequestBody CreateSidebarMenuRequest request) {
        return ResponseEntity.ok(new ResponseData<>(
                CommonResponseCode.SUCCESS.getCode(),
                "Tạo menu thành công",
                service.create(request)
        ));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ResponseData<SidebarMenu>> update(@PathVariable Long id,
                                                            @Valid @RequestBody UpdateSidebarMenuRequest request) {
        return ResponseEntity.ok(new ResponseData<>(
                CommonResponseCode.SUCCESS.getCode(),
                "Cập nhật menu thành công",
                service.update(id, request)
        ));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ResponseData<Void>> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.ok(new ResponseData<>(
                CommonResponseCode.SUCCESS.getCode(),
                "Đã xóa menu"
        ));
    }
}
