-- =============================================================================
-- V12 — Seed template "Báo cáo tổng hợp dự án ĐTXD 110kV"
--   + sidebar menu entries cho Ban Quản lý đầu tư
--
-- Tham chiếu mẫu báo cáo: docs/Mẫu báo cáo tổng hợp dự án ĐTXD 110kV.md
--
-- 1 template:
--   - DTXD_110KV_TONG_HOP  — danh sách dự án ĐTXD lưới 110kV toàn EVNNPC
--
-- periodType = YEAR, ownerDeptCode = BAN_KH.
-- Mỗi năm Ban QLĐT (HQ) tổng hợp 1 entry (orgCode='EVNNPC') chứa toàn bộ
-- danh sách dự án 110kV thuộc các PC. Mỗi dự án = 1 custom row trong rowData.
--
-- KHÔNG seed sẵn dữ liệu mẫu — NSD vào /excel-render thêm từng dự án qua
-- "Chỉnh sửa bảng" → "Thêm dòng" (custom row, _isCustomRow=true).
--
-- Idempotent: bao bọc trong block PL/SQL, skip nếu template đã tồn tại.
-- Run thủ công sau khi BE startup tạo schema (ddl-auto=update).
-- =============================================================================

DECLARE
  v_tpl_id   NUMBER;
  v_existing NUMBER;
BEGIN

  -- ============================================================================
  -- 1. Template DTXD_110KV_TONG_HOP — 16 cột theo mẫu báo cáo
  -- ============================================================================
  SELECT COUNT(*) INTO v_existing FROM GRID_TEMPLATE WHERE CODE = 'DTXD_110KV_TONG_HOP';
  IF v_existing = 0 THEN
    INSERT INTO GRID_TEMPLATE (
      CODE, NAME, DESCRIPTION,
      COLUMN_CONFIGS, COLUMN_GROUPS,
      STATUS, VERSION, PERIOD_TYPE,
      OWNER_DEPT_CODE,
      CREATED_AT, UPDATED_AT, CREATED_BY, UPDATED_BY
    ) VALUES (
      'DTXD_110KV_TONG_HOP',
      N'Báo cáo tổng hợp dự án ĐTXD 110kV',
      N'Danh mục dự án đầu tư xây dựng lưới điện 110kV toàn EVNNPC. Mỗi năm tổng hợp 1 lần ở HQ (orgCode=EVNNPC), liệt kê dự án theo PC quản lý, công suất, chiều dài, TMĐT, tình trạng và mốc tiến độ khởi công - hoàn thành (KH vs TT).',
      -- columnConfigs: 16 cột theo file md mẫu
      '[' ||
        '{"headerName":"STT","field":"stt","dataType":"text","width":60,"excelCol":"A"},' ||
        '{"headerName":"Tên dự án","field":"tenDuAn","dataType":"text","width":320,"excelCol":"B"},' ||
        '{"headerName":"Mã dự án","field":"maDuAn","dataType":"text","width":180,"excelCol":"C"},' ||
        '{"headerName":"Đơn vị QLDA","field":"donViQlda","dataType":"text","width":140,"excelCol":"D"},' ||
        '{"headerName":"Địa điểm","field":"diaDiem","dataType":"text","width":130,"excelCol":"E"},' ||
        '{"headerName":"Chiều dài (km)","field":"chieuDai","dataType":"text","width":120,"excelCol":"F"},' ||
        '{"headerName":"Công suất (MVA)","field":"congSuat","dataType":"number","width":130,"excelCol":"G"},' ||
        '{"headerName":"Loại hình","field":"loaiHinh","dataType":"text","width":160,"excelCol":"H"},' ||
        '{"headerName":"Số QĐ giao dự án","field":"soQd","dataType":"text","width":170,"excelCol":"I"},' ||
        '{"headerName":"Ngày giao","field":"ngayGiao","dataType":"date","width":130,"excelCol":"J"},' ||
        '{"headerName":"Giá trị TMĐT (triệu đồng)","field":"giaTmdt","dataType":"number","width":170,"excelCol":"K"},' ||
        '{"headerName":"Tình trạng","field":"tinhTrang","dataType":"text","width":200,"excelCol":"L"},' ||
        '{"headerName":"Khởi công KH","field":"khoiCongKh","dataType":"date","width":130,"excelCol":"M"},' ||
        '{"headerName":"Hoàn thành KH","field":"hoanThanhKh","dataType":"date","width":130,"excelCol":"N"},' ||
        '{"headerName":"Khởi công TT","field":"khoiCongTt","dataType":"date","width":130,"excelCol":"O"},' ||
        '{"headerName":"Hoàn thành TT","field":"hoanThanhTt","dataType":"date","width":130,"excelCol":"P"}' ||
      ']',
      '[]',
      'PUBLISHED', 1, 'YEAR',
      'BAN_KH',
      SYSTIMESTAMP, SYSTIMESTAMP, 'SYSTEM', 'SYSTEM'
    ) RETURNING ID INTO v_tpl_id;

    -- KHÔNG insert GRID_ROW: template không có dòng cố định, mỗi dự án là 1
    -- custom row do NSD thêm trong /excel-render → tự sinh row_code dạng RX*.
    DBMS_OUTPUT.PUT_LINE('Created template DTXD_110KV_TONG_HOP with id=' || v_tpl_id);
  END IF;

  -- ============================================================================
  -- 2. Sidebar menu cho Ban Quản lý đầu tư
  -- ============================================================================
  -- Section cha: "ĐTXD 110kV"
  SELECT COUNT(*) INTO v_existing FROM SIDEBAR_MENU WHERE MENU_KEY = 'DTXD_110KV';
  IF v_existing = 0 THEN
    INSERT INTO SIDEBAR_MENU (MENU_KEY, LABEL, PATH, ICON, SORT_ORDER, PARENT_ID, ORG_GROUP_CODE)
    VALUES ('DTXD_110KV', N'ĐTXD lưới 110kV', NULL, NULL, 55, NULL, 'EVNNPC');
  END IF;

  -- Lá: Dashboard
  SELECT COUNT(*) INTO v_existing FROM SIDEBAR_MENU WHERE MENU_KEY = 'DTXD_110KV__DASHBOARD';
  IF v_existing = 0 THEN
    INSERT INTO SIDEBAR_MENU (MENU_KEY, LABEL, PATH, ICON, SORT_ORDER, PARENT_ID, ORG_GROUP_CODE)
    VALUES ('DTXD_110KV__DASHBOARD', N'Dashboard ĐTXD 110kV', '/dtxd-110kv/dashboard',
            'tuiIconBarChartLarge', 1,
            (SELECT ID FROM SIDEBAR_MENU WHERE MENU_KEY = 'DTXD_110KV'), 'EVNNPC');
  END IF;

  COMMIT;
  DBMS_OUTPUT.PUT_LINE('V12 seed DTXD 110kV: OK');
END;
/
