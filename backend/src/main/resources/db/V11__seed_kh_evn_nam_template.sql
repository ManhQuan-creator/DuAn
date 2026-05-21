-- =============================================================================
-- V11 — Seed 2 template kế hoạch Tập đoàn EVN giao cho EVNNPC hằng năm
--   + sidebar menu entries cho Ban Kế hoạch
--
-- Tham chiếu văn bản nguồn: docs/1853-QD-EVN-KH-2023-NPC.md
-- (Quyết định 1153/QD-EVN ngày 31/12/2022 — KH SXKD-ĐTXD-TC năm 2023)
--
-- 2 template:
--   1) KH_SXKD_NAM      — chỉ tiêu định lượng (PL1 SXKD + PL2 giá bán buôn + PL3 ĐTXD tổng hợp)
--   2) KH_MUC_TIEU_NAM  — mục tiêu định tính (PL4 nhiệm vụ nâng cao hiệu quả)
--
-- Cả 2 đều periodType = YEAR, ownerDeptCode = BAN_KH.
-- Mỗi năm Ban KH tạo 1 entry mới, các template SCL khác có thể LOOKUP
-- giá trị KH qua row_code (vd LOOKUP('KH_SXKD_NAM','DIEN_TP','giaTri',0)).
--
-- Idempotent: bao bọc trong block PL/SQL, skip nếu template đã tồn tại.
-- Run thủ công sau khi BE startup tạo schema (ddl-auto=update).
-- =============================================================================

DECLARE
  v_sxkd_id    NUMBER;
  v_muctieu_id NUMBER;
  v_existing   NUMBER;

  -- Helper: insert 1 row vào GRID_ROW
  PROCEDURE ins_row(
    p_template_id  IN NUMBER,
    p_row_code     IN VARCHAR2,
    p_row_data     IN CLOB,
    p_is_header    IN NUMBER,
    p_sort_order   IN NUMBER
  ) IS
  BEGIN
    INSERT INTO GRID_ROW (
      TEMPLATE_ID, ROW_CODE, ROW_DATA, IS_TYPE_HEADER, SORT_ORDER,
      CREATED_AT, UPDATED_AT, CREATED_BY, UPDATED_BY
    ) VALUES (
      p_template_id, p_row_code, p_row_data, p_is_header, p_sort_order,
      SYSTIMESTAMP, SYSTIMESTAMP, 'SYSTEM', 'SYSTEM'
    );
  END;
