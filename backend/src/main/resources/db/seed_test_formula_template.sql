-- =============================================================================
-- Seed test template để verify mọi loại công thức ExcelPro.
--
-- Coverage:
--   Tham chiếu cell:
--     - COL          (column-level formula `qty * price`)
--     - ROW_COL      (`r1_price + r2_price + ...`)
--     - ROW          (`MAX(r1, r2, r3, r4)` — dùng cột hiện tại)
--     - EXCEL coord  (`C1 + C2`, `D2 + D3`)
--   Aggregate functions:
--     - SUM(field, fromRow, toRow)
--     - SUMIF(sumField, condField, condValue)
--     - SUMCOL(startCol, endCol, rowCode)
--     - SUMALL(field)
--     - AVGROW(field, fromRow, toRow)
--     - AVGCOL(startCol, endCol, rowCode)
--     - COUNTIF(field, condValue)
--     - VLOOKUP(rowCode, field)
--   Math/Logic:
--     - IF, MAX, MIN, ROUND
--     - Toán tử + - * /
--     - Percentage (%) → tự nhân 1/100
--
-- Sau khi chạy, mở:
--   /excel-builder?templateId=<id-trả-về>
--   (hoặc tạo entry rồi /excel-render?templateId=<id>&entryId=<entryId>)
--
-- Verify: so sánh giá trị cell hiển thị với cột "Expected" trong header comments
-- của từng row dưới đây.
--
-- Run trên Oracle (12c+ vì dùng IDENTITY column).
-- Encoding NLS_CHARACTERSET = AL32UTF8 để giữ tiếng Việt + ký tự Σ/x̄.
-- =============================================================================

DECLARE
  v_template_id NUMBER;
