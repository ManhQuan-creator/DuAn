#### 1.1.1.1. Tìm kiếm phiên nhập liệu

##### 1.1.1.1.1. Thông tin chung chức năng

<table style="width:100%;">
<colgroup>
<col style="width: 21%" />
<col style="width: 78%" />
</colgroup>
<thead>
<tr>
<th><strong>Tên chức năng</strong></th>
<th>Chức năng tìm kiếm phiên nhập liệu</th>
</tr>
</thead>
<tbody>
<tr>
<td><strong>Mô tả</strong></td>
<td>Chức năng cho phép tìm kiếm phiên nhập liệu và trả về kết quả theo điều kiện tìm kiếm</td>
</tr>
<tr>
<td><strong>Tác nhân</strong></td>
<td>Người dùng được phân quyền</td>
</tr>
<tr>
<td><strong>Điều kiện trước </strong></td>
<td><p>Người dùng đăng nhập thành công vào hệ thống </p>
<p>Người dùng truy cập ${parentMenuName}, chức năng ${menuName}</p></td>
</tr>
<tr>
<td><strong>Điều kiện sau</strong></td>
<td>Hệ thống hiển thị danh sách kế hoạch thỏa mãn điều kiện tìm kiếm</td>
</tr>
<tr>
<td><strong>Ngoại lệ</strong></td>
<td><p>Không tìm thấy dữ liệu phù hợp với điều kiện tìm kiếm.</p>
<p>Hệ thống phát sinh lỗi trong quá trình truy xuất dữ liệu.</p></td>
</tr>
<tr>
<td><strong>Các yêu cầu đặc biệt</strong></td>
<td></td>
</tr>
</tbody>
</table>

##### 1.1.1.1.2. Biểu đồ luồng xử lý chức năng

> <img src="media/image1.png" style="width:3.56597in;height:3.07569in" />   

##### 1.1.1.1.3. Màn hình

> <img src="media/image2.png" style="width:6.26806in;height:3.33403in" />

##### 1.1.1.1.4. Mô tả dòng sự kiện chính (Basic Flow)

<table>
<colgroup>
<col style="width: 32%" />
<col style="width: 52%" />
<col style="width: 15%" />
</colgroup>
<thead>
<tr>
<th><strong>Hành động của tác nhân</strong></th>
<th><strong>Phản ứng của hệ thống</strong></th>
<th><strong>Dữ liệu liên quan (C/R/U/D)</strong></th>
</tr>
</thead>
<tbody>
<tr>
<td>1. Truy cập chức năng ${parentMenuName}, chức năng ${menuName}</td>
<td><p>2. Hệ thống mặc định hiển thị biểu mẫu:  ${defaultTemplateLabel}</p>
<p>Người dùng có thể chọn để xem biểu mẫu khác bao gồm ${otherTemplatesList}</p></td>
<td>R</td>
</tr>
<tr>
<td>3. Người dùng lựa chọn các điều kiện tìm kiếm</td>
<td><p>4. Hệ thống cho phép tìm kiếm theo các điều kiện:</p>
<ul>
<li><p>Mã/Tên mã báo cáo: lựa chọn 1 trong ${templatesCount}</p></li>
<li><p>Năm kế hoạch (Là trường bắt buộc): Mặc định hiển thị là năm N</p></li>
<li><p>Trạng thái: mặc định "Tất cả trạng thái" (Bao gồm: Đã phân bổ, Nháp)</p></li>
</ul>
<p>Và hiển thị danh sách kế hoạch:</p>
<ul>
<li><p>STT: 1-N</p></li>
<li><p>Đơn vị:</p></li>
<li><p>Năm: Hiển thị theo người dùng tìm kiếm</p></li>
<li><p>Trạng thái: Hiển thị theo người dùng tìm kiếm và trạng thái biểu mẫu</p></li>
<li><p>Người tạo</p></li>
<li><p>Ngày tạo</p></li>
<li><p>Thao tác: Sửa/Xoá/Xem</p></li>
</ul>
<ul>
<li><p>Nháp: cho phép thao tác Sửa/Xóa/Xem</p></li>
</ul>
<p>4.1. Trường hợp có dữ liệu phù hợp: hiển thị danh sách kết quả thỏa mãn điều kiện tìm kiếm </p>
<p>4.2. Trường hợp không có dữ liệu, lưới dữ liệu hiển thị "Không có dữ liệu hiển thị" </p></td>
<td>R</td>
</tr>
</tbody>
</table>

