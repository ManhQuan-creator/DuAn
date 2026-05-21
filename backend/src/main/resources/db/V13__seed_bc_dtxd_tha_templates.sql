-- =============================================================================
-- V13 — Seed 5 template báo cáo ĐTXD THA & Khác cấp Tổng công ty
--   + sidebar menu cho Ban Kế hoạch (HQ)
--
-- Tham chiếu spec: docs/3.x.10.md (Báo cáo tổng hợp TCT)
-- Tham chiếu file mẫu: 12.1-12.5 (data Q2/2023 + 2024 từ Ban KH EVNNPC)
--
-- 5 template (đều orgScope='TCT', ownerDeptCode='BAN_KH', status='PUBLISHED'):
--   1) M20  — TH ĐT theo nhóm chương trình toàn TCT (QUARTER)
--   2) M21  — TH ĐT theo giai đoạn giao toàn TCT (QUARTER)
--   3) M27  — TH KH vốn toàn TCT (QUARTER) — DASHBOARD MẪU
--   4) M19  — TH giám sát đánh giá ĐT toàn TCT (HALF_YEAR)
--   5) M18  — TH đánh giá hiệu quả ĐT sau kết thúc toàn TCT (QUARTER)
--
-- Mỗi kỳ Ban KH tạo 1 entry/template (orgCode='TCT', month=3/6/9/12 cho QUARTER,
-- month=6/12 cho HALF_YEAR). Dashboard /bc-dtxd-tha aggregate read-only.
--
-- Idempotent: bao bọc PL/SQL block, skip nếu CODE đã tồn tại.
-- Run thủ công sau khi BE startup chạy schema (ddl-auto=update).
-- =============================================================================