BEGIN

  -- ---------------------------------------------------------------------------
  -- 1. Insert template
  -- ---------------------------------------------------------------------------
  INSERT INTO GRID_TEMPLATE (
    CODE, NAME, DESCRIPTION,
    COLUMN_CONFIGS, COLUMN_GROUPS,
    STATUS, VERSION, PERIOD_TYPE,
    CREATED_AT, UPDATED_AT, CREATED_BY, UPDATED_BY
  ) VALUES (
    'TEST_FORMULA',
    'Test công thức ExcelPro',
    'Template ngắn để verify mọi loại công thức (xem header SQL).',
    -- columnConfigs JSON. excelCol để test EXCEL coord (C1, D2, ...).
    -- Cột E (revenue) và G (net) có column-level formula → áp dụng cho mọi row
    -- không có cell-level override.
    '[' ||
      '{"headerName":"STT","field":"stt","dataType":"text","width":70,"excelCol":"A"},' ||
      '{"headerName":"Tên","field":"name","dataType":"text","width":180,"excelCol":"B"},' ||
      '{"headerName":"SL","field":"qty","dataType":"number","width":90,"excelCol":"C"},' ||
      '{"headerName":"Đơn giá","field":"price","dataType":"number","width":100,"excelCol":"D"},' ||
      '{"headerName":"Doanh thu","field":"revenue","dataType":"number","width":110,"formula":"qty * price","excelCol":"E"},' ||
      '{"headerName":"Chiết khấu","field":"discount","dataType":"number","width":100,"excelCol":"F"},' ||
      '{"headerName":"Thực thu","field":"net","dataType":"number","width":110,"formula":"revenue - revenue * discount","excelCol":"G"},' ||
      '{"headerName":"Phân loại","field":"tier","dataType":"text","width":90,"excelCol":"H"}' ||
    ']',
    '[]',
    'ACTIVE', 1, 'YEAR',
    SYSTIMESTAMP, SYSTIMESTAMP, 'admin', 'admin'
  ) RETURNING ID INTO v_template_id;

  -- ---------------------------------------------------------------------------
  -- 2. Data rows (r1-r4) — raw values, dùng làm input cho mọi formula khác.
  --
  -- Expected (computed qua column-level formula):
  --   r1: revenue = 10*100 = 1000, net = 1000 - 1000*0.1   = 900
  --   r2: revenue =  5*200 = 1000, net = 1000 - 0          = 1000
  --   r3: revenue =  8*150 = 1200, net = 1200 - 1200*0.05  = 1140
  --   r4: revenue =  3*300 =  900, net =  900 -  900*0.2   = 720
  -- ---------------------------------------------------------------------------
  INSERT INTO GRID_ROW (TEMPLATE_ID, ROW_CODE, ROW_DATA, IS_TYPE_HEADER, SORT_ORDER, CREATED_AT, UPDATED_AT, CREATED_BY, UPDATED_BY)
  VALUES (v_template_id, 'r1',
    '{"stt":1,"name":"Item A","qty":10,"price":100,"discount":0.1,"tier":"A"}',
    0, 1, SYSTIMESTAMP, SYSTIMESTAMP, 'admin', 'admin');

  INSERT INTO GRID_ROW (TEMPLATE_ID, ROW_CODE, ROW_DATA, IS_TYPE_HEADER, SORT_ORDER, CREATED_AT, UPDATED_AT, CREATED_BY, UPDATED_BY)
  VALUES (v_template_id, 'r2',
    '{"stt":2,"name":"Item B","qty":5,"price":200,"discount":0,"tier":"B"}',
    0, 2, SYSTIMESTAMP, SYSTIMESTAMP, 'admin', 'admin');

  INSERT INTO GRID_ROW (TEMPLATE_ID, ROW_CODE, ROW_DATA, IS_TYPE_HEADER, SORT_ORDER, CREATED_AT, UPDATED_AT, CREATED_BY, UPDATED_BY)
  VALUES (v_template_id, 'r3',
    '{"stt":3,"name":"Item C","qty":8,"price":150,"discount":0.05,"tier":"A"}',
    0, 3, SYSTIMESTAMP, SYSTIMESTAMP, 'admin', 'admin');

  INSERT INTO GRID_ROW (TEMPLATE_ID, ROW_CODE, ROW_DATA, IS_TYPE_HEADER, SORT_ORDER, CREATED_AT, UPDATED_AT, CREATED_BY, UPDATED_BY)
  VALUES (v_template_id, 'r4',
    '{"stt":4,"name":"Item D","qty":3,"price":300,"discount":0.2,"tier":"B"}',
    0, 4, SYSTIMESTAMP, SYSTIMESTAMP, 'admin', 'admin');

  -- ---------------------------------------------------------------------------
  -- 3. rSum — test SUM aggregate với explicit range r1..r4.
  --
  -- Expected:
  --   qty     = SUM(qty, r1, r4)     = 10+5+8+3      = 26
  --   price   = SUM(price, r1, r4)   = 100+200+150+300 = 750
  --   revenue = SUM(revenue, r1, r4) = 1000+1000+1200+900 = 4100
  --   net     = SUM(net, r1, r4)     = 900+1000+1140+720  = 3760
  -- ---------------------------------------------------------------------------
  INSERT INTO GRID_ROW (TEMPLATE_ID, ROW_CODE, ROW_NAME, ROW_DATA, CELL_CONFIG, IS_TYPE_HEADER, SORT_ORDER, CREATED_AT, UPDATED_AT, CREATED_BY, UPDATED_BY)
  VALUES (v_template_id, 'rSum', NULL,
    '{"stt":"Σ","name":"Tổng (SUM)"}',
    '{' ||
      '"qty":{"formula":"SUM(qty, r1, r4)"},' ||
      '"price":{"formula":"SUM(price, r1, r4)"},' ||
      '"revenue":{"formula":"SUM(revenue, r1, r4)"},' ||
      '"net":{"formula":"SUM(net, r1, r4)"}' ||
    '}',
    0, 5, SYSTIMESTAMP, SYSTIMESTAMP, 'admin', 'admin');

  -- ---------------------------------------------------------------------------
  -- 4. rAvg — test AVGROW + ROW_COL + AVGCOL.
  --
  -- Expected:
  --   qty     = AVGROW(qty, r1, r4)                 = 26/4    = 6.5
  --   price   = (r1_price+r2_price+r3_price+r4_price)/4 = 750/4 = 187.5
  --   revenue = AVGROW(revenue, r1, r4)             = 4100/4  = 1025
  --   net     = AVGCOL(qty, net, r1)                = avg(r1.qty, r1.price, r1.revenue, r1.discount, r1.net)
  --                                                 = (10 + 100 + 1000 + 0.1 + 900) / 5
  --                                                 = 2010.1 / 5 = 402.02
  -- ---------------------------------------------------------------------------
  INSERT INTO GRID_ROW (TEMPLATE_ID, ROW_CODE, ROW_NAME, ROW_DATA, CELL_CONFIG, IS_TYPE_HEADER, SORT_ORDER, CREATED_AT, UPDATED_AT, CREATED_BY, UPDATED_BY)
  VALUES (v_template_id, 'rAvg', NULL,
    '{"stt":"x̄","name":"Trung bình"}',
    '{' ||
      '"qty":{"formula":"AVGROW(qty, r1, r4)"},' ||
      '"price":{"formula":"(r1_price + r2_price + r3_price + r4_price) / 4"},' ||
      '"revenue":{"formula":"AVGROW(revenue, r1, r4)"},' ||
      '"net":{"formula":"AVGCOL(qty, net, r1)"}' ||
    '}',
    0, 6, SYSTIMESTAMP, SYSTIMESTAMP, 'admin', 'admin');

  -- ---------------------------------------------------------------------------
  -- 5. rTier — test SUMIF + COUNTIF.
  --   Phân loại tier "A" gồm r1, r3.
  --   Phân loại tier "B" gồm r2, r4.
  --
  -- Expected:
  --   qty     = SUMIF(qty, tier, "A")     = r1.qty+r3.qty       = 10+8     = 18
  --   price   = COUNTIF(tier, "A")        =                                 = 2
  --   revenue = SUMIF(revenue, tier, "A") = r1.revenue+r3.revenue = 1000+1200 = 2200
  --   net     = SUMIF(net, tier, "B")     = r2.net+r4.net       = 1000+720 = 1720
  -- ---------------------------------------------------------------------------
  INSERT INTO GRID_ROW (TEMPLATE_ID, ROW_CODE, ROW_NAME, ROW_DATA, CELL_CONFIG, IS_TYPE_HEADER, SORT_ORDER, CREATED_AT, UPDATED_AT, CREATED_BY, UPDATED_BY)
  VALUES (v_template_id, 'rTier', NULL,
    '{"stt":"A/B","name":"Phân loại tier"}',
    '{' ||
      '"qty":{"formula":"SUMIF(qty, tier, \"A\")"},' ||
      '"price":{"formula":"COUNTIF(tier, \"A\")"},' ||
      '"revenue":{"formula":"SUMIF(revenue, tier, \"A\")"},' ||
      '"net":{"formula":"SUMIF(net, tier, \"B\")"}' ||
    '}',
    0, 7, SYSTIMESTAMP, SYSTIMESTAMP, 'admin', 'admin');

  -- ---------------------------------------------------------------------------
  -- 6. rExcel — test Excel coord + SUMCOL + VLOOKUP + percentage.
  --
  -- Expected:
  --   qty      = C1 + C2                  → r1.qty + r2.qty       = 10+5  = 15
  --     (C = qty col, 1 = rowOrder index 0 = r1, 2 = rowOrder index 1 = r2)
  --   price    = D2 + D3                  → r2.price + r3.price   = 200+150 = 350
  --   revenue  = SUMCOL(qty, price, r3)   → r3.qty + r3.price     = 8+150 = 158
  --   discount = r1_qty * 50%             → 10 * 0.5              = 5
  --   net      = VLOOKUP(r4, revenue)     → r4.revenue            = 900
  -- ---------------------------------------------------------------------------
  INSERT INTO GRID_ROW (TEMPLATE_ID, ROW_CODE, ROW_NAME, ROW_DATA, CELL_CONFIG, IS_TYPE_HEADER, SORT_ORDER, CREATED_AT, UPDATED_AT, CREATED_BY, UPDATED_BY)
  VALUES (v_template_id, 'rExcel', NULL,
    '{"stt":"E","name":"Excel/Lookup"}',
    '{' ||
      '"qty":{"formula":"C1 + C2"},' ||
      '"price":{"formula":"D2 + D3"},' ||
      '"revenue":{"formula":"SUMCOL(qty, price, r3)"},' ||
      '"discount":{"formula":"r1_qty * 50%"},' ||
      '"net":{"formula":"VLOOKUP(r4, revenue)"}' ||
    '}',
    0, 8, SYSTIMESTAMP, SYSTIMESTAMP, 'admin', 'admin');

  -- ---------------------------------------------------------------------------
  -- 7. rMath — test IF + MAX + MIN + ROUND + SUMALL + ROW ref.
  --
  -- Expected:
  --   qty      = IF(rSum_revenue > 4000, 1, 0) → IF(4100>4000,1,0) = 1
  --   price    = MAX(r1, r2, r3, r4)           → MAX của price ở r1..r4
  --                                            = MAX(100,200,150,300) = 300
  --   revenue  = MIN(r1, r2, r3, r4)           → MIN của revenue ở r1..r4
  --                                            = MIN(1000,1000,1200,900) = 900
  --   discount = SUMALL(qty)                   → tổng qty mọi rows
  --              r1..r4   = 26
  --              rSum.qty = 26
  --              rAvg.qty = 6.5
  --              rTier.qty = 18
  --              rExcel.qty = 15
  --              rMath.qty = 1
  --              total = 92.5
  --   net      = ROUND(rAvg_revenue * 1.5, 0)  → ROUND(1025*1.5, 0) = ROUND(1537.5) = 1538
  --                                              (JS Math.round half-up cho positive)
  -- ---------------------------------------------------------------------------
  INSERT INTO GRID_ROW (TEMPLATE_ID, ROW_CODE, ROW_NAME, ROW_DATA, CELL_CONFIG, IS_TYPE_HEADER, SORT_ORDER, CREATED_AT, UPDATED_AT, CREATED_BY, UPDATED_BY)
  VALUES (v_template_id, 'rMath', NULL,
    '{"stt":"M","name":"Math/Logic"}',
    '{' ||
      '"qty":{"formula":"IF(rSum_revenue > 4000, 1, 0)"},' ||
      '"price":{"formula":"MAX(r1, r2, r3, r4)"},' ||
      '"revenue":{"formula":"MIN(r1, r2, r3, r4)"},' ||
      '"discount":{"formula":"SUMALL(qty)"},' ||
      '"net":{"formula":"ROUND(rAvg_revenue * 1.5, 0)"}' ||
    '}',
    0, 9, SYSTIMESTAMP, SYSTIMESTAMP, 'admin', 'admin');

  COMMIT;

  DBMS_OUTPUT.PUT_LINE('Inserted template TEST_FORMULA with id = ' || v_template_id);