##### 1.1.1.1.5. Mô tả dòng sự kiện phụ (Alternative Flow) 

> \- Không tìm thấy dữ liệu =\> Danh sách phiên nhập liệu hiển thị "Không có dữ liệu hiển thị"

##### 1.1.1.1.6. Ghi chú 

<!-- PER_TEMPLATE_START -->

### Biểu mẫu: ${currentTemplateLabel}

#### 1.1.1.2. Thêm mới dữ liệu ${templateName}

##### 1.1.1.2.1. Thông tin chung chức năng

| **Tên chức năng**        | Chức năng thêm mới dữ liệu ${templateName}              |
|--------------------------|--------------------------------------------------------|
| **Mô tả**                | Chức năng cho phép thêm mới dữ ${templateName}          |
| **Tác nhân**             | Người dùng được phân quyền                              |
| **Điều kiện trước **     | Người dùng đăng nhập thành công vào hệ thống            |
| **Điều kiện sau**        | Biểu mẫu được tạo thành công                            |
| **Ngoại lệ**             |                                                        |
| **Các yêu cầu đặc biệt** |                                                        |

##### 1.1.1.2.2. Biểu đồ luồng xử lý 

> <img src="media/image3.png" style="width:3.43403in;height:3.60347in" /> 

##### 1.1.1.2.3. Màn hình

> <img src="media/image4.png" style="width:6.26806in;height:3.30625in" />
>
> <img src="media/image5.png" style="width:6.26806in;height:5.53194in" />

##### 1.1.1.2.4. Mô tả luồng sự kiện chính (Basic Flow)

<table>
<colgroup>
<col style="width: 28%" />
<col style="width: 52%" />
<col style="width: 18%" />
</colgroup>
<thead>
<tr>
<th><strong>Hành động của tác nhân</strong></th>
<th><strong>Phản ứng của hệ thống</strong></th>
<th><strong>Dữ liệu liên quan (C/R/U/D)</strong></th>
</tr>
</thead>
<tbody>
<tr>
<td>1. Người dùng chọn biểu mẫu: ${templateName} trên form tìm kiếm rồi bấm nút "Thêm mới"</td>
<td><p>2. Hệ thống tự động hiển thị danh sách theo mã biểu mẫu đã chọn và hiển thị pop-up "Tạo phiên nhập liệu mới" gồm:</p>
<ul>
<li><p>Năm kế hoạch (Là trường bắt buộc): Mặc định hiển thị là năm N</p></li>
<li><p>Mã Điện lực: Là trường bắt buộc. Mặc định hiển thị theo vai trò người dùng đăng nhập</p></li>
</ul>
<ul>
<li><p>Huỷ: Thoát pop-up và phiên không được thêm mới </p></li>
</ul>
<ul>
<li><p>Thêm mới: Thêm mới phiên nhập liệu </p></li>
</ul></td>
<td></td>
</tr>
<tr>
<td>3. Người dùng nhấn nút "Thêm mới" ở pop-up</td>
<td><p>4. Hệ thống kiểm tra dữ liệu: </p>
<p>4.1. Nếu năm kế hoạch bị trùng, hệ thống hiển thị thông báo lỗi: "Lỗi tạo phiên: Báo cáo với phiên nhập liệu năm N đã tồn tại. Vui lòng chọn phiên nhập liệu khác"</p>
<p>4.2. Nếu thành công, hệ thống hiển thị biểu mẫu ${templateName} gồm các trường:</p>
<ul>
<li><p>${columnsList}</p></li>
</ul>
<p>Gồm các nút: </p>
<ul>
<li><p>Thoát: Đóng màn hình thao tác đang làm</p></li>
<li><p>Nhập excel: Tham chiếu chức năng nhập excel</p></li>
<li><p>Xuất excel: Tham chiếu chức năng xuất excel</p></li>
<li><p>Đính kèm file: Tham chiếu chức năng chung đính kèm file</p></li>
<li><p>Lưu: Lưu lại dữ liệu</p></li>
</ul></td>
<td>C</td>
</tr>
<tr>
<td>5. Người dùng thực hiện nhập số liệu hoặc tải lên dữ liệu </td>
<td>6. Hệ thống ghi nhận thông tin nhập liệu</td>
<td>U</td>
</tr>
<tr>
<td>7. Nhấn nút "Lưu"</td>
<td>8.1. Kế hoạch được thêm và hiển thị đúng danh sách biểu mẫu đã chọn. Hệ thống thông báo "Thêm mới thành công" và trạng thái bảng danh sách biểu mẫu hiển thị trạng thái "Nháp"</td>
<td></td>
</tr>
</tbody>
</table>