DECLARE
  v_tpl_id     NUMBER;
  v_existing   NUMBER;
  v_section_id NUMBER;
  v_sort       NUMBER;

  -- Helper: insert 1 row vào GRID_ROW
  PROCEDURE ins_row(
    p_template_id IN NUMBER,
    p_row_code    IN VARCHAR2,
    p_row_data    IN CLOB,
    p_is_header   IN NUMBER,
    p_sort_order  IN NUMBER
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

  -- Helper: build JSON row cho M20 (1 đơn vị, 50 metric all blank)
  FUNCTION M20_row(p_stt VARCHAR2, p_donVi VARCHAR2) RETURN VARCHAR2 IS
  BEGIN
    RETURN '{"stt":"' || p_stt || '","donVi":"' || p_donVi || '",' ||
      '"cnSoCT":"","cnTmdt":"","cnHt":"","cnChuaHt":"","cnTyleHt":"",' ||
      '"pbSoCT":"","pbTmdt":"","pbHt":"","pbChuaHt":"","pbTyleHt":"",' ||
      '"bsSoCT":"","bsTmdt":"","bsHt":"","bsChuaHt":"","bsTyleHt":"",' ||
      '"dmsSoCT":"","dmsTmdt":"","dmsHt":"","dmsChuaHt":"","dmsTyleHt":"",' ||
      '"mdmcSoCT":"","mdmcTmdt":"","mdmcHt":"","mdmcChuaHt":"","mdmcTyleHt":"",' ||
      '"xtSoCT":"","xtTmdt":"","xtHt":"","xtChuaHt":"","xtTyleHt":"",' ||
      '"xt1SoCT":"","xt1Tmdt":"","xt1Ht":"","xt1ChuaHt":"","xt1TyleHt":"",' ||
      '"xt2SoCT":"","xt2Tmdt":"","xt2Ht":"","xt2ChuaHt":"","xt2TyleHt":"",' ||
      '"khacSoCT":"","khacTmdt":"","khacHt":"","khacChuaHt":"","khacTyleHt":"",' ||
      '"clSoCT":"","clTmdt":"","clHt":"","clChuaHt":"","clTyleHt":""}';
  END;

  -- Helper: build JSON row cho PL180 (1 đơn vị, 15 metric all blank)
  FUNCTION pl180_row(p_stt VARCHAR2, p_donVi VARCHAR2) RETURN VARCHAR2 IS
  BEGIN
    RETURN '{"stt":"' || p_stt || '","donVi":"' || p_donVi || '",' ||
      '"tongSoCT":"","tongTmdt":"","tongHt":"","tongChuaHt":"","tongTyleHt":"",' ||
      '"truocSoCT":"","truocTmdt":"","truocHt":"","truocChuaHt":"","truocTyleHt":"",' ||
      '"trongSoCT":"","trongTmdt":"","trongHt":"","trongChuaHt":"","trongTyleHt":""}';
  END;
BEGIN

  -- ===========================================================================
  -- 1) M20 — TH ĐT theo nhóm chương trình toàn TCT (QUARTER)
  -- ===========================================================================
  SELECT COUNT(*) INTO v_existing FROM GRID_TEMPLATE WHERE CODE = 'M20';
  IF v_existing = 0 THEN
    INSERT INTO GRID_TEMPLATE (
      CODE, NAME, DESCRIPTION, COLUMN_CONFIGS, COLUMN_GROUPS,
      STATUS, VERSION, PERIOD_TYPE, OWNER_DEPT_CODE,
      CREATED_AT, UPDATED_AT, CREATED_BY, UPDATED_BY
    ) VALUES (
      'M20',
      N'M20 - Báo cáo tổng hợp tình hình thực hiện đầu tư theo nhóm chương trình toàn Tổng công ty',
      N'Tổng hợp tình hình thực hiện đầu tư XD của 24 đơn vị PC theo 10 nhóm chương trình (Cả năm, Phân bổ đầu năm 31/3, Giao bổ sung, DMS, MDMC, Xuất tuyến 1+2+3, Xuất tuyến đợt 1, Xuất tuyến đợt 2, Nhóm khác, Còn lại). Mỗi nhóm gồm 5 cell: Số CT, TMĐT, HT, Chưa HT, %HT/KH.',
      -- columnConfigs: 2 + 10*5 = 52 cột → ~5KB; cần TO_CLOB() prefix để vượt
      -- giới hạn 4000-byte VARCHAR2 trong SQL context (ORA-01489). Bằng cách
      -- ép operand đầu sang CLOB, toàn bộ chain ||  trở thành CLOB||VARCHAR2 →
      -- CLOB (giới hạn 4GB). 4 template kia <3000 bytes nên không cần.
      TO_CLOB('[') ||
        '{"headerName":"STT","field":"stt","dataType":"text","width":60,"excelCol":"A"},' ||
        '{"headerName":"Đơn vị","field":"donVi","dataType":"text","width":140,"excelCol":"B"},' ||
        -- Cả năm
        '{"headerName":"Cả năm: Số CT","field":"cnSoCT","dataType":"number","width":110,"excelCol":"C"},' ||
        '{"headerName":"Cả năm: TMĐT (tr.đ)","field":"cnTmdt","dataType":"number","width":140,"excelCol":"D"},' ||
        '{"headerName":"Cả năm: HT","field":"cnHt","dataType":"number","width":90,"excelCol":"E"},' ||
        '{"headerName":"Cả năm: Chưa HT","field":"cnChuaHt","dataType":"number","width":110,"excelCol":"F"},' ||
        '{"headerName":"Cả năm: % HT/KH","field":"cnTyleHt","dataType":"number","width":110,"excelCol":"G"},' ||
        -- Phân bổ đầu năm
        '{"headerName":"PB đầu năm: Số CT","field":"pbSoCT","dataType":"number","width":120,"excelCol":"H"},' ||
        '{"headerName":"PB đầu năm: TMĐT","field":"pbTmdt","dataType":"number","width":140,"excelCol":"I"},' ||
        '{"headerName":"PB đầu năm: HT","field":"pbHt","dataType":"number","width":100,"excelCol":"J"},' ||
        '{"headerName":"PB đầu năm: Chưa HT","field":"pbChuaHt","dataType":"number","width":120,"excelCol":"K"},' ||
        '{"headerName":"PB đầu năm: % HT","field":"pbTyleHt","dataType":"number","width":110,"excelCol":"L"},' ||
        -- Giao bổ sung
        '{"headerName":"Giao BS: Số CT","field":"bsSoCT","dataType":"number","width":110,"excelCol":"M"},' ||
        '{"headerName":"Giao BS: TMĐT","field":"bsTmdt","dataType":"number","width":140,"excelCol":"N"},' ||
        '{"headerName":"Giao BS: HT","field":"bsHt","dataType":"number","width":100,"excelCol":"O"},' ||
        '{"headerName":"Giao BS: Chưa HT","field":"bsChuaHt","dataType":"number","width":120,"excelCol":"P"},' ||
        '{"headerName":"Giao BS: % HT","field":"bsTyleHt","dataType":"number","width":110,"excelCol":"Q"},' ||
        -- DMS
        '{"headerName":"DMS: Số CT","field":"dmsSoCT","dataType":"number","width":110,"excelCol":"R"},' ||
        '{"headerName":"DMS: TMĐT","field":"dmsTmdt","dataType":"number","width":130,"excelCol":"S"},' ||
        '{"headerName":"DMS: HT","field":"dmsHt","dataType":"number","width":90,"excelCol":"T"},' ||
        '{"headerName":"DMS: Chưa HT","field":"dmsChuaHt","dataType":"number","width":110,"excelCol":"U"},' ||
        '{"headerName":"DMS: % HT","field":"dmsTyleHt","dataType":"number","width":100,"excelCol":"V"},' ||
        -- MDMC
        '{"headerName":"MDMC: Số CT","field":"mdmcSoCT","dataType":"number","width":110,"excelCol":"W"},' ||
        '{"headerName":"MDMC: TMĐT","field":"mdmcTmdt","dataType":"number","width":130,"excelCol":"X"},' ||
        '{"headerName":"MDMC: HT","field":"mdmcHt","dataType":"number","width":90,"excelCol":"Y"},' ||
        '{"headerName":"MDMC: Chưa HT","field":"mdmcChuaHt","dataType":"number","width":110,"excelCol":"Z"},' ||
        '{"headerName":"MDMC: % HT","field":"mdmcTyleHt","dataType":"number","width":100,"excelCol":"AA"},' ||
        -- Xuất tuyến tổng (đợt 1+2+3)
        '{"headerName":"Xuất tuyến: Số CT","field":"xtSoCT","dataType":"number","width":120,"excelCol":"AB"},' ||
        '{"headerName":"Xuất tuyến: TMĐT","field":"xtTmdt","dataType":"number","width":140,"excelCol":"AC"},' ||
        '{"headerName":"Xuất tuyến: HT","field":"xtHt","dataType":"number","width":100,"excelCol":"AD"},' ||
        '{"headerName":"Xuất tuyến: Chưa HT","field":"xtChuaHt","dataType":"number","width":120,"excelCol":"AE"},' ||
        '{"headerName":"Xuất tuyến: % HT","field":"xtTyleHt","dataType":"number","width":110,"excelCol":"AF"},' ||
        -- Xuất tuyến đợt 1
        '{"headerName":"XT đợt 1: Số CT","field":"xt1SoCT","dataType":"number","width":110,"excelCol":"AG"},' ||
        '{"headerName":"XT đợt 1: TMĐT","field":"xt1Tmdt","dataType":"number","width":130,"excelCol":"AH"},' ||
        '{"headerName":"XT đợt 1: HT","field":"xt1Ht","dataType":"number","width":90,"excelCol":"AI"},' ||
        '{"headerName":"XT đợt 1: Chưa HT","field":"xt1ChuaHt","dataType":"number","width":110,"excelCol":"AJ"},' ||
        '{"headerName":"XT đợt 1: % HT","field":"xt1TyleHt","dataType":"number","width":100,"excelCol":"AK"},' ||
        -- Xuất tuyến đợt 2
        '{"headerName":"XT đợt 2: Số CT","field":"xt2SoCT","dataType":"number","width":110,"excelCol":"AL"},' ||
        '{"headerName":"XT đợt 2: TMĐT","field":"xt2Tmdt","dataType":"number","width":130,"excelCol":"AM"},' ||
        '{"headerName":"XT đợt 2: HT","field":"xt2Ht","dataType":"number","width":90,"excelCol":"AN"},' ||
        '{"headerName":"XT đợt 2: Chưa HT","field":"xt2ChuaHt","dataType":"number","width":110,"excelCol":"AO"},' ||
        '{"headerName":"XT đợt 2: % HT","field":"xt2TyleHt","dataType":"number","width":100,"excelCol":"AP"},' ||
        -- Nhóm khác
        '{"headerName":"Khác: Số CT","field":"khacSoCT","dataType":"number","width":100,"excelCol":"AQ"},' ||
        '{"headerName":"Khác: TMĐT","field":"khacTmdt","dataType":"number","width":120,"excelCol":"AR"},' ||
        '{"headerName":"Khác: HT","field":"khacHt","dataType":"number","width":90,"excelCol":"AS"},' ||
        '{"headerName":"Khác: Chưa HT","field":"khacChuaHt","dataType":"number","width":110,"excelCol":"AT"},' ||
        '{"headerName":"Khác: % HT","field":"khacTyleHt","dataType":"number","width":100,"excelCol":"AU"},' ||
        -- Còn lại
        '{"headerName":"Còn lại: Số CT","field":"clSoCT","dataType":"number","width":110,"excelCol":"AV"},' ||
        '{"headerName":"Còn lại: TMĐT","field":"clTmdt","dataType":"number","width":130,"excelCol":"AW"},' ||
        '{"headerName":"Còn lại: HT","field":"clHt","dataType":"number","width":90,"excelCol":"AX"},' ||
        '{"headerName":"Còn lại: Chưa HT","field":"clChuaHt","dataType":"number","width":110,"excelCol":"AY"},' ||
        '{"headerName":"Còn lại: % HT","field":"clTyleHt","dataType":"number","width":100,"excelCol":"AZ"},' ||
        '{"headerName":"Ghi chú","field":"ghiChu","dataType":"text","width":200,"excelCol":"BA"}' ||
      ']',
      '[]',
      'PUBLISHED', 1, 'QUARTER',
      'BAN_KH',
      SYSTIMESTAMP, SYSTIMESTAMP, 'SYSTEM', 'SYSTEM'
    ) RETURNING ID INTO v_tpl_id;

    -- Row tổng cộng (header)
    ins_row(v_tpl_id, 'TONG_CONG',
      '{"stt":"","donVi":"Tổng cộng","cnSoCT":"","cnTmdt":"","cnHt":"","cnChuaHt":"","cnTyleHt":""}',
      1, 10);

    -- 24 đơn vị PC (theo file mẫu 12.4)
    ins_row(v_tpl_id, 'PC_NAM_DINH',    M20_row('1',  N'Nam Định'),    0, 20);
    ins_row(v_tpl_id, 'PC_PHU_THO',     M20_row('2',  N'Phú Thọ'),     0, 30);
    ins_row(v_tpl_id, 'PC_QUANG_NINH',  M20_row('3',  N'Quảng Ninh'),  0, 40);
    ins_row(v_tpl_id, 'PC_THAI_NGUYEN', M20_row('4',  N'Thái Nguyên'), 0, 50);
    ins_row(v_tpl_id, 'PC_BAC_GIANG',   M20_row('5',  N'Bắc Giang'),   0, 60);
    ins_row(v_tpl_id, 'PC_THANH_HOA',   M20_row('6',  N'Thanh Hoá'),   0, 70);
    ins_row(v_tpl_id, 'PC_THAI_BINH',   M20_row('7',  N'Thái Bình'),   0, 80);
    ins_row(v_tpl_id, 'PC_YEN_BAI',     M20_row('8',  N'Yên Bái'),     0, 90);
    ins_row(v_tpl_id, 'PC_LANG_SON',    M20_row('9',  N'Lạng Sơn'),    0, 100);
    ins_row(v_tpl_id, 'PC_TUYEN_QUANG', M20_row('10', N'Tuyên Quang'), 0, 110);
    ins_row(v_tpl_id, 'PC_NGHE_AN',     M20_row('11', N'Nghệ An'),     0, 120);
    ins_row(v_tpl_id, 'PC_CAO_BANG',    M20_row('12', N'Cao Bằng'),    0, 130);
    ins_row(v_tpl_id, 'PC_SON_LA',      M20_row('13', N'Sơn La'),      0, 140);
    ins_row(v_tpl_id, 'PC_HA_TINH',     M20_row('14', N'Hà Tĩnh'),     0, 150);
    ins_row(v_tpl_id, 'PC_HOA_BINH',    M20_row('15', N'Hoà Bình'),    0, 160);
    ins_row(v_tpl_id, 'PC_LAO_CAI',     M20_row('16', N'Lào Cai'),     0, 170);
    ins_row(v_tpl_id, 'PC_DIEN_BIEN',   M20_row('17', N'Điện Biên'),   0, 180);
    ins_row(v_tpl_id, 'PC_HA_GIANG',    M20_row('18', N'Hà Giang'),    0, 190);
    ins_row(v_tpl_id, 'PC_BAC_NINH',    M20_row('19', N'Bắc Ninh'),    0, 200);
    ins_row(v_tpl_id, 'PC_HUNG_YEN',    M20_row('20', N'Hưng Yên'),    0, 210);
    ins_row(v_tpl_id, 'PC_HA_NAM',      M20_row('21', N'Hà Nam'),      0, 220);
    ins_row(v_tpl_id, 'PC_VINH_PHUC',   M20_row('22', N'Vĩnh Phúc'),   0, 230);
    ins_row(v_tpl_id, 'PC_BAC_KAN',     M20_row('23', N'Bắc Kạn'),     0, 240);
    ins_row(v_tpl_id, 'PC_LAI_CHAU',    M20_row('24', N'Lai Châu'),    0, 250);

    DBMS_OUTPUT.PUT_LINE('Created template M20 with id=' || v_tpl_id);
  END IF;

  -- ===========================================================================
  -- 2) PL180 — TH ĐT theo giai đoạn giao toàn TCT (QUARTER)
  -- ===========================================================================
  SELECT COUNT(*) INTO v_existing FROM GRID_TEMPLATE WHERE CODE = 'M21';
  IF v_existing = 0 THEN
    INSERT INTO GRID_TEMPLATE (
      CODE, NAME, DESCRIPTION, COLUMN_CONFIGS, COLUMN_GROUPS,
      STATUS, VERSION, PERIOD_TYPE, OWNER_DEPT_CODE,
      CREATED_AT, UPDATED_AT, CREATED_BY, UPDATED_BY
    ) VALUES (
      'M21',
      N'PL180 - Báo cáo tổng hợp tình hình thực hiện đầu tư theo giai đoạn giao toàn Tổng công ty',
      N'Tổng hợp THĐT XD theo trục thời gian giao kế hoạch của 32 đơn vị: Tổng KH năm, Giao trước 1/1, Giao trong năm 1/1→31/12. Mỗi nhóm gồm 5 cell: Số CT, TMĐT, HT, Chưa HT, %HT/KH.',
      '[' ||
        '{"headerName":"STT","field":"stt","dataType":"text","width":60,"excelCol":"A"},' ||
        '{"headerName":"Đơn vị","field":"donVi","dataType":"text","width":140,"excelCol":"B"},' ||
        -- Tổng KH năm
        '{"headerName":"Tổng KH: Số CT","field":"tongSoCT","dataType":"number","width":110,"excelCol":"C"},' ||
        '{"headerName":"Tổng KH: TMĐT","field":"tongTmdt","dataType":"number","width":140,"excelCol":"D"},' ||
        '{"headerName":"Tổng KH: HT","field":"tongHt","dataType":"number","width":100,"excelCol":"E"},' ||
        '{"headerName":"Tổng KH: Chưa HT","field":"tongChuaHt","dataType":"number","width":120,"excelCol":"F"},' ||
        '{"headerName":"Tổng KH: % HT","field":"tongTyleHt","dataType":"number","width":110,"excelCol":"G"},' ||
        -- Giao trước 1/1
        '{"headerName":"Giao trước 1/1: Số CT","field":"truocSoCT","dataType":"number","width":140,"excelCol":"H"},' ||
        '{"headerName":"Giao trước 1/1: TMĐT","field":"truocTmdt","dataType":"number","width":140,"excelCol":"I"},' ||
        '{"headerName":"Giao trước 1/1: HT","field":"truocHt","dataType":"number","width":120,"excelCol":"J"},' ||
        '{"headerName":"Giao trước 1/1: Chưa HT","field":"truocChuaHt","dataType":"number","width":140,"excelCol":"K"},' ||
        '{"headerName":"Giao trước 1/1: % HT","field":"truocTyleHt","dataType":"number","width":130,"excelCol":"L"},' ||
        -- Giao trong năm
        '{"headerName":"Giao trong năm: Số CT","field":"trongSoCT","dataType":"number","width":140,"excelCol":"M"},' ||
        '{"headerName":"Giao trong năm: TMĐT","field":"trongTmdt","dataType":"number","width":140,"excelCol":"N"},' ||
        '{"headerName":"Giao trong năm: HT","field":"trongHt","dataType":"number","width":120,"excelCol":"O"},' ||
        '{"headerName":"Giao trong năm: Chưa HT","field":"trongChuaHt","dataType":"number","width":140,"excelCol":"P"},' ||
        '{"headerName":"Giao trong năm: % HT","field":"trongTyleHt","dataType":"number","width":130,"excelCol":"Q"},' ||
        '{"headerName":"Ghi chú","field":"ghiChu","dataType":"text","width":200,"excelCol":"R"}' ||
      ']',
      '[]',
      'PUBLISHED', 1, 'QUARTER',
      'BAN_KH',
      SYSTIMESTAMP, SYSTIMESTAMP, 'SYSTEM', 'SYSTEM'
    ) RETURNING ID INTO v_tpl_id;

    -- Row tổng cộng
    ins_row(v_tpl_id, 'TONG_CONG',
      '{"stt":"","donVi":"Tổng cộng","tongSoCT":"","tongTmdt":"","tongHt":"","tongChuaHt":"","tongTyleHt":""}',
      1, 10);

    -- 24 đơn vị PC + 8 đơn vị khác (theo file 12.5)
    ins_row(v_tpl_id, 'PC_NAM_DINH',    pl180_row('1',  N'Nam Định'),    0, 20);
    ins_row(v_tpl_id, 'PC_PHU_THO',     pl180_row('2',  N'Phú Thọ'),     0, 30);
    ins_row(v_tpl_id, 'PC_QUANG_NINH',  pl180_row('3',  N'Quảng Ninh'),  0, 40);
    ins_row(v_tpl_id, 'PC_THAI_NGUYEN', pl180_row('4',  N'Thái Nguyên'), 0, 50);
    ins_row(v_tpl_id, 'PC_BAC_GIANG',   pl180_row('5',  N'Bắc Giang'),   0, 60);
    ins_row(v_tpl_id, 'PC_THANH_HOA',   pl180_row('6',  N'Thanh Hoá'),   0, 70);
    ins_row(v_tpl_id, 'PC_THAI_BINH',   pl180_row('7',  N'Thái Bình'),   0, 80);
    ins_row(v_tpl_id, 'PC_YEN_BAI',     pl180_row('8',  N'Yên Bái'),     0, 90);
    ins_row(v_tpl_id, 'PC_LANG_SON',    pl180_row('9',  N'Lạng Sơn'),    0, 100);
    ins_row(v_tpl_id, 'PC_TUYEN_QUANG', pl180_row('10', N'Tuyên Quang'), 0, 110);
    ins_row(v_tpl_id, 'PC_NGHE_AN',     pl180_row('11', N'Nghệ An'),     0, 120);
    ins_row(v_tpl_id, 'PC_CAO_BANG',    pl180_row('12', N'Cao Bằng'),    0, 130);
    ins_row(v_tpl_id, 'PC_SON_LA',      pl180_row('13', N'Sơn La'),      0, 140);
    ins_row(v_tpl_id, 'PC_HA_TINH',     pl180_row('14', N'Hà Tĩnh'),     0, 150);
    ins_row(v_tpl_id, 'PC_HOA_BINH',    pl180_row('15', N'Hoà Bình'),    0, 160);
    ins_row(v_tpl_id, 'PC_LAO_CAI',     pl180_row('16', N'Lào Cai'),     0, 170);
    ins_row(v_tpl_id, 'PC_DIEN_BIEN',   pl180_row('17', N'Điện Biên'),   0, 180);
    ins_row(v_tpl_id, 'PC_HA_GIANG',    pl180_row('18', N'Hà Giang'),    0, 190);
    ins_row(v_tpl_id, 'PC_BAC_NINH',    pl180_row('19', N'Bắc Ninh'),    0, 200);
    ins_row(v_tpl_id, 'PC_HUNG_YEN',    pl180_row('20', N'Hưng Yên'),    0, 210);
    ins_row(v_tpl_id, 'PC_HA_NAM',      pl180_row('21', N'Hà Nam'),      0, 220);
    ins_row(v_tpl_id, 'PC_VINH_PHUC',   pl180_row('22', N'Vĩnh Phúc'),   0, 230);
    ins_row(v_tpl_id, 'PC_BAC_KAN',     pl180_row('23', N'Bắc Kạn'),     0, 240);
    ins_row(v_tpl_id, 'PC_LAI_CHAU',    pl180_row('24', N'Lai Châu'),    0, 250);
    -- 8 đơn vị khác (NPC IT, TNĐ, KSĐL, CQ NPC, TT CSKH, NPSC, CĐ ĐL, BA3)
    ins_row(v_tpl_id, 'DV_NPC_IT',      pl180_row('25', N'NPC IT'),       0, 260);
    ins_row(v_tpl_id, 'DV_TND',         pl180_row('26', N'TNĐ'),          0, 270);
    ins_row(v_tpl_id, 'DV_KSDL',        pl180_row('27', N'KSĐL'),         0, 280);
    ins_row(v_tpl_id, 'DV_CQ_NPC',      pl180_row('28', N'Cơ quan NPC'),  0, 290);
    ins_row(v_tpl_id, 'DV_TT_CSKH',     pl180_row('29', N'TT CSKH'),      0, 300);
    ins_row(v_tpl_id, 'DV_NPSC',        pl180_row('30', N'NPSC'),         0, 310);
    ins_row(v_tpl_id, 'DV_CD_DL',       pl180_row('31', N'CĐ ĐL'),        0, 320);
    ins_row(v_tpl_id, 'DV_BA3',         pl180_row('32', N'BA3'),          0, 330);

    DBMS_OUTPUT.PUT_LINE('Created template M21 with id=' || v_tpl_id);
  END IF;

  -- ===========================================================================
  -- 3) PL181 — TH KH vốn toàn TCT (QUARTER) — DASHBOARD MẪU ĐỢT 1
  -- ===========================================================================
  SELECT COUNT(*) INTO v_existing FROM GRID_TEMPLATE WHERE CODE = 'M27';
  IF v_existing = 0 THEN
    INSERT INTO GRID_TEMPLATE (
      CODE, NAME, DESCRIPTION, COLUMN_CONFIGS, COLUMN_GROUPS,
      STATUS, VERSION, PERIOD_TYPE, OWNER_DEPT_CODE,
      CREATED_AT, UPDATED_AT, CREATED_BY, UPDATED_BY
    ) VALUES (
      'M27',
      N'PL181 - Báo cáo tổng hợp tình hình thực hiện kế hoạch vốn toàn Tổng công ty',
      N'Tổng hợp THKH vốn ĐT của EVNNPC theo nguồn vốn (Đầu tư công, Vốn nhà nước ngoài ĐTC bao gồm TDTM/Ưu đãi/ODA/KHCB/Tự có/Khác). Đơn vị: triệu đồng. Mỗi kỳ Quý 1 entry/template.',
      '[' ||
        '{"headerName":"TT","field":"stt","dataType":"text","width":80,"excelCol":"A"},' ||
        '{"headerName":"Nội dung","field":"noiDung","dataType":"text","width":420,"excelCol":"B"},' ||
        '{"headerName":"Kế hoạch vốn năm","field":"khVonNam","dataType":"number","width":160,"excelCol":"C"},' ||
        '{"headerName":"Thực hiện - Giá trị","field":"thGtri","dataType":"number","width":160,"excelCol":"D"},' ||
        '{"headerName":"Thực hiện - % so KH","field":"thTle","dataType":"number","width":140,"excelCol":"E"},' ||
        '{"headerName":"Giải ngân - Giá trị","field":"gnGtri","dataType":"number","width":160,"excelCol":"F"},' ||
        '{"headerName":"Giải ngân - % so KH","field":"gnTle","dataType":"number","width":140,"excelCol":"G"},' ||
        '{"headerName":"Tiền thu hồi / giảm trừ","field":"thuHoiGiamTru","dataType":"number","width":160,"excelCol":"H"},' ||
        '{"headerName":"Thất thoát lãng phí","field":"thatThoatLangPhi","dataType":"number","width":160,"excelCol":"I"}' ||
      ']',
      '[]',
      'PUBLISHED', 1, 'QUARTER',
      'BAN_KH',
      SYSTIMESTAMP, SYSTIMESTAMP, 'SYSTEM', 'SYSTEM'
    ) RETURNING ID INTO v_tpl_id;

    -- Row tổng đơn vị NPC
    ins_row(v_tpl_id, 'NPC_TONG',
      '{"stt":"","noiDung":"NPC (tổng toàn đơn vị)","khVonNam":"","thGtri":"","thTle":"","gnGtri":"","gnTle":"","thuHoiGiamTru":"","thatThoatLangPhi":""}',
      1, 10);

    -- Mục I — Dự án đầu tư công
    ins_row(v_tpl_id, 'MUC_I',
      '{"stt":"I","noiDung":"Dự án đầu tư công","khVonNam":"","thGtri":"","thTle":"","gnGtri":"","gnTle":"","thuHoiGiamTru":"","thatThoatLangPhi":""}',
      1, 20);
    ins_row(v_tpl_id, 'I_1_1',
      '{"stt":"1.1","noiDung":"Vốn NSTW trong nước","khVonNam":"","thGtri":"","thTle":"","gnGtri":"","gnTle":"","thuHoiGiamTru":"","thatThoatLangPhi":""}',
      0, 30);
    ins_row(v_tpl_id, 'I_1_2',
      '{"stt":"1.2","noiDung":"Vốn ODA","khVonNam":"","thGtri":"","thTle":"","gnGtri":"","gnTle":"","thuHoiGiamTru":"","thatThoatLangPhi":""}',
      0, 40);

    -- Mục II — Dự án sử dụng vốn nhà nước ngoài ĐTC
    ins_row(v_tpl_id, 'MUC_II',
      '{"stt":"II","noiDung":"Dự án sử dụng vốn nhà nước ngoài vốn ĐTC","khVonNam":"","thGtri":"","thTle":"","gnGtri":"","gnTle":"","thuHoiGiamTru":"","thatThoatLangPhi":""}',
      1, 50);
    ins_row(v_tpl_id, 'II_1',
      '{"stt":"1","noiDung":"Vốn Tín dụng thương mại + Tín dụng ưu đãi","khVonNam":"","thGtri":"","thTle":"","gnGtri":"","gnTle":"","thuHoiGiamTru":"","thatThoatLangPhi":""}',
      0, 60);
    ins_row(v_tpl_id, 'II_1_1',
      '{"stt":"1.1","noiDung":"   Vốn trong nước","khVonNam":"","thGtri":"","thTle":"","gnGtri":"","gnTle":"","thuHoiGiamTru":"","thatThoatLangPhi":""}',
      0, 70);
    ins_row(v_tpl_id, 'II_1_2',
      '{"stt":"1.2","noiDung":"   Vốn nước ngoài (ODA...)","khVonNam":"","thGtri":"","thTle":"","gnGtri":"","gnTle":"","thuHoiGiamTru":"","thatThoatLangPhi":""}',
      0, 80);
    ins_row(v_tpl_id, 'II_2',
      '{"stt":"2","noiDung":"Vốn khác (KHCB, tự có, khác, trả nợ gốc và lãi vay)","khVonNam":"","thGtri":"","thTle":"","gnGtri":"","gnTle":"","thuHoiGiamTru":"","thatThoatLangPhi":""}',
      0, 90);

    DBMS_OUTPUT.PUT_LINE('Created template M27 with id=' || v_tpl_id);
  END IF;

  -- ===========================================================================
  -- 4) PL182 — TH giám sát đánh giá ĐT toàn TCT (HALF_YEAR)
  -- ===========================================================================
  SELECT COUNT(*) INTO v_existing FROM GRID_TEMPLATE WHERE CODE = 'M19';
  IF v_existing = 0 THEN
    INSERT INTO GRID_TEMPLATE (
      CODE, NAME, DESCRIPTION, COLUMN_CONFIGS, COLUMN_GROUPS,
      STATUS, VERSION, PERIOD_TYPE, OWNER_DEPT_CODE,
      CREATED_AT, UPDATED_AT, CREATED_BY, UPDATED_BY
    ) VALUES (
      'M19',
      N'PL182 - Báo cáo tổng hợp tình hình thực hiện giám sát, đánh giá đầu tư toàn Tổng công ty',
      N'Biểu 3.1 theo NĐ 29/2021/NĐ-CP: Đếm số dự án phân loại theo nhóm (QTQG/A/B/C) × nguồn vốn (Đầu tư công / Vốn NN ngoài ĐTC) qua 3 giai đoạn vòng đời (Chuẩn bị / Thực hiện / Kết thúc). Tần suất 6 tháng + Năm.',
      '[' ||
        '{"headerName":"TT","field":"stt","dataType":"text","width":80,"excelCol":"A"},' ||
        '{"headerName":"Nội dung","field":"noiDung","dataType":"text","width":420,"excelCol":"B"},' ||
        '{"headerName":"Tổng cộng","field":"tongCong","dataType":"number","width":110,"excelCol":"C"},' ||
        '{"headerName":"ĐTC: Tổng","field":"dtcTong","dataType":"number","width":110,"excelCol":"D"},' ||
        '{"headerName":"ĐTC: QTQG","field":"dtcQtqg","dataType":"number","width":110,"excelCol":"E"},' ||
        '{"headerName":"ĐTC: A","field":"dtcA","dataType":"number","width":90,"excelCol":"F"},' ||
        '{"headerName":"ĐTC: B","field":"dtcB","dataType":"number","width":90,"excelCol":"G"},' ||
        '{"headerName":"ĐTC: C","field":"dtcC","dataType":"number","width":90,"excelCol":"H"},' ||
        '{"headerName":"NgĐTC: Tổng","field":"ngdtcTong","dataType":"number","width":120,"excelCol":"I"},' ||
        '{"headerName":"NgĐTC: QTQG","field":"ngdtcQtqg","dataType":"number","width":120,"excelCol":"J"},' ||
        '{"headerName":"NgĐTC: A","field":"ngdtcA","dataType":"number","width":100,"excelCol":"K"},' ||
        '{"headerName":"NgĐTC: B","field":"ngdtcB","dataType":"number","width":100,"excelCol":"L"},' ||
        '{"headerName":"NgĐTC: C","field":"ngdtcC","dataType":"number","width":100,"excelCol":"M"}' ||
      ']',
      '[]',
      'PUBLISHED', 1, 'HALF_YEAR',
      'BAN_KH',
      SYSTIMESTAMP, SYSTIMESTAMP, 'SYSTEM', 'SYSTEM'
    ) RETURNING ID INTO v_tpl_id;

    -- Mục I — Chuẩn bị đầu tư
    ins_row(v_tpl_id, 'SEC_I',
      '{"stt":"I","noiDung":"Chuẩn bị đầu tư","tongCong":"","dtcTong":"","dtcQtqg":"","dtcA":"","dtcB":"","dtcC":"","ngdtcTong":"","ngdtcQtqg":"","ngdtcA":"","ngdtcB":"","ngdtcC":""}',
      1, 10);
    ins_row(v_tpl_id, 'I_1',
      '{"stt":"1","noiDung":"Số dự án được quyết định chủ trương trong kỳ (giao A)","tongCong":"","dtcTong":"","dtcQtqg":"","dtcA":"","dtcB":"","dtcC":"","ngdtcTong":"","ngdtcQtqg":"","ngdtcA":"","ngdtcB":"","ngdtcC":""}',
      0, 20);
    ins_row(v_tpl_id, 'I_2',
      '{"stt":"2","noiDung":"Số dự án có quyết định đầu tư trong kỳ (BCNCKT)","tongCong":"","dtcTong":"","dtcQtqg":"","dtcA":"","dtcB":"","dtcC":"","ngdtcTong":"","ngdtcQtqg":"","ngdtcA":"","ngdtcB":"","ngdtcC":""}',
      0, 30);

    -- Mục II — Thực hiện đầu tư
    ins_row(v_tpl_id, 'SEC_II',
      '{"stt":"II","noiDung":"Thực hiện đầu tư (biểu mẫu 3.1)","tongCong":"","dtcTong":"","dtcQtqg":"","dtcA":"","dtcB":"","dtcC":"","ngdtcTong":"","ngdtcQtqg":"","ngdtcA":"","ngdtcB":"","ngdtcC":""}',
      1, 40);
    ins_row(v_tpl_id, 'II_1',
      '{"stt":"1","noiDung":"Số dự án thực hiện đầu tư trong kỳ","tongCong":"","dtcTong":"","dtcQtqg":"","dtcA":"","dtcB":"","dtcC":"","ngdtcTong":"","ngdtcQtqg":"","ngdtcA":"","ngdtcB":"","ngdtcC":""}',
      0, 50);
    ins_row(v_tpl_id, 'II_1_a',
      '{"stt":"1.a","noiDung":"   Số dự án chuyển tiếp","tongCong":"","dtcTong":"","dtcQtqg":"","dtcA":"","dtcB":"","dtcC":"","ngdtcTong":"","ngdtcQtqg":"","ngdtcA":"","ngdtcB":"","ngdtcC":""}',
      0, 60);
    ins_row(v_tpl_id, 'II_1_b',
      '{"stt":"1.b","noiDung":"   Số dự án khởi công mới trong kỳ","tongCong":"","dtcTong":"","dtcQtqg":"","dtcA":"","dtcB":"","dtcC":"","ngdtcTong":"","ngdtcQtqg":"","ngdtcA":"","ngdtcB":"","ngdtcC":""}',
      0, 70);
    ins_row(v_tpl_id, 'II_2',
      '{"stt":"2","noiDung":"Số DA đã báo cáo GSĐT trên HT TT GSĐT (TT 05)","tongCong":"","dtcTong":"","dtcQtqg":"","dtcA":"","dtcB":"","dtcC":"","ngdtcTong":"","ngdtcQtqg":"","ngdtcA":"","ngdtcB":"","ngdtcC":""}',
      0, 80);
    ins_row(v_tpl_id, 'II_3',
      '{"stt":"3","noiDung":"Số DA chưa báo cáo GSĐT trên HT TT GSĐT (TT 05)","tongCong":"","dtcTong":"","dtcQtqg":"","dtcA":"","dtcB":"","dtcC":"","ngdtcTong":"","ngdtcQtqg":"","ngdtcA":"","ngdtcB":"","ngdtcC":""}',
      0, 90);
    ins_row(v_tpl_id, 'II_4',
      '{"stt":"4","noiDung":"Số DA đã kiểm tra trong kỳ","tongCong":"","dtcTong":"","dtcQtqg":"","dtcA":"","dtcB":"","dtcC":"","ngdtcTong":"","ngdtcQtqg":"","ngdtcA":"","ngdtcB":"","ngdtcC":""}',
      0, 100);
    ins_row(v_tpl_id, 'II_5',
      '{"stt":"5","noiDung":"Số DA đã đánh giá trong kỳ","tongCong":"","dtcTong":"","dtcQtqg":"","dtcA":"","dtcB":"","dtcC":"","ngdtcTong":"","ngdtcQtqg":"","ngdtcA":"","ngdtcB":"","ngdtcC":""}',
      0, 110);
    ins_row(v_tpl_id, 'II_6',
      '{"stt":"6","noiDung":"Số DA có vi phạm thủ tục đầu tư","tongCong":"","dtcTong":"","dtcQtqg":"","dtcA":"","dtcB":"","dtcC":"","ngdtcTong":"","ngdtcQtqg":"","ngdtcA":"","ngdtcB":"","ngdtcC":""}',
      0, 120);
    ins_row(v_tpl_id, 'II_6_a',
      '{"stt":"6.a","noiDung":"   Không phù hợp với quy hoạch","tongCong":"","dtcTong":"","dtcQtqg":"","dtcA":"","dtcB":"","dtcC":"","ngdtcTong":"","ngdtcQtqg":"","ngdtcA":"","ngdtcB":"","ngdtcC":""}',
      0, 130);
    ins_row(v_tpl_id, 'II_6_b',
      '{"stt":"6.b","noiDung":"   Phê duyệt không đúng thẩm quyền","tongCong":"","dtcTong":"","dtcQtqg":"","dtcA":"","dtcB":"","dtcC":"","ngdtcTong":"","ngdtcQtqg":"","ngdtcA":"","ngdtcB":"","ngdtcC":""}',
      0, 140);
    ins_row(v_tpl_id, 'II_6_c',
      '{"stt":"6.c","noiDung":"   Không thực hiện đầy đủ trình tự thẩm tra, thẩm định","tongCong":"","dtcTong":"","dtcQtqg":"","dtcA":"","dtcB":"","dtcC":"","ngdtcTong":"","ngdtcQtqg":"","ngdtcA":"","ngdtcB":"","ngdtcC":""}',
      0, 150);
    ins_row(v_tpl_id, 'II_7',
      '{"stt":"7","noiDung":"Số DA có vi phạm quản lý chất lượng","tongCong":"","dtcTong":"","dtcQtqg":"","dtcA":"","dtcB":"","dtcC":"","ngdtcTong":"","ngdtcQtqg":"","ngdtcA":"","ngdtcB":"","ngdtcC":""}',
      0, 160);
    ins_row(v_tpl_id, 'II_8',
      '{"stt":"8","noiDung":"Số DA có thất thoát, lãng phí phát hiện trong kỳ","tongCong":"","dtcTong":"","dtcQtqg":"","dtcA":"","dtcB":"","dtcC":"","ngdtcTong":"","ngdtcQtqg":"","ngdtcA":"","ngdtcB":"","ngdtcC":""}',
      0, 170);
    ins_row(v_tpl_id, 'II_9',
      '{"stt":"9","noiDung":"Số dự án chậm tiến độ trong kỳ","tongCong":"","dtcTong":"","dtcQtqg":"","dtcA":"","dtcB":"","dtcC":"","ngdtcTong":"","ngdtcQtqg":"","ngdtcA":"","ngdtcB":"","ngdtcC":""}',
      0, 180);
    ins_row(v_tpl_id, 'II_9_a',
      '{"stt":"9.a","noiDung":"   Chậm do thủ tục đầu tư","tongCong":"","dtcTong":"","dtcQtqg":"","dtcA":"","dtcB":"","dtcC":"","ngdtcTong":"","ngdtcQtqg":"","ngdtcA":"","ngdtcB":"","ngdtcC":""}',
      0, 190);
    ins_row(v_tpl_id, 'II_9_b',
      '{"stt":"9.b","noiDung":"   Chậm do GPMB","tongCong":"","dtcTong":"","dtcQtqg":"","dtcA":"","dtcB":"","dtcC":"","ngdtcTong":"","ngdtcQtqg":"","ngdtcA":"","ngdtcB":"","ngdtcC":""}',
      0, 200);
    ins_row(v_tpl_id, 'II_9_c',
      '{"stt":"9.c","noiDung":"   Chậm do năng lực CĐT/BQLDA/Nhà thầu","tongCong":"","dtcTong":"","dtcQtqg":"","dtcA":"","dtcB":"","dtcC":"","ngdtcTong":"","ngdtcQtqg":"","ngdtcA":"","ngdtcB":"","ngdtcC":""}',
      0, 210);
    ins_row(v_tpl_id, 'II_9_d',
      '{"stt":"9.d","noiDung":"   Chậm do bố trí vốn không kịp thời","tongCong":"","dtcTong":"","dtcQtqg":"","dtcA":"","dtcB":"","dtcC":"","ngdtcTong":"","ngdtcQtqg":"","ngdtcA":"","ngdtcB":"","ngdtcC":""}',
      0, 220);
    ins_row(v_tpl_id, 'II_9_e',
      '{"stt":"9.đ","noiDung":"   Chậm do nguyên nhân khác","tongCong":"","dtcTong":"","dtcQtqg":"","dtcA":"","dtcB":"","dtcC":"","ngdtcTong":"","ngdtcQtqg":"","ngdtcA":"","ngdtcB":"","ngdtcC":""}',
      0, 230);
    ins_row(v_tpl_id, 'II_10',
      '{"stt":"10","noiDung":"Số DA phải điều chỉnh chủ trương đầu tư trong kỳ","tongCong":"","dtcTong":"","dtcQtqg":"","dtcA":"","dtcB":"","dtcC":"","ngdtcTong":"","ngdtcQtqg":"","ngdtcA":"","ngdtcB":"","ngdtcC":""}',
      0, 240);
    ins_row(v_tpl_id, 'II_11',
      '{"stt":"11","noiDung":"Số DA phải điều chỉnh quyết định đầu tư trong kỳ","tongCong":"","dtcTong":"","dtcQtqg":"","dtcA":"","dtcB":"","dtcC":"","ngdtcTong":"","ngdtcQtqg":"","ngdtcA":"","ngdtcB":"","ngdtcC":""}',
      0, 250);
    ins_row(v_tpl_id, 'II_12',
      '{"stt":"12","noiDung":"Số DA phải ngừng thực hiện","tongCong":"","dtcTong":"","dtcQtqg":"","dtcA":"","dtcB":"","dtcC":"","ngdtcTong":"","ngdtcQtqg":"","ngdtcA":"","ngdtcB":"","ngdtcC":""}',
      0, 260);
    ins_row(v_tpl_id, 'II_13',
      '{"stt":"13","noiDung":"Số DA thực hiện lựa chọn nhà thầu trong kỳ","tongCong":"","dtcTong":"","dtcQtqg":"","dtcA":"","dtcB":"","dtcC":"","ngdtcTong":"","ngdtcQtqg":"","ngdtcA":"","ngdtcB":"","ngdtcC":""}',
      0, 270);

    -- Mục III — Kết thúc đầu tư
    ins_row(v_tpl_id, 'SEC_III',
      '{"stt":"III","noiDung":"Kết thúc đầu tư, bàn giao đưa vào sử dụng","tongCong":"","dtcTong":"","dtcQtqg":"","dtcA":"","dtcB":"","dtcC":"","ngdtcTong":"","ngdtcQtqg":"","ngdtcA":"","ngdtcB":"","ngdtcC":""}',
      1, 280);
    ins_row(v_tpl_id, 'III_1',
      '{"stt":"1","noiDung":"Số DA kết thúc đầu tư trong kỳ (IMIS)","tongCong":"","dtcTong":"","dtcQtqg":"","dtcA":"","dtcB":"","dtcC":"","ngdtcTong":"","ngdtcQtqg":"","ngdtcA":"","ngdtcB":"","ngdtcC":""}',
      0, 290);
    ins_row(v_tpl_id, 'III_2',
      '{"stt":"2","noiDung":"Lũy kế số DA đã kết thúc chưa quyết toán (IMIS)","tongCong":"","dtcTong":"","dtcQtqg":"","dtcA":"","dtcB":"","dtcC":"","ngdtcTong":"","ngdtcQtqg":"","ngdtcA":"","ngdtcB":"","ngdtcC":""}',
      0, 300);
    ins_row(v_tpl_id, 'III_3',
      '{"stt":"3","noiDung":"Số DA được quyết toán trong kỳ (IMIS)","tongCong":"","dtcTong":"","dtcQtqg":"","dtcA":"","dtcB":"","dtcC":"","ngdtcTong":"","ngdtcQtqg":"","ngdtcA":"","ngdtcB":"","ngdtcC":""}',
      0, 310);
    ins_row(v_tpl_id, 'III_4',
      '{"stt":"4","noiDung":"Tình hình khai thác vận hành","tongCong":"","dtcTong":"","dtcQtqg":"","dtcA":"","dtcB":"","dtcC":"","ngdtcTong":"","ngdtcQtqg":"","ngdtcA":"","ngdtcB":"","ngdtcC":""}',
      0, 320);
    ins_row(v_tpl_id, 'III_4_a',
      '{"stt":"4.a","noiDung":"   Số DA đã đưa vào vận hành","tongCong":"","dtcTong":"","dtcQtqg":"","dtcA":"","dtcB":"","dtcC":"","ngdtcTong":"","ngdtcQtqg":"","ngdtcA":"","ngdtcB":"","ngdtcC":""}',
      0, 330);
    ins_row(v_tpl_id, 'III_4_b',
      '{"stt":"4.b","noiDung":"   Số DA có vấn đề kỹ thuật / không hiệu quả","tongCong":"","dtcTong":"","dtcQtqg":"","dtcA":"","dtcB":"","dtcC":"","ngdtcTong":"","ngdtcQtqg":"","ngdtcA":"","ngdtcB":"","ngdtcC":""}',
      0, 340);
    ins_row(v_tpl_id, 'III_4_c',
      '{"stt":"4.c","noiDung":"   Số DA được đánh giá tác động trong kỳ","tongCong":"","dtcTong":"","dtcQtqg":"","dtcA":"","dtcB":"","dtcC":"","ngdtcTong":"","ngdtcQtqg":"","ngdtcA":"","ngdtcB":"","ngdtcC":""}',
      0, 350);

    DBMS_OUTPUT.PUT_LINE('Created template M19 with id=' || v_tpl_id);
  END IF;

  -- ===========================================================================
  -- 5) PL183 — TH đánh giá hiệu quả ĐT sau kết thúc (QUARTER)
  --    KHÔNG seed template rows — mỗi dự án = 1 custom row do NSD thêm (như V12).
  -- ===========================================================================
  SELECT COUNT(*) INTO v_existing FROM GRID_TEMPLATE WHERE CODE = 'M18';
  IF v_existing = 0 THEN
    INSERT INTO GRID_TEMPLATE (
      CODE, NAME, DESCRIPTION, COLUMN_CONFIGS, COLUMN_GROUPS,
      STATUS, VERSION, PERIOD_TYPE, OWNER_DEPT_CODE,
      CREATED_AT, UPDATED_AT, CREATED_BY, UPDATED_BY
    ) VALUES (
      'M18',
      N'PL183 - Báo cáo tổng hợp đánh giá hiệu quả đầu tư dự án sau khi kết thúc xây dựng công trình toàn Tổng công ty',
      N'Liệt kê dự án đã kết thúc đầu tư trong kỳ. So sánh BCNCKT (phê duyệt) vs Thực tế thực hiện trên các chỉ tiêu: quy mô CT, TMĐT, tiến độ, ΔA%, SAIDI, NPV, FIRR, giá trị tăng thêm hoặc thiệt hại. Mỗi dự án = 1 custom row trong /excel-render.',
      '[' ||
        '{"headerName":"STT","field":"stt","dataType":"text","width":60,"excelCol":"A"},' ||
        '{"headerName":"Danh mục dự án","field":"danhMucDuAn","dataType":"text","width":320,"excelCol":"B"},' ||
        '{"headerName":"PC","field":"pc","dataType":"text","width":120,"excelCol":"C"},' ||
        '{"headerName":"Đơn vị thực hiện","field":"donViTH","dataType":"text","width":130,"excelCol":"D"},' ||
        '{"headerName":"Cấp điện áp","field":"capDienAp","dataType":"text","width":120,"excelCol":"E"},' ||
        '{"headerName":"Quy mô điện - BCNCKT","field":"qmDienBcnckt","dataType":"text","width":160,"excelCol":"F"},' ||
        '{"headerName":"Quy mô điện - Thực tế","field":"qmDienTt","dataType":"text","width":160,"excelCol":"G"},' ||
        '{"headerName":"Quy mô khác - BCNCKT","field":"qmKhacBcnckt","dataType":"text","width":160,"excelCol":"H"},' ||
        '{"headerName":"Quy mô khác - Thực tế","field":"qmKhacTt","dataType":"text","width":160,"excelCol":"I"},' ||
        '{"headerName":"TMĐT (tr.đ)","field":"tmdt","dataType":"number","width":130,"excelCol":"J"},' ||
        '{"headerName":"Chi phí ĐT thực tế (tr.đ)","field":"chiPhiTt","dataType":"number","width":160,"excelCol":"K"},' ||
        '{"headerName":"Tiến độ KH","field":"tienDoKh","dataType":"text","width":130,"excelCol":"L"},' ||
        '{"headerName":"Tiến độ TT","field":"tienDoTt","dataType":"text","width":130,"excelCol":"M"},' ||
        '{"headerName":"ΔA% - BCNCKT","field":"deltaAKh","dataType":"number","width":120,"excelCol":"N"},' ||
        '{"headerName":"SAIDI - BCNCKT (phút/KH)","field":"saidiKh","dataType":"number","width":160,"excelCol":"O"},' ||
        '{"headerName":"NPV - BCNCKT (tr.đ)","field":"npvKh","dataType":"number","width":140,"excelCol":"P"},' ||
        '{"headerName":"FIRR - BCNCKT (%)","field":"firrKh","dataType":"number","width":130,"excelCol":"Q"},' ||
        '{"headerName":"ΔA% - Thực tế","field":"deltaATt","dataType":"number","width":120,"excelCol":"R"},' ||
        '{"headerName":"SAIDI - Thực tế","field":"saidiTt","dataType":"number","width":140,"excelCol":"S"},' ||
        '{"headerName":"NPV - Thực tế","field":"npvTt","dataType":"number","width":130,"excelCol":"T"},' ||
        '{"headerName":"FIRR - Thực tế","field":"firrTt","dataType":"number","width":130,"excelCol":"U"},' ||
        '{"headerName":"Giá trị tăng/thiệt hại (tr.đ)","field":"giaTriTangThiet","dataType":"number","width":180,"excelCol":"V"},' ||
        '{"headerName":"Ghi chú","field":"ghiChu","dataType":"text","width":160,"excelCol":"W"},' ||
        '{"headerName":"Tư vấn FS","field":"tuVanFs","dataType":"text","width":200,"excelCol":"X"}' ||
      ']',
      '[]',
      'PUBLISHED', 1, 'QUARTER',
      'BAN_KH',
      SYSTIMESTAMP, SYSTIMESTAMP, 'SYSTEM', 'SYSTEM'
    ) RETURNING ID INTO v_tpl_id;

    DBMS_OUTPUT.PUT_LINE('Created template M18 with id=' || v_tpl_id);
  END IF;

  -- ===========================================================================
  -- 6) Sidebar menu cho Ban Kế hoạch (HQ EVNNPC)
  -- ===========================================================================
  -- Section cha: "Báo cáo ĐTXD THA & Khác"
  SELECT COUNT(*) INTO v_existing FROM SIDEBAR_MENU WHERE MENU_KEY = 'BC_DTXD_THA';
  IF v_existing = 0 THEN
    INSERT INTO SIDEBAR_MENU (MENU_KEY, LABEL, PATH, ICON, SORT_ORDER, PARENT_ID, ORG_GROUP_CODE)
    VALUES ('BC_DTXD_THA', N'Báo cáo ĐTXD THA', NULL, NULL, 58, NULL, 'EVNNPC');
  END IF;

  -- Lá: Dashboard duy nhất (page cha với 5 tab)
  SELECT COUNT(*) INTO v_existing FROM SIDEBAR_MENU WHERE MENU_KEY = 'BC_DTXD_THA__DASHBOARD';
  IF v_existing = 0 THEN
    INSERT INTO SIDEBAR_MENU (MENU_KEY, LABEL, PATH, ICON, SORT_ORDER, PARENT_ID, ORG_GROUP_CODE)
    VALUES ('BC_DTXD_THA__DASHBOARD', N'Dashboard ĐTXD THA', '/bc-dtxd-tha',
            'tuiIconBarChartLarge', 1,
            (SELECT ID FROM SIDEBAR_MENU WHERE MENU_KEY = 'BC_DTXD_THA'), 'EVNNPC');
  END IF;

  COMMIT;
  DBMS_OUTPUT.PUT_LINE('V13 seed BC ĐTXD THA: OK');
END;
/
