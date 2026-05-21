package org.example.oracleconnectionpool.constant;

public class Constant {
    public static final class ExtensionFile {
        public static final String XLSX = ".xlsx";
        public static final String XLS = ".xls";
        public static final String ZIP = ".zip";
    }

    public static final class OrgGroupCode {
        public static final String PC_COMPANY = "PC_COMPANY";
        public static final String EVNNPC = "EVNNPC";
    }

    public static final class DeptCode {
        public static final String BAN_KH = "BAN_KH";
    }

    public static final class PositionCode {
        public static final String GD = "GD";
        public static final String PGD = "PGD";
    }

    public static final class TEMPLATE_CONFIG {

        public static final String STT_COL_CODE = "STT";

        //Cấu hình biểu mẫu ĐĂNG KÝ BỔ SUNG KẾ HOẠCH DANH MỤC SCL NĂM ${N}
        public static final class PL158 {
            public static final String CODE = "PL158";
            public static final String TOTAL_ROW_CODE = "R1";
            public static final String GTKT_COL_CODE = "D";
            public static final String GTCPSQL_COL_CODE = "E";
            public static final String CATEGORY_NAME_COL_CODE = "A";
            public static final String CATEGORY_CODE_COL_CODE = "B";
            public static final String CONTENT_COL_CODE = "C";
            public static final String NOTE_COL_CODE = "F";

        }

        //Cấu hình biểu mẫu ĐĂNG KÝ KẾ HOẠCH DANH MỤC SCL NĂM ${N}
        public static final class PL159 {
            public static final String CODE = "PL159";
            public static final String TOTAL_ROW_CODE = "R1";
            public static final String GTKT_COL_CODE = "D";
            public static final String GTCPSQL_COL_CODE = "E";
            public static final String CATEGORY_NAME_COL_CODE = "A";
            public static final String CATEGORY_CODE_COL_CODE = "B";
            public static final String CONTENT_COL_CODE = "C";
            public static final String NOTE_COL_CODE = "F";
        }

        //Cấu hình biểu mẫu TỔNG HỢP GIÁ TRỊ KHÁI TOÁN VÀ CHI PHÍ SCL LƯỚI ĐIỆN 110KV NĂM N CỦA CÁC ĐƠN VỊ
        public static final class PL160 {
            public static final String CODE = "PL160";
            public static final String SO_LUONG_DN_COL_CODE = "sldn";
            public static final String SO_LUONG_BS_COL_CODE = "slbs";
            public static final String SO_LUONG_COL_CODE = "sl";
            public static final String GTKT_DN_COL_CODE = "gtktdn";
            public static final String GTKT_BS_COL_CODE = "gtktbs";
            public static final String GTKT_COL_CODE = "gtkt";
            public static final String GTCP_DN_COL_CODE = "gtcpdn";
            public static final String GTCP_BS_COL_CODE = "gtcpbs";
            public static final String GTCP_COL_CODE = "gtcp";
        }

        //Cấu hình biểu mẫu TỔNG HỢP CÁC HẠNG MỤC SCL LƯỚI ĐIỆN 110kV NĂM ${N} CỦA CÁC ĐƠN VỊ
        public static final class PL161 {
            public static final String CODE = "PL161";
            public static final String TEN_HANG_MUC_COL_CODE = "TENHANGMUC";
            public static final String MA_SO_TAI_SAN_COL_CODE = "MSTSCDSSKT";
            public static final String NOI_DUNG_SUA_CHUA_COL_CODE = "NOIDUNGSUACHUA";
            public static final String GIA_TRI_KHAI_TOAN_COL_CODE = "GIATRIKHAITOAN";
            public static final String GIA_TRI_CHI_PHI_COL_CODE = "GIATRICHIPHI";
            public static final String KE_HOACH_COL_CODE = "KEHOACH";
            public static final String GHI_CHU_COL_CODE = "GHICHU";

            // Giá trị hợp lệ cho cột KEHOACH — phân biệt nguồn dữ liệu hạng mục
            public static final String KE_HOACH_DAU_NAM = "Đầu năm";  // từ PL159 (đăng ký đầu năm)
            public static final String KE_HOACH_BO_SUNG = "Bổ sung";  // từ PL158 (đăng ký bổ sung)
        }

    }
    public static final class ContentType {
        public static final String XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        public static final String XLS = "application/vnd.ms-excel";
        public static final String ZIP = "application/zip";
        public static final String OCTET_STREAM = "application/octet-stream";
        public static final String JSON = "application/json";

        public static String getContentTypeByExtension(String fileExtension) {
            switch (fileExtension) {
                case ExtensionFile.XLSX:
                    return XLSX;
                case ExtensionFile.XLS:
                    return XLS;
                case ExtensionFile.ZIP:
                    return ZIP;
                default:
                    return OCTET_STREAM;
            }
        }
    }

    public interface TEMPLATE_FILE_PATH {
        String SCL_CATEGORY_REPORT = "scl-category-report-template.xlsx";
    }
}