##### 1.1.1.2.5. Mô tả luồng sự kiện phụ (Alternative Flow) 

> - Lưu thất bại: Nếu dữ liệu không hợp lệ -\> Hiển thị lỗi 
>
> \- Rời trang: Nếu chưa lưu -\> Cảnh báo xác nhận 
>
> \- Nhập ô lỗi dữ liệu:
>
> \+ Nhập ký tự đặc biệt vào các ô Textbox: → hiển thị màu đỏ khi nhấn ô vào ô hiển thị "Lỗi nhập sai định dạng"
>
> \+ Nhập quá độ dài quy định vào các ô Textbox: → hiển thị màu đỏ khi nhấn ô vào ô hiển thị "Lỗi nhập sai định dạng"

##### 1.1.1.2.6. Ghi chú

#### 1.1.1.3. Xem chi tiết kế hoạch tạm tính 

##### 1.1.1.3.1. Thông tin chung chức năng

<table style="width:100%;">
<colgroup>
<col style="width: 23%" />
<col style="width: 76%" />
</colgroup>
<thead>
<tr>
<th><strong>Tên chức năng</strong></th>
<th>Chức năng xem chi tiết ${templateName}</th>
</tr>
</thead>
<tbody>
<tr>
<td><strong>Mô tả</strong></td>
<td>Chức năng này cho phép xem màn hình chi tiết ${templateName}</td>
</tr>
<tr>
<td><strong>Tác nhân</strong></td>
<td>Người dùng được phân quyền</td>
</tr>
<tr>
<td><strong>Điều kiện trước </strong></td>
<td>Người dùng đã đăng nhập thành công vào hệ thống và chọn chức năng ${menuName}</td>
</tr>
<tr>
<td><strong>Điều kiện sau</strong></td>
<td>Thông tin chi tiết kế hoạch tạm tính được hiển thị đầy đủ trên màn hình.</td>
</tr>
<tr>
<td><strong>Ngoại lệ</strong></td>
<td><p>Kế hoạch tạm tính không tồn tại hoặc dữ liệu đã bị xóa.</p>
<p>Hệ thống không thể tải thông tin chi tiết kế hoạch do lỗi kết nối hoặc lỗi máy chủ. </p></td>
</tr>
<tr>
<td><strong>Các yêu cầu đặc biệt</strong></td>
<td></td>
</tr>
</tbody>
</table>

##### 1.1.1.3.2. Sơ đồ luồng xử lý chức năng 

> <img src="media/image6.png" style="width:6.26806in;height:2.99444in" />  

