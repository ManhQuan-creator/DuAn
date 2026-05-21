package org.example.oracleconnectionpool.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.example.oracleconnectionpool.constant.Api;
import org.example.oracleconnectionpool.constant.CommonResponseCode;
import org.example.oracleconnectionpool.entity.Organization;
import org.example.oracleconnectionpool.model.base.ResponseData;
import org.example.oracleconnectionpool.model.request.organization.CreateOrganizationRequest;
import org.example.oracleconnectionpool.model.request.organization.SearchOrganizationRequest;
import org.example.oracleconnectionpool.model.request.organization.UpdateOrganizationRequest;
import org.example.oracleconnectionpool.service.OrganizationService;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RequiredArgsConstructor
@RestController
@RequestMapping(Api.V1.ORGANIZATIONS)
public class OrganizationController {

    private final OrganizationService organizationService;

    @GetMapping
    public ResponseEntity<ResponseData<List<Organization>>> getAll() {
        return ResponseEntity.ok(new ResponseData<List<Organization>>().success(organizationService.getAll()));
    }

    @GetMapping("/hq-depts")
    public ResponseEntity<ResponseData<List<Organization>>> getHqDepts() {
        return ResponseEntity.ok(new ResponseData<List<Organization>>().success(organizationService.getHqDepts()));
    }

    @GetMapping("/all")
    public ResponseEntity<ResponseData<List<Organization>>> getAllIncludeInactive() {
        return ResponseEntity.ok(new ResponseData<List<Organization>>().success(organizationService.getAllOrganizations()));
    }

    @GetMapping("/search")
    public ResponseEntity<ResponseData<Page<Organization>>> search(@ModelAttribute SearchOrganizationRequest request) {
        return ResponseEntity.ok(new ResponseData<Page<Organization>>().success(organizationService.search(request)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ResponseData<Organization>> getById(@PathVariable Long id) {
        return ResponseEntity.ok(new ResponseData<Organization>().success(organizationService.getById(id)));
    }

    @PostMapping
    public ResponseEntity<ResponseData<Organization>> create(@Valid @RequestBody CreateOrganizationRequest request) {
        return ResponseEntity.ok(new ResponseData<>(
                CommonResponseCode.SUCCESS.getCode(),
                "Tạo đơn vị thành công",
                organizationService.create(request)
        ));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ResponseData<Organization>> update(@PathVariable Long id,
                                                              @Valid @RequestBody UpdateOrganizationRequest request) {
        return ResponseEntity.ok(new ResponseData<>(
                CommonResponseCode.SUCCESS.getCode(),
                "Cập nhật đơn vị thành công",
                organizationService.update(id, request)
        ));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ResponseData<Void>> delete(@PathVariable Long id) {
        organizationService.delete(id);
        return ResponseEntity.ok(new ResponseData<>(
                CommonResponseCode.SUCCESS.getCode(),
                "Đã vô hiệu hóa đơn vị"
        ));
    }
}
