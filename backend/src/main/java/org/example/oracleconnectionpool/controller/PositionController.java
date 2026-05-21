package org.example.oracleconnectionpool.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.example.oracleconnectionpool.constant.Api;
import org.example.oracleconnectionpool.constant.CommonResponseCode;
import org.example.oracleconnectionpool.model.base.ResponseData;
import org.example.oracleconnectionpool.model.request.position.CreatePositionRequest;
import org.example.oracleconnectionpool.model.request.position.UpdatePositionRequest;
import org.example.oracleconnectionpool.model.response.PositionResponse;
import org.example.oracleconnectionpool.service.PositionService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping(Api.V1.POSITIONS)
@RequiredArgsConstructor
public class PositionController {

    private final PositionService positionService;

    @GetMapping
    public ResponseEntity<ResponseData<List<PositionResponse>>> getAll() {
        return ResponseEntity.ok(new ResponseData<List<PositionResponse>>().success(positionService.getAll()));
    }

    @GetMapping("/active")
    public ResponseEntity<ResponseData<List<PositionResponse>>> getAllActive() {
        return ResponseEntity.ok(new ResponseData<List<PositionResponse>>().success(positionService.getAllActive()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ResponseData<PositionResponse>> getById(@PathVariable Long id) {
        return ResponseEntity.ok(new ResponseData<PositionResponse>().success(positionService.getById(id)));
    }

    @PostMapping
    public ResponseEntity<ResponseData<PositionResponse>> create(@Valid @RequestBody CreatePositionRequest request) {
        return ResponseEntity.ok(new ResponseData<>(
                CommonResponseCode.SUCCESS.getCode(),
                "Tạo chức danh thành công",
                positionService.create(request)
        ));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ResponseData<PositionResponse>> update(
            @PathVariable Long id,
            @RequestBody UpdatePositionRequest request) {
        return ResponseEntity.ok(new ResponseData<>(
                CommonResponseCode.SUCCESS.getCode(),
                "Cập nhật chức danh thành công",
                positionService.update(id, request)
        ));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ResponseData<Void>> delete(@PathVariable Long id) {
        positionService.delete(id);
        return ResponseEntity.ok(new ResponseData<>(
                CommonResponseCode.SUCCESS.getCode(),
                "Đã vô hiệu hóa chức danh"
        ));
    }
}