##### 1.1.1.3.3. Màn hình 

> <img src="media/image7.png" style="width:6.26806in;height:3.14306in" />

##### 1.1.1.3.4. Mô tả dòng sự kiện chính (Basic Flow) 

<table style="width:100%;">
<colgroup>
<col style="width: 43%" />
<col style="width: 36%" />
<col style="width: 20%" />
</colgroup>
<thead>
<tr>
<th><strong>Hành động của tác nhân</strong></th>
<th><strong>Phản ứng của hệ thống</strong></th>
<th><strong>Dữ liệu liên quan (C/R/U/D)</strong></th>
</tr>
</thead>
<tbody>
<tr>
<td><ol type="1">
<li><p>Người dùng nhấn vào xem chi tiết biểu mẫu tạm tính hoặc nhấn 2 lần vào dòng tên biểu mẫu.</p></li>
</ol></td>
<td><p>2. Hệ thống hiển thị chi tiết biểu mẫu tạm tính bao gồm các trường sau:</p>
<p> ${columnsList}</p>
<p>Gồm các nút: </p>
<ul>
<li><p>Thoát: Đóng màn hình thao tác đang làm</p></li>
<li><p>Nhập excel: Tham chiếu chức năng nhập excel</p></li>
<li><p>Xuất excel: Tham chiếu chức năng xuất excel</p></li>
<li><p>Đính kèm file: Tham chiếu chức năng chung đính kèm file</p></li>
<li><p>Lưu: Lưu lại dữ liệu</p></li>
</ul>
<p>Tại đây, người dùng có thể chỉnh dữ liệu nếu biểu mẫu ở trạng thái "Nháp"</p></td>
<td></td>
</tr>
<tr>
<td></td>
<td></td>
<td></td>
</tr>
</tbody>
</table>

##### 1.1.1.3.5. Mô tả dòng sự kiện phụ (Alternative Flow) 

- Người dùng không có quyền truy cập chức năng.

- Hệ thống không thể tải thông tin chi tiết kế hoạch do lỗi kết nối hoặc lỗi máy chủ. 

##### 1.1.1.3.6. Ghi chú

#### 1.1.1.4. Cập nhật ${templateName} 

##### 1.1.1.4.1. Thông tin chung chức năng

<table style="width:100%;">
<colgroup>
<col style="width: 19%" />
<col style="width: 80%" />
</colgroup>
<thead>
<tr>
<th><strong>Tên chức năng</strong></th>
<th>Chức năng cập nhật ${templateName}</th>
</tr>
</thead>
<tbody>
<tr>
<td><strong>Mô tả</strong></td>
<td>Chức năng này cho phép người dùng chỉnh sửa, cập nhật thông tin ${templateName} đã được tạo trong hệ thống</td>
</tr>
<tr>
<td><strong>Tác nhân</strong></td>
<td>Người dùng được phân quyền</td>
</tr>
<tr>
<td><strong>Điều kiện trước </strong></td>
<td><p>Người dùng đăng nhập thành công vào hệ thống </p>
<p>Người dùng truy cập ${parentMenuName} chọn chức năng ${menuName}</p>
<p>Kế hoạch đã tồn tại trong hệ thống ở trạng thái "Nháp"</p></td>
</tr>
<tr>
<td><strong>Điều kiện sau</strong></td>
<td>Kế hoạch được cập nhật thành công và lưu trong hệ thống, lưu lịch sử cập nhật sau khi cập nhật thành công</td>
</tr>
<tr>
<td><strong>Ngoại lệ</strong></td>
<td>Kế hoạch không tồn tại hoặc đã bị xóa khỏi hệ thống.</td>
</tr>
<tr>
<td><strong>Các yêu cầu đặc biệt</strong></td>
<td>Kế hoạch chỉ được sửa khi ở trạng thái "Nháp"</td>
</tr>
</tbody>
</table>

##### 1.1.1.4.2. Biểu đồ luồng xử lý chức năng