END;
/

-- =============================================================================
-- Verify queries
-- =============================================================================
SELECT id, code, name FROM GRID_TEMPLATE WHERE code = 'TEST_FORMULA';

SELECT row_code, sort_order, row_name FROM GRID_ROW
WHERE template_id = (SELECT id FROM GRID_TEMPLATE WHERE code = 'TEST_FORMULA')
ORDER BY sort_order;

-- =============================================================================
-- Bảng tổng hợp expected values (sau khi load template trong /excel-builder
-- hoặc tạo entry rồi load /excel-render):
--
-- ┌────────┬───────┬────────┬───────┬────────┬─────────┬────────┬───────┬───────┐
-- │ Row    │ stt   │ name   │ qty   │ price  │ revenue │ disct  │ net   │ tier  │
-- ├────────┼───────┼────────┼───────┼────────┼─────────┼────────┼───────┼───────┤
-- │ r1     │ 1     │ Item A │ 10    │ 100    │ 1000    │ 0.1    │ 900   │ A     │
-- │ r2     │ 2     │ Item B │ 5     │ 200    │ 1000    │ 0      │ 1000  │ B     │
-- │ r3     │ 3     │ Item C │ 8     │ 150    │ 1200    │ 0.05   │ 1140  │ A     │
-- │ r4     │ 4     │ Item D │ 3     │ 300    │  900    │ 0.2    │  720  │ B     │
-- │ rSum   │ Σ     │ Tổng   │ 26    │ 750    │ 4100    │ —      │ 3760  │ —     │
-- │ rAvg   │ x̄    │ TB     │ 6.5   │ 187.5  │ 1025    │ —      │ 402.02│ —     │
-- │ rTier  │ A/B   │ tier   │ 18(A) │ 2(cnt) │ 2200(A) │ —      │1720(B)│ —     │
-- │ rExcel │ E     │ Excel  │ 15    │ 350    │ 158     │ 5      │ 900   │ —     │
-- │ rMath  │ M     │ Math   │ 1     │ 300    │ 900     │ 92.5   │ 1538  │ —     │
-- └────────┴───────┴────────┴───────┴────────┴─────────┴────────┴───────┴───────┘
--
-- Mọi cell in đậm (formula computed) phải khớp. Cell tier có cell-level formula
-- KHÔNG được tạo (giữ tier ở các summary rows = null).
-- =============================================================================

-- =============================================================================
-- Rollback (nếu cần xoá template):
-- =============================================================================
-- DELETE FROM GRID_ROW WHERE template_id = (SELECT id FROM GRID_TEMPLATE WHERE code = 'TEST_FORMULA');
-- DELETE FROM GRID_TEMPLATE WHERE code = 'TEST_FORMULA';
-- COMMIT;