BEGIN

  -- ============================================================================
  -- 1. Template KH_SXKD_NAM — chỉ tiêu định lượng
  -- ============================================================================
  SELECT COUNT(*) INTO v_existing FROM GRID_TEMPLATE WHERE CODE = 'KH_SXKD_NAM';
  IF v_existing = 0 THEN
    INSERT INTO GRID_TEMPLATE (
      CODE, NAME, DESCRIPTION,
      COLUMN_CONFIGS, COLUMN_GROUPS,
      STATUS, VERSION, PERIOD_TYPE,
      OWNER_DEPT_CODE,
      CREATED_AT, UPDATED_AT, CREATED_BY, UPDATED_BY
    ) VALUES (
      'KH_SXKD_NAM',
      N'Kế hoạch SXKD - ĐTXD - Tài chính năm Tập đoàn giao',
      N'Chỉ tiêu định lượng EVN giao EVNNPC hằng năm: điện thương phẩm, giá BQ, TTĐN, SCL, suất sự cố, độ tin cậy, đào tạo, giường ĐD, giá bán buôn EVN-EVNNPC, vốn ĐTXD (tổng hợp).',
      -- columnConfigs: 5 cột
      '[' ||
        '{"headerName":"STT","field":"stt","dataType":"text","width":80,"excelCol":"A"},' ||
        '{"headerName":"Tên chỉ tiêu","field":"tenChiTieu","dataType":"text","width":380,"excelCol":"B"},' ||
        '{"headerName":"Đơn vị","field":"donVi","dataType":"text","width":110,"excelCol":"C"},' ||
        '{"headerName":"Giá trị KH","field":"giaTri","dataType":"number","width":150,"excelCol":"D"},' ||
        '{"headerName":"Ghi chú","field":"ghiChu","dataType":"text","width":240,"excelCol":"E"}' ||
      ']',
      '[]',
      'PUBLISHED', 1, 'YEAR',
      'BAN_KH',
      SYSTIMESTAMP, SYSTIMESTAMP, 'SYSTEM', 'SYSTEM'
    ) RETURNING ID INTO v_sxkd_id;

    -- ----- Section I: KẾ HOẠCH SẢN XUẤT KINH DOANH (PL1) -----
    ins_row(v_sxkd_id, 'SEC_PL1',
      '{"stt":"I","tenChiTieu":"KẾ HOẠCH SẢN XUẤT KINH DOANH","donVi":"","giaTri":"","ghiChu":""}',
      1, 10);

    ins_row(v_sxkd_id, 'DIEN_TP',
      '{"stt":"1","tenChiTieu":"Điện thương phẩm","donVi":"triệu kWh","giaTri":"","ghiChu":"Năm 2023: 90.300"}',
      0, 20);
    ins_row(v_sxkd_id, 'GIA_BQ',
      '{"stt":"2","tenChiTieu":"Giá bán bình quân","donVi":"đ/kWh","giaTri":"","ghiChu":"Năm 2023: 1.788"}',
      0, 30);

    -- Tổn thất điện năng
    ins_row(v_sxkd_id, 'GRP_TTDN',
      '{"stt":"3","tenChiTieu":"Tổn thất điện năng","donVi":"","giaTri":"","ghiChu":""}',
      0, 40);
    ins_row(v_sxkd_id, 'TTDN_TONG',
      '{"stt":"3.1","tenChiTieu":"   TTĐN tổng","donVi":"%","giaTri":"","ghiChu":""}',
      0, 50);
    ins_row(v_sxkd_id, 'TTDN_CAO_AP',
      '{"stt":"3.2","tenChiTieu":"   Cao áp","donVi":"%","giaTri":"","ghiChu":""}',
      0, 60);
    ins_row(v_sxkd_id, 'TTDN_TRUNG_AP',
      '{"stt":"3.3","tenChiTieu":"   Trung áp","donVi":"%","giaTri":"","ghiChu":""}',
      0, 70);
    ins_row(v_sxkd_id, 'TTDN_HA_AP',
      '{"stt":"3.4","tenChiTieu":"   Hạ áp","donVi":"%","giaTri":"","ghiChu":""}',
      0, 80);

    ins_row(v_sxkd_id, 'CP_SCL',
      '{"stt":"4","tenChiTieu":"Chi phí sửa chữa lớn","donVi":"triệu đồng","giaTri":"","ghiChu":"2023 tạm giao = KH 2022: 1.872.872"}',
      0, 90);

    -- Suất sự cố
    ins_row(v_sxkd_id, 'GRP_SSC',
      '{"stt":"5","tenChiTieu":"Suất sự cố","donVi":"","giaTri":"","ghiChu":""}',
      0, 100);
    ins_row(v_sxkd_id, 'SSC_DZ_KEO_DAI',
      '{"stt":"5.1","tenChiTieu":"   Đường dây 110kV - Sự cố kéo dài","donVi":"sự cố","giaTri":"","ghiChu":""}',
      0, 110);
    ins_row(v_sxkd_id, 'SSC_DZ_THOANG_QUA',
      '{"stt":"5.2","tenChiTieu":"   Đường dây 110kV - Sự cố thoáng qua","donVi":"sự cố","giaTri":"","ghiChu":""}',
      0, 120);
    ins_row(v_sxkd_id, 'SSC_TBA',
      '{"stt":"5.3","tenChiTieu":"   TBA 110kV","donVi":"sự cố","giaTri":"","ghiChu":""}',
      0, 130);

    -- Độ tin cậy CCĐ
    ins_row(v_sxkd_id, 'GRP_TINCAY',
      '{"stt":"6","tenChiTieu":"Độ tin cậy cung cấp điện","donVi":"","giaTri":"","ghiChu":""}',
      0, 140);
    ins_row(v_sxkd_id, 'MAIFI',
      '{"stt":"6.1","tenChiTieu":"   MAIFI","donVi":"lần","giaTri":"","ghiChu":""}',
      0, 150);
    ins_row(v_sxkd_id, 'SAIDI',
      '{"stt":"6.2","tenChiTieu":"   SAIDI","donVi":"phút","giaTri":"","ghiChu":""}',
      0, 160);
    ins_row(v_sxkd_id, 'SAIFI',
      '{"stt":"6.3","tenChiTieu":"   SAIFI","donVi":"lần","giaTri":"","ghiChu":""}',
      0, 170);

    -- Đào tạo
    ins_row(v_sxkd_id, 'GRP_DAOTAO',
      '{"stt":"7","tenChiTieu":"Kế hoạch đào tạo","donVi":"","giaTri":"","ghiChu":""}',
      0, 180);
    ins_row(v_sxkd_id, 'DT_DAI_HAN_LUOT',
      '{"stt":"7.1","tenChiTieu":"   Đào tạo dài hạn - Lượt","donVi":"lượt","giaTri":"","ghiChu":""}',
      0, 190);
    ins_row(v_sxkd_id, 'DT_DAI_HAN_CP',
      '{"stt":"7.2","tenChiTieu":"   Đào tạo dài hạn - Chi phí","donVi":"triệu đồng","giaTri":"","ghiChu":""}',
      0, 200);
    ins_row(v_sxkd_id, 'DT_NGAN_HAN_LUOT',
      '{"stt":"7.3","tenChiTieu":"   Đào tạo ngắn hạn - Lượt","donVi":"lượt","giaTri":"","ghiChu":""}',
      0, 210);
    ins_row(v_sxkd_id, 'DT_NGAN_HAN_CP',
      '{"stt":"7.4","tenChiTieu":"   Đào tạo ngắn hạn - Chi phí","donVi":"triệu đồng","giaTri":"","ghiChu":""}',
      0, 220);
    ins_row(v_sxkd_id, 'DT_ELEARNING_LUOT',
      '{"stt":"7.5","tenChiTieu":"   E-learning - Lượt","donVi":"lượt","giaTri":"","ghiChu":""}',
      0, 230);
    ins_row(v_sxkd_id, 'DT_ELEARNING_CP',
      '{"stt":"7.6","tenChiTieu":"   E-learning - Chi phí","donVi":"triệu đồng","giaTri":"","ghiChu":""}',
      0, 240);

    ins_row(v_sxkd_id, 'GIUONG_DD_SO',
      '{"stt":"8","tenChiTieu":"Giường điều dưỡng - PHCN lao động","donVi":"giường","giaTri":"","ghiChu":""}',
      0, 250);

    -- ----- Section II: GIÁ BÁN BUÔN ĐIỆN EVN ↔ EVNNPC (PL2) -----
    ins_row(v_sxkd_id, 'SEC_PL2',
      '{"stt":"II","tenChiTieu":"GIÁ BÁN BUÔN ĐIỆN EVN ↔ EVNNPC","donVi":"","giaTri":"","ghiChu":""}',
      1, 260);
    ins_row(v_sxkd_id, 'GBB_CD_T1_3',
      '{"stt":"9.1","tenChiTieu":"Giờ cao điểm tháng 1-3, 10-12","donVi":"đ/kWh","giaTri":"","ghiChu":""}',
      0, 270);
    ins_row(v_sxkd_id, 'GBB_CD_T4_6',
      '{"stt":"9.2","tenChiTieu":"Giờ cao điểm tháng 4-6","donVi":"đ/kWh","giaTri":"","ghiChu":""}',
      0, 280);
    ins_row(v_sxkd_id, 'GBB_CD_T7_9',
      '{"stt":"9.3","tenChiTieu":"Giờ cao điểm tháng 7-9","donVi":"đ/kWh","giaTri":"","ghiChu":""}',
      0, 290);
    ins_row(v_sxkd_id, 'GBB_THAP_DIEM',
      '{"stt":"9.4","tenChiTieu":"Giờ thấp điểm","donVi":"đ/kWh","giaTri":"","ghiChu":""}',
      0, 300);
    ins_row(v_sxkd_id, 'GBB_BINH_THUONG',
      '{"stt":"9.5","tenChiTieu":"Giờ bình thường","donVi":"đ/kWh","giaTri":"","ghiChu":""}',
      0, 310);
    ins_row(v_sxkd_id, 'GBB_BQ_KH',
      '{"stt":"9.6","tenChiTieu":"Giá bình quân kế hoạch","donVi":"đ/kWh","giaTri":"","ghiChu":""}',
      0, 320);

    -- ----- Section III: KẾ HOẠCH VỐN ĐTXD (PL3 tổng hợp) -----
    ins_row(v_sxkd_id, 'SEC_PL3',
      '{"stt":"III","tenChiTieu":"KẾ HOẠCH VỐN ĐẦU TƯ XÂY DỰNG","donVi":"","giaTri":"","ghiChu":""}',
      1, 330);
    ins_row(v_sxkd_id, 'DT_TONG',
      '{"stt":"10","tenChiTieu":"Tổng đầu tư","donVi":"triệu đồng","giaTri":"","ghiChu":"2023: 18.387.000"}',
      0, 340);
    ins_row(v_sxkd_id, 'DT_LUOI_110KV',
      '{"stt":"10.1","tenChiTieu":"   Trong đó: Lưới điện 110kV","donVi":"triệu đồng","giaTri":"","ghiChu":""}',
      0, 350);

    ins_row(v_sxkd_id, 'GRP_NGUON_VON',
      '{"stt":"11","tenChiTieu":"Cơ cấu nguồn vốn","donVi":"","giaTri":"","ghiChu":""}',
      0, 360);
    ins_row(v_sxkd_id, 'DT_VON_NN',
      '{"stt":"11.1","tenChiTieu":"   Vốn nước ngoài","donVi":"triệu đồng","giaTri":"","ghiChu":""}',
      0, 370);
    ins_row(v_sxkd_id, 'DT_VON_TN_VAY',
      '{"stt":"11.2","tenChiTieu":"   Vốn vay trong nước","donVi":"triệu đồng","giaTri":"","ghiChu":""}',
      0, 380);
    ins_row(v_sxkd_id, 'DT_VON_TN_TDTM',
      '{"stt":"11.3","tenChiTieu":"   Vốn TDTM","donVi":"triệu đồng","giaTri":"","ghiChu":""}',
      0, 390);
    ins_row(v_sxkd_id, 'DT_VON_TN_KHCB',
      '{"stt":"11.4","tenChiTieu":"   Vốn KHCB","donVi":"triệu đồng","giaTri":"","ghiChu":""}',
      0, 400);

    ins_row(v_sxkd_id, 'GRP_HANG_MUC',
      '{"stt":"12","tenChiTieu":"Cơ cấu hạng mục","donVi":"","giaTri":"","ghiChu":""}',
      0, 410);
    ins_row(v_sxkd_id, 'DT_XAY_LAP',
      '{"stt":"12.1","tenChiTieu":"   Xây lắp","donVi":"triệu đồng","giaTri":"","ghiChu":""}',
      0, 420);
    ins_row(v_sxkd_id, 'DT_THIET_BI',
      '{"stt":"12.2","tenChiTieu":"   Thiết bị","donVi":"triệu đồng","giaTri":"","ghiChu":""}',
      0, 430);
    ins_row(v_sxkd_id, 'DT_KHAC',
      '{"stt":"12.3","tenChiTieu":"   Khác","donVi":"triệu đồng","giaTri":"","ghiChu":""}',
      0, 440);

    DBMS_OUTPUT.PUT_LINE('Created template KH_SXKD_NAM with id=' || v_sxkd_id);
  END IF;

  -- ============================================================================
  -- 2. Template KH_MUC_TIEU_NAM — mục tiêu định tính (PL4)
  -- ============================================================================
  SELECT COUNT(*) INTO v_existing FROM GRID_TEMPLATE WHERE CODE = 'KH_MUC_TIEU_NAM';
  IF v_existing = 0 THEN
    INSERT INTO GRID_TEMPLATE (
      CODE, NAME, DESCRIPTION,
      COLUMN_CONFIGS, COLUMN_GROUPS,
      STATUS, VERSION, PERIOD_TYPE,
      OWNER_DEPT_CODE,
      CREATED_AT, UPDATED_AT, CREATED_BY, UPDATED_BY
    ) VALUES (
      'KH_MUC_TIEU_NAM',
      N'Chỉ tiêu - nhiệm vụ nâng cao hiệu quả năm Tập đoàn giao',
      N'Mục tiêu định tính EVN giao EVNNPC hằng năm: SXKD, ĐTXD, quản trị doanh nghiệp. Phụ lục 4 quyết định EVN.',
      '[' ||
        '{"headerName":"STT","field":"stt","dataType":"text","width":80,"excelCol":"A"},' ||
        '{"headerName":"Mục tiêu","field":"mucTieu","dataType":"text","width":500,"excelCol":"B"},' ||
        '{"headerName":"Chỉ tiêu định lượng","field":"chiTieuDinhLuong","dataType":"text","width":220,"excelCol":"C"},' ||
        '{"headerName":"Ghi chú","field":"ghiChu","dataType":"text","width":240,"excelCol":"D"}' ||
      ']',
      '[]',
      'PUBLISHED', 1, 'YEAR',
      'BAN_KH',
      SYSTIMESTAMP, SYSTIMESTAMP, 'SYSTEM', 'SYSTEM'
    ) RETURNING ID INTO v_muctieu_id;

    -- ----- Section I: SXKD -----
    ins_row(v_muctieu_id, 'SEC_MT_I',
      '{"stt":"I","mucTieu":"NHIỆM VỤ SẢN XUẤT KINH DOANH","chiTieuDinhLuong":"","ghiChu":""}',
      1, 10);
    ins_row(v_muctieu_id, 'MT_I_1',
      '{"stt":"1.1","mucTieu":"Tỷ lệ thu tiền điện","chiTieuDinhLuong":"≥ 99,7%","ghiChu":""}',
      0, 20);
    ins_row(v_muctieu_id, 'MT_I_2',
      '{"stt":"1.2","mucTieu":"Hệ số bảo toàn vốn","chiTieuDinhLuong":"≥ 1","ghiChu":""}',
      0, 30);
    ins_row(v_muctieu_id, 'MT_I_3',
      '{"stt":"1.3","mucTieu":"Khả năng thanh toán ngắn hạn","chiTieuDinhLuong":"> 1","ghiChu":""}',
      0, 40);
    ins_row(v_muctieu_id, 'MT_I_4',
      '{"stt":"1.4","mucTieu":"Tỷ lệ nợ trên vốn chủ sở hữu","chiTieuDinhLuong":"≤ 3 lần","ghiChu":""}',
      0, 50);
    ins_row(v_muctieu_id, 'MT_I_5',
      '{"stt":"1.5","mucTieu":"Tỷ lệ nợ khó đòi","chiTieuDinhLuong":"≤ 0,02677","ghiChu":""}',
      0, 60);
    ins_row(v_muctieu_id, 'MT_I_6',
      '{"stt":"1.6","mucTieu":"Tỷ lệ KH dùng dịch vụ điện trên môi trường mạng","chiTieuDinhLuong":"≥ 43,8%","ghiChu":""}',
      0, 70);
    ins_row(v_muctieu_id, 'MT_I_7',
      '{"stt":"1.7","mucTieu":"Tỷ lệ KH lắp công tơ điện tử có thu thập dữ liệu từ xa","chiTieuDinhLuong":"≥ 86,47%","ghiChu":""}',
      0, 80);
    ins_row(v_muctieu_id, 'MT_I_8',
      '{"stt":"1.8","mucTieu":"Tỷ lệ KH thanh toán tiền điện không dùng tiền mặt","chiTieuDinhLuong":"≥ 79,27%","ghiChu":""}',
      0, 90);
    ins_row(v_muctieu_id, 'MT_I_9',
      '{"stt":"1.9","mucTieu":"Tỷ lệ yêu cầu KH được tiếp nhận xử lý tự động","chiTieuDinhLuong":"≥ 39,33%","ghiChu":""}',
      0, 100);

    -- ----- Section II: ĐTXD -----
    ins_row(v_muctieu_id, 'SEC_MT_II',
      '{"stt":"II","mucTieu":"NHIỆM VỤ ĐẦU TƯ XÂY DỰNG","chiTieuDinhLuong":"","ghiChu":""}',
      1, 110);
    ins_row(v_muctieu_id, 'MT_II_1',
      '{"stt":"2.1","mucTieu":"Tiết kiệm vốn đầu tư so với TMĐT được duyệt","chiTieuDinhLuong":"≥ 10%","ghiChu":""}',
      0, 120);
    ins_row(v_muctieu_id, 'MT_II_2',
      '{"stt":"2.2","mucTieu":"Áp dụng thiết kế chuẩn và suất đầu tư đối với lưới điện phân phối","chiTieuDinhLuong":"100%","ghiChu":""}',
      0, 130);
    ins_row(v_muctieu_id, 'MT_II_3',
      '{"stt":"2.3","mucTieu":"Đảm bảo an toàn trong ĐTXD - không cháy nổ, không tai nạn chết người","chiTieuDinhLuong":"0 vụ","ghiChu":""}',
      0, 140);
    ins_row(v_muctieu_id, 'MT_II_4',
      '{"stt":"2.4","mucTieu":"Đấu thầu rộng rãi công khai","chiTieuDinhLuong":"Tăng","ghiChu":""}',
      0, 150);
    ins_row(v_muctieu_id, 'MT_II_5',
      '{"stt":"2.5","mucTieu":"Quyết toán đúng thời gian quy định","chiTieuDinhLuong":"100%","ghiChu":""}',
      0, 160);

    -- ----- Section III: Quản trị doanh nghiệp -----
    ins_row(v_muctieu_id, 'SEC_MT_III',
      '{"stt":"III","mucTieu":"NHIỆM VỤ QUẢN TRỊ DOANH NGHIỆP","chiTieuDinhLuong":"","ghiChu":""}',
      1, 170);
    ins_row(v_muctieu_id, 'MT_III_1',
      '{"stt":"3.1","mucTieu":"Cải cách thể chế, cải cách hành chính","chiTieuDinhLuong":"","ghiChu":""}',
      0, 180);
    ins_row(v_muctieu_id, 'MT_III_2',
      '{"stt":"3.2","mucTieu":"Công bố thông tin đầy đủ và đúng hạn (NĐ 47/2021/NĐ-CP)","chiTieuDinhLuong":"100%","ghiChu":""}',
      0, 190);
    ins_row(v_muctieu_id, 'MT_III_3',
      '{"stt":"3.3","mucTieu":"Thoái vốn theo kế hoạch được duyệt","chiTieuDinhLuong":"Theo KH","ghiChu":""}',
      0, 200);
    ins_row(v_muctieu_id, 'MT_III_4',
      '{"stt":"3.4","mucTieu":"Nâng cao hiệu quả sử dụng lao động","chiTieuDinhLuong":"Tăng","ghiChu":""}',
      0, 210);
    ins_row(v_muctieu_id, 'MT_III_5',
      '{"stt":"3.5","mucTieu":"Đảm bảo công tác môi trường của các công trình điện","chiTieuDinhLuong":"100%","ghiChu":""}',
      0, 220);
    ins_row(v_muctieu_id, 'MT_III_6',
      '{"stt":"3.6","mucTieu":"Nâng cao hiệu quả công tác truyền thông","chiTieuDinhLuong":"Tăng","ghiChu":""}',
      0, 230);

    DBMS_OUTPUT.PUT_LINE('Created template KH_MUC_TIEU_NAM with id=' || v_muctieu_id);
  END IF;

  -- ============================================================================
  -- 3. Sidebar menu cho Ban Kế hoạch
  -- ============================================================================
  -- Section cha: "KẾ HOẠCH NĂM"
  SELECT COUNT(*) INTO v_existing FROM SIDEBAR_MENU WHERE MENU_KEY = 'KH_EVN_NAM';
  IF v_existing = 0 THEN
    INSERT INTO SIDEBAR_MENU (MENU_KEY, LABEL, PATH, ICON, SORT_ORDER, PARENT_ID, ORG_GROUP_CODE)
    VALUES ('KH_EVN_NAM', N'KH năm EVN giao', NULL, NULL, 50, NULL, 'EVNNPC');
  END IF;

  -- Lá: Dashboard
  SELECT COUNT(*) INTO v_existing FROM SIDEBAR_MENU WHERE MENU_KEY = 'KH_EVN_NAM__DASHBOARD';
  IF v_existing = 0 THEN
    INSERT INTO SIDEBAR_MENU (MENU_KEY, LABEL, PATH, ICON, SORT_ORDER, PARENT_ID, ORG_GROUP_CODE)
    VALUES ('KH_EVN_NAM__DASHBOARD', N'Dashboard KH năm', '/kh-evn-nam/dashboard', 'tuiIconBarChartLarge', 1,
            (SELECT ID FROM SIDEBAR_MENU WHERE MENU_KEY = 'KH_EVN_NAM'), 'EVNNPC');
  END IF;

  -- Lá: Nhập liệu
  SELECT COUNT(*) INTO v_existing FROM SIDEBAR_MENU WHERE MENU_KEY = 'KH_EVN_NAM__FORM';
  IF v_existing = 0 THEN
    INSERT INTO SIDEBAR_MENU (MENU_KEY, LABEL, PATH, ICON, SORT_ORDER, PARENT_ID, ORG_GROUP_CODE,
                              PERMISSION_RULES)
    VALUES ('KH_EVN_NAM__FORM', N'Nhập KH năm', '/kh-evn-nam/form', 'tuiIconEditLarge', 2,
            (SELECT ID FROM SIDEBAR_MENU WHERE MENU_KEY = 'KH_EVN_NAM'), 'EVNNPC',
            '[{"deptCode":"BAN_KH","positionCodes":[]}]');
  END IF;

  COMMIT;
  DBMS_OUTPUT.PUT_LINE('V11 seed kế hoạch EVN giao: OK');
END;
/