> <img src="media/image8.png" style="width:4.28333in;height:4.80208in" />   

##### 1.1.1.4.3. Màn hình

> <img src="media/image9.png" style="width:6.26806in;height:3.14306in" />

##### 1.1.1.4.4. Mô tả dòng sự kiện chính (Basic Flow)

<table>
<colgroup>
<col style="width: 23%" />
<col style="width: 55%" />
<col style="width: 20%" />
</colgroup>
<thead>
<tr>
<th><strong>Hành động của tác nhân</strong></th>
<th><strong>Phản ứng của hệ thống</strong></th>
<th><strong>Dữ liệu liên quan (C/R/U/D)</strong></th>
</tr>
</thead>
<tbody>
<tr>
<td>1. Người dùng chọn bản ghi và nhấn chỉnh sửa</td>
<td>2. Hệ thống hiển thị màn hình cập nhật biểu mẫu</td>
<td>R</td>
</tr>
<tr>
<td>3. Người dùng chỉnh sửa các ô cần chỉnh sửa</td>
<td><p>4. Người dùng được phép nhập/chỉnh sửa:</p>
<p>- Đối với biểu mẫu ${templateName}:</p>
<ol type="1">
<li><p>${columnsList}</p></li>
</ol>
<p>- Các nút hiển thị:</p>
<ul>
<li><p>Hủy: Cho phép người dùng hủy thao tác đang thực hiện và quay lại màn trước đó mà không lưu các thay đổi đã nhập.</p></li>
<li><p>Nhập excel: Tham chiếu ở dưới chức năng nhập excel</p></li>
<li><p>Xuất excel: Tham chiếu ở dưới chức năng xuất excel</p></li>
<li><p>Lưu: Lưu lại dữ liệu</p></li>
<li><p>Đính kèm file: Tham chiếu ở dưới chức năng chung đính kèm file</p></li>
</ul></td>
<td>U</td>
</tr>
<tr>
<td>5. Nhấn nút "Lưu"</td>
<td><p>6. Hệ thống kiểm tra </p>
<p>- Hệ thống thông báo "Cập nhật thành công" </p>
<p>- Hệ thống hiển thị thông báo không thành công "Cập nhật không thành công + Kèm lỗi":</p>
<p>+ Nếu sai định dạng thì sẽ hiển thị thông báo lỗi: "Thêm mới không thành công do sai định dạng file."</p>
<p>+ Nếu dữ liệu không hợp lệ thì sẽ hiển thị thông báo lỗi: "Thêm mới không thành công do dữ liệu không hợp lệ."</p></td>
<td></td>
</tr>
</tbody>
</table>

##### 1.1.1.4.5. Mô tả dòng sự kiện phụ (Alternative Flow) 

> \- Cập nhật thất bại: Dữ liệu không hợp lệ -\> Hiển thị lỗi 
>
> \- Rời trang khi chưa lưu: Hiển thị pop-up cảnh báo

##### 1.1.1.4.6. Ghi chú 

#### 1.1.1.5. Xóa kế hoạch tạm tính

##### 1.1.1.5.1. Thông tin chung chức năng

