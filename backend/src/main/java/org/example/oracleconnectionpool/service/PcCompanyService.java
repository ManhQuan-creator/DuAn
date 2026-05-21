package org.example.oracleconnectionpool.service;

import lombok.RequiredArgsConstructor;
import org.example.oracleconnectionpool.entity.PcCompany;
import org.example.oracleconnectionpool.repository.PcCompanyRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class PcCompanyService {

    private final PcCompanyRepository pcCompanyRepository;

    /** Danh sách điện lực đang hoạt động — dùng cho dropdown, auto-fill. */
    public List<PcCompany> getAll() {
        return pcCompanyRepository.findByActiveTrueOrderByCompanyCodeAsc();
    }

    /** Toàn bộ kể cả đã vô hiệu hóa — dùng cho admin. */
    public List<PcCompany> getAllIncludeInactive() {
        return pcCompanyRepository.findAllByOrderByCompanyCodeAsc();
    }

    public PcCompany getByCode(String companyCode) {
        return pcCompanyRepository.findById(companyCode.toUpperCase().trim())
                .orElseThrow(() -> new RuntimeException("Không tìm thấy điện lực: " + companyCode));
    }

    public PcCompany create(String companyCode, String companyName) {
        String code = companyCode.toUpperCase().trim();
        if (pcCompanyRepository.existsByCompanyCode(code)) {
            throw new RuntimeException("Mã điện lực '" + code + "' đã tồn tại");
        }
        return pcCompanyRepository.save(PcCompany.builder()
                .companyCode(code)
                .companyName(companyName.trim())
                .active(true)
                .build());
    }

    public PcCompany update(String companyCode, String companyName, Boolean active) {
        PcCompany pc = getByCode(companyCode);
        if (companyName != null) pc.setCompanyName(companyName.trim());
        if (active      != null) pc.setActive(active);
        return pcCompanyRepository.save(pc);
    }

    public void delete(String companyCode) {
        PcCompany pc = getByCode(companyCode);
        pc.setActive(false);
        pcCompanyRepository.save(pc);
    }

    public boolean existsByCode(String companyCode) {
        return pcCompanyRepository.existsByCompanyCode(companyCode);
    }
}