<table style="width:100%;">
<colgroup>
<col style="width: 13%" />
<col style="width: 86%" />
</colgroup>
<thead>
<tr>
<th><strong>Tên chức năng</strong></th>
<th>Chức năng xóa ${templateName}</th>
</tr>
</thead>
<tbody>
<tr>
<td><strong>Mô tả</strong></td>
<td>Chức năng này cho phép người dùng loại bỏ một phiên lập kế hoạch từ màn hình danh sách</td>
</tr>
<tr>
<td><strong>Tác nhân</strong></td>
<td>Người dùng được phân quyền</td>
</tr>
<tr>
<td><strong>Điều kiện trước </strong></td>
<td><p>Người dùng đăng nhập thành công vào hệ thống </p>
<p>Biểu mẫu đang ở trạng thái "Nháp"</p>
<p>Người dùng đang ở màn hình ${parentMenuName}/ chọn menu ${menuName}</p></td>
</tr>
<tr>
<td><strong>Điều kiện sau</strong></td>
<td>Khi thực hiện xóa, hệ thống sẽ cập nhật trạng thái bản ghi sang "Đã xóa". Sau khi cập nhật trạng thái, dữ liệu sẽ không còn hiển thị trên hệ thống đối với người dùng. Đồng thời, toàn bộ tệp đính kèm liên quan đến bản ghi đó cũng sẽ không còn được hiển thị.</td>
</tr>
<tr>
<td><strong>Ngoại lệ</strong></td>
<td><p>Hệ thống mất kết nối </p>
<p>Báo cáo ở trạng thái không được phép xóa</p></td>
</tr>
<tr>
<td><strong>Các yêu cầu đặc biệt</strong></td>
<td></td>
</tr>
</tbody>
</table>

##### 1.1.1.5.2. Biểu đồ luồng xử lý chức năng

> <img src="media/image10.png" style="width:6.26806in;height:6.82431in" />  

##### 1.1.1.5.3. Màn hình

> <img src="media/image11.png" style="width:6.26806in;height:2.83819in" />

##### 1.1.1.5.4. Mô tả dòng sự kiện chính (Basic Flow)

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 45%" />
<col style="width: 21%" />
</colgroup>
<thead>
<tr>
<th><strong>Hành động của tác nhân</strong></th>
<th><strong>Phản ứng của hệ thống</strong></th>
<th><strong>Dữ liệu liên quan (C/R/U/D)</strong></th>
</tr>
</thead>
<tbody>
<tr>
<td>1. Người dùng tìm kiếm biểu mẫu cần xoá tại màn hình danh sách</td>
<td>2. Hệ thống hiển thị danh sách biểu mẫu</td>
<td>R</td>
</tr>
<tr>
<td><p>3. Chọn biểu mẫu cần xóa và nhấn Xóa</p>
<p>Lưu ý: Chỉ có thể xóa ở trạng thái "Nháp" </p></td>
<td><p>4. Hệ thống hiển thị pop-up:</p>
<p>+ Thông báo xác nhận: "Bạn có muốn xoá phiên + tên phiên?"</p>
<p>+ Nút "Huỷ": Thoát pop-up, huỷ thao tác xoá</p>
<p>+ Nút "Xoá": Xác nhận xóa.</p></td>
<td>R</td>
</tr>
<tr>
<td>4. Người dùng nhấn "Xoá" ở pop-up</td>
<td>5. Hệ thống thực hiện xóa phiên kế hoạch, cập nhật lại danh sách và thông báo: "Xóa thành công" </td>
<td>D</td>
</tr>
</tbody>
</table>

##### 1.1.1.5.5. Mô tả dòng sự kiện phụ (Alternative Flow) 

> \- Không được phép xóa: Hệ thống vô hiệu hóa nút xóa nếu phiên ở trạng thái "Đã phân bổ"
>
> \- Xác nhận hủy: Nếu ở pop-up xác nhận, người dùng nhấn "Hủy" -\> hệ thống đóng pop-up và giữ nguyên dữ liệu hiện tại

##### 1.1.1.5.6. Ghi chú

#### 1.1.1.6. Nhập excel 

##### *1.1.1.6.1. Thông tin chung chức năng*

<table>
<colgroup>
<col style="width: 31%" />
<col style="width: 68%" />
</colgroup>
<thead>
<tr>
<th><strong>Tên chức năng</strong></th>
<th>Chức năng nhập excel</th>
</tr>
</thead>
<tbody>
<tr>
<td><strong>Mô tả</strong></td>
<td>Chức năng này cho phép nhập liệu biểu mẫu bằng file excel có dữ liệu sẵn</td>
</tr>
<tr>
<td><strong>Tác nhân</strong></td>
<td>Người được phân quyền</td>
</tr>
<tr>
<td><strong>Điều kiện trước</strong></td>
<td><p>Người dùng đăng nhập thành công vào hệ thống</p>
<p>Người dùng truy cập vào chức năng "${menuName}", chọn biểu mẫu "${templateName}" sau đó chọn thêm mới hoặc chỉnh sửa biểu mẫu</p></td>
</tr>
<tr>
<td><strong>Điều kiện sau</strong></td>
<td>Biểu mẫu được cập nhật dữ liệu mới từ file excel tải lên</td>
</tr>
<tr>
<td><strong>Ngoại lệ</strong></td>
<td>Hệ thống nhập file không thành công</td>
</tr>
<tr>
<td><strong>Các yêu cầu đặc biệt</strong></td>
<td></td>
</tr>
</tbody>
</table>

##### *1.1.1.6.2. Biểu luồng xử lý* 

> <img src="media/image12.png" style="width:4.85736in;height:3.60832in" />

##### *1.1.1.6.3. Màn hình* 

> <img src="media/image13.png" style="width:4.42962in;height:3.57412in" />

##### *1.1.1.6.4. Mô tả dòng sự kiện chính (Basic Flow)* 

<table>
<colgroup>
<col style="width: 24%" />
<col style="width: 60%" />
<col style="width: 14%" />
</colgroup>
<thead>
<tr>
<th><strong>Hành động của tác nhân</strong></th>
<th><strong>Phản ứng của hệ thống</strong></th>
<th><strong>Dữ liệu liên quan (C/R/U/D)</strong></th>
</tr>
</thead>
<tbody>
<tr>
<td>1. Truy cập vào chi tiết biểu mẫu ${templateName} chọn chức năng "Nhập excel"</td>
<td>2. Hiển thị popup gồm:<br />
- Nút "Tải template import"<br />
- Input file cho phép kéo/chọn file có định dạng xlsx hoặc xls<br />
- Nút "Thoát"<br />
- Nút "Nhập file"</td>
<td>R</td>
</tr>
<tr>
<td>3. Chọn nút "Tải template import"</td>
<td>4. Hệ thống tải về template excel cho phép NSD nhập dữ liệu để import lên chương trình. File excel template gồm các cột như sau:<br />
${columnsList}</td>
<td>R</td>
</tr>
<tr>
<td>5. Chọn vào input file hoặc kéo file excel đã nhập dữ liệu từ thiết bị để upload lên hệ thống</td>
<td><p>6.1. Hệ thống thực hiện validate xem file có đúng định dạng xlsx hay xls không</p>
<p>Nếu không đúng định dạng hệ thống hiển thị thông báo lỗi "File dữ liệu không đúng định dạng" và không cho phép nhập file vào hệ thống<br />
6.2. Hệ thống thực hiện validate dung lượng file. Nếu file vượt quá 20MB hệ thống hiển thị thông báo lỗi "File dữ liệu vượt quá dung lượng cho phép" và không cho phép nhập file vào hệ thống</p></td>
<td>R</td>
</tr>
<tr>
<td>6. Chọn nút "Thoát"</td>
<td>Hệ thống tắt popup nhập file và kết thúc luồng Nhập excel</td>
<td>R</td>
</tr>
<tr>
<td>7. Chọn nút "Nhập file"</td>
<td><p>8. Hệ thống thực hiện đọc dữ liệu file và validate</p>
<p>Các tên cột của biểu mẫu so với template.</p>
<p>8.1. Nếu template có chứa các cột đúng với mẫu tải về, hệ thống thực hiện import dữ liệu vào biểu mẫu và thông báo thành công</p>
<p>8.2. Nếu template có chứa các cột không khớp với mẫu tải về, hệ thống thông báo lỗi và không thực hiện import dữ liệu từ file excel</p></td>
<td>U</td>
</tr>
<tr>
<td></td>
<td></td>
<td></td>
</tr>
</tbody>
</table>

##### *1.1.1.6.5. Mô tả dòng sự kiện phụ (Alternative Flow)*

- Nhập file không thành công

<!-- -->

- Nếu file không đúng định dạng thì hiển thị thông báo "File không đúng định dạng"

- Nếu file tải lên quá dung lượng thì hiển thị thông báo "Tệp tải lên quá dung lượng quy định!"

- Trường hợp dữ liệu hợp lệ thì hệ thống thực hiện thêm mới biểu mẫu vào hệ thống sau đó hiển thị thông báo "Nhập file Excel thành công"

##### *1.1.1.6.6. Ghi chú*

#### 1.1.1.7. Xuất excel

##### 1.1.1.7.1. Thông tin chung chức năng

<table>
<colgroup>
<col style="width: 31%" />
<col style="width: 68%" />
</colgroup>
<thead>
<tr>
<th><strong>Tên chức năng</strong></th>
<th>Chức năng xuất excel</th>
</tr>
</thead>
<tbody>
<tr>
<td><strong>Mô tả</strong></td>
<td>Chức năng này cho phép người dùng tải xuống file ${templateName}</td>
</tr>
<tr>
<td><strong>Tác nhân</strong></td>
<td>Người dùng được phân quyền</td>
</tr>
<tr>
<td><strong>Điều kiện trước</strong></td>
<td><p>Người dùng đăng nhập thành công vào hệ thống</p>
<p>Người dùng truy cập vào chức năng ${menuName} và chọn biểu mẫu ${templateName}</p></td>
</tr>
<tr>
<td><strong>Điều kiện sau</strong></td>
<td>Tải xuống thành công biểu mẫu đã chọn</td>
</tr>
<tr>
<td><strong>Ngoại lệ</strong></td>
<td><p>Lỗi trong quá trình tải file<br />
→ Hệ thống hiển thị thông báo:<br />
"Tải file thất bại. Vui lòng thử lại."</p>
<p>Phiên đăng nhập hết hạn<br />
→ Hệ thống chuyển về màn hình đăng nhập</p></td>
</tr>
<tr>
<td><strong>Các yêu cầu đặc biệt</strong></td>
<td></td>
</tr>
</tbody>
</table>

##### *1.1.1.7.2. Biểu đồ luồng xử lý chức năng*

> <img src="media/image14.png" style="width:5.36268in;height:3.98544in" />

##### *1.1.1.7.3. Màn hình* 

<img src="media/image15.png" style="width:6.49549in;height:2.72222in" />

##### *1.1.1.7.4. Mô tả dòng sự kiện chính (Basic Flow)* 

<table>
<colgroup>
<col style="width: 26%" />
<col style="width: 56%" />
<col style="width: 16%" />
</colgroup>
<thead>
<tr>
<th><strong>Hành động của tác nhân</strong></th>
<th><strong>Phản ứng của hệ thống</strong></th>
<th><strong>Dữ liệu liên quan (C/R/U/D)</strong></th>
</tr>
</thead>
<tbody>
<tr>
<td>1. Truy cập vào chi tiết biểu mẫu chọn chức năng xuất excel.</td>
<td><p>2. Hệ thống xuất mẫu file excel, cho người dùng tải về.</p>
<p>Tên file: ${templateName}.xlsx</p>
<p>File excel được tải về gồm đầy đủ các cột như trên lưới hiển thị bao gồm<br />
${columnsList}</p></td>
<td>R</td>
</tr>
</tbody>
</table>

##### *1.1.1.7.5. Mô tả dòng sự kiện phụ (Alternative Flow)*

- Lỗi trong quá trình tải file → Hệ thống hiển thị thông báo: "Tải file thất bại. Vui lòng thử lại."

##### *1.1.1.7.6. Ghi chú*

<!-- PER_TEMPLATE_END -->

