# HƯỚNG DẪN SỬ DỤNG — HỆ THỐNG BÁO CÁO KHO SABECO

Cập nhật: 20/08/2026 · Dữ liệu hiện tại: ngày 17/08/2026

---

## 1. Mở dashboard

Dashboard là web tĩnh, không cần cài server hay database. Có 2 cách mở:

**Cách 1 — Chạy local (khuyến nghị, thấy dữ liệu thật)**

Mở PowerShell hoặc CMD, chạy:

```
cd "C:\Users\khoatnd\.gemini\antigravity\scratch\sabeco-dashboard"
python -m http.server 8000
```

Rồi mở trình duyệt vào `http://localhost:8000`. Giữ cửa sổ CMD mở trong lúc dùng; đóng nó là tắt server.

**Cách 2 — Double-click `index.html`**

Xem được giao diện nhưng bảng sẽ trống, kèm dải cảnh báo vàng. Nguyên nhân: trình duyệt chặn JavaScript đọc file JSON qua giao thức `file://` (chính sách CORS). Đây không phải lỗi. Dùng Cách 1 hoặc mở link GitHub Pages để có dữ liệu.

---

## 2. Bố cục màn hình

**Cột trái (nền xanh đậm) — Danh sách báo cáo.** Sáu ô báo cáo, mỗi ô có số thứ tự, tên, mô tả ngắn và một chấm tròn trạng thái: xanh lá là đã có dữ liệu, xám mờ là chưa. Bấm vào một báo cáo để xem chi tiết bên phải. Báo cáo chưa có dữ liệu thì không bấm được.

**Vùng phải — Chi tiết báo cáo đang xem,** gồm bốn tầng từ trên xuống:

Tầng một là thanh tiêu đề chung, hiển thị thời điểm cập nhật dữ liệu lần cuối và nút *Thao Tác Lại Bộ Lọc*.

Tầng hai là tên báo cáo, chip vàng đếm số dòng đang hiển thị, ngày của dữ liệu, và nút *Xuất Data Thô*.

Tầng ba là hàng nút bộ lọc. Mỗi nút hiện dạng `đang chọn / tổng số`, ví dụ `12/12`. Khi lọc chưa hết, nút chuyển viền vàng để bạn thấy ngay là đang có bộ lọc áp dụng.

Tầng bốn là chỉ số tổng hợp (KPI) và bảng dữ liệu.

---

## 3. Dùng bộ lọc

Bấm vào một nút bộ lọc để mở danh sách. Trong đó có ô tìm kiếm (hữu ích với Mã Kho vì có tới 57 kho), hai liên kết *Chọn tất cả* / *Bỏ chọn*, và danh sách checkbox.

Tick hoặc bỏ tick là bảng cập nhật ngay, không cần bấm nút áp dụng nào. Đóng danh sách bằng cách bấm ra ngoài hoặc nhấn `Esc`.

Các bộ lọc kết hợp theo kiểu VÀ: chọn khu vực *Miền Bắc* và ĐVT *THUNG* thì chỉ còn thùng ở Miền Bắc.

Nếu bỏ chọn hết một nhóm, bảng sẽ trống và hiện dòng "Không có dữ liệu phù hợp với bộ lọc". Bấm *Thao Tác Lại Bộ Lọc* để đưa mọi thứ về mặc định.

Mỗi báo cáo giữ bộ lọc riêng. Bạn lọc ở Hàng Block rồi sang Hàng Gần Hết Hạn thì bộ lọc bên đó vẫn như lúc bạn để lại, không bị reset.

---

## 4. Đọc bảng dữ liệu

Bấm vào tiêu đề cột có mũi tên để sắp xếp; bấm lần nữa để đảo chiều tăng/giảm. Cột đang sắp xếp có nền xanh nhạt hơn và mũi tên màu vàng.

Ô tìm kiếm nhanh bên phải quét đồng thời mã kho, mã hàng, tên hàng, số lô và nguyên nhân block.

Màu sắc trong bảng có ý nghĩa cố định. Mã hàng màu xanh dương, số lô màu tím, ngày tháng màu xám, số lượng in đậm màu đen, STT màu cam. Viên thuốc (pill) % HSD đổi màu theo mức độ: đỏ dưới 30%, cam từ 30 đến dưới 45%, vàng từ 45 đến dưới 55%, xanh từ 55% trở lên. Dấu gạch ngang xám nghĩa là dữ liệu nguồn không có giá trị đó.

Dòng tổng nằm cố định ở đáy bảng, luôn thấy khi cuộn.

---

## 5. Báo cáo 02 — Hàng Gần Hết Hạn Sử Dụng

Nguồn: `Cảnh báo % shelf life.xlsm`, sheet `Data` và sheet `QĐ49`.

Báo cáo trả lời câu hỏi: hàng nào sắp hết hạn cần thủ kho đi kiểm đếm thực tế.

Điểm cần nắm là có hai khái niệm khác nhau, đừng lẫn:

**Ngưỡng hiển thị** là ô chọn `< 60%` bạn điều chỉnh được, chỉ để lọc bớt cho bảng dễ đọc. Mặc định 60%.

**Cảnh báo QĐ49** là quy định thật của công ty, không phải mốc 60%. Ngưỡng thay đổi theo tuổi thọ của từng mặt hàng: hàng 182 ngày cảnh báo khi còn dưới 32%, hàng 273 ngày dưới 27%, hàng 365 ngày dưới 20%. Script Python tự tra bảng này cho từng dòng.

Vì vậy KPI đỏ *Cảnh báo QĐ49* thường nhỏ hơn nhiều số dòng đang hiển thị. Với dữ liệu ngày 17/08/2026, ngưỡng `< 60%` cho 155 dòng và tổng 54.591 đơn vị cần theo dõi, nhưng số dòng thực sự vi phạm QĐ49 là 0. Nghĩa là hiện chưa có mã nào tới mức phải cảnh báo — 155 dòng kia là để theo dõi sớm.

---

## 6. Báo cáo 03 — Hàng Block

Nguồn: `BC Hàng Block.xlsm`, sheet `Data` (dữ liệu từ Portal) và sheet `Dashboard` (nhập tay).

Hàng block là tồn kho bị khoá không cho xuất. Hệ thống Portal lọc theo điều kiện `status IN ('D','R')`, trong đó `D` là Damaged (hư hỏng) và `R` là Rejected (bị từ chối). Không có ngưỡng phần trăm nào ở đây — mọi dòng trong sheet `Data` đều đã là hàng block, nên bảng luôn hiển thị hết.

Năm chỉ số phía trên gồm: số dòng block, tổng số lượng, số dòng hư hỏng D, số dòng bị từ chối R, và số dòng chưa có kế hoạch giải phóng.

Hai cột quan trọng nhất là **Nguyên Nhân Block** và **Kế Hoạch Clear**. Hai cột này *nhập tay* trên sheet `Dashboard` của file Excel, Portal không tự sinh ra. Script join hai sheet theo cặp `(MÃ HÀNG, SỐ LÔ)` để ghép chúng vào. Cột Kế Hoạch Clear hiển thị badge xanh khi đã có ngày cụ thể, badge vàng khi còn là `Pending`.

Cột nhóm hàng phân biệt `BB` là bao bì (vỏ két, vỏ keg) và `TP` là thành phẩm. Bao bì không có hạn sử dụng nên các cột NSX, HSD, % HSD của dòng `BB` hiện dấu gạch ngang — đúng như dữ liệu nguồn, không phải thiếu sót.

Dữ liệu ngày 17/08/2026 có 5 dòng, tổng 228 đơn vị, trong đó 4 dòng D và 1 dòng R, và 2 dòng còn `Pending` chưa có ngày clear.

Lưu ý một hạn chế từ nguồn: cột `VỊ TRÍ` trong sheet `Data` trả về đúng chữ `FUNCTION` ở mọi dòng thay vì vị trí thật. Đây là lỗi của API Portal, nên tôi đã bỏ cột này khỏi báo cáo và khỏi file CSV xuất ra. Nếu sau này API sửa, chỉ cần thêm lại cột là dùng được ngay.

---

## 7. Xuất dữ liệu ra Excel

Bấm *Xuất Data Thô*. File CSV tải về chứa **đúng những dòng đang hiển thị sau bộ lọc**, không phải toàn bộ dữ liệu — muốn xuất hết thì bấm *Thao Tác Lại Bộ Lọc* trước.

Tên file tự đặt theo dạng `BC03_HangBlock_17082026.csv`.

File đã nhúng BOM UTF-8 nên mở bằng Excel là hiển thị đúng tiếng Việt, không cần thao tác import thủ công.

CSV có nhiều cột hơn bảng trên web, gồm cả những cột phục vụ đối chiếu như Tên Đơn Vị, Số Lượng PL, Ngưỡng QĐ49.

---

## 8. Cập nhật dữ liệu mới

Quy trình gồm hai bước: chạy file Excel để lấy dữ liệu mới từ Portal, rồi chạy script Python để chuyển sang JSON cho web.

**Bước 1 — Lấy dữ liệu mới vào Excel.** Chạy file `1. CLICK DE CHAY TU DONG.bat` trong thư mục tương ứng. Với Hàng Block là `D:\OneDrive - SABECO\Cong viec\BC tuan\Hang block\Nam 2026\Auto hàng block\`.

Riêng báo cáo Hàng Block, sau khi Portal trả dữ liệu bạn cần **mở sheet `Dashboard` điền tay hai cột Nguyên Nhân Block và Kế Hoạch Clear** cho các lô mới, rồi lưu file. Bỏ qua bước này thì hai cột đó trên web sẽ hiện "Chưa nhập".

**Bước 2 — Chuyển Excel sang JSON.**

```
cd "C:\Users\khoatnd\.gemini\antigravity\scratch\sabeco-dashboard"
python export_to_json.py
python export_hangblock.py
```

Đóng file Excel trước khi chạy để tránh lỗi file đang bị khoá. Script tự tìm file Excel theo đường dẫn đã cấu hình sẵn, tự copy ra bản tạm để đọc, nên không ảnh hưởng file gốc.

Xem dòng log để biết kết quả. Dòng quan trọng nhất của Hàng Block là:

```
Join duoc Nguyen Nhan/Ke Hoach cho 5/5 dong.
```

Hai số phải bằng nhau. Nếu lệch, ví dụ `3/5`, nghĩa là có lô trong sheet `Data` không tìm thấy dòng tương ứng trên sheet `Dashboard` — thường do sheet `Dashboard` chưa cập nhật lô mới, hoặc mã hàng/số lô gõ lệch giữa hai sheet. Sửa trên Excel rồi chạy lại.

**Bước 3 — Reload trang web** bằng `Ctrl + F5` để trình duyệt nạp lại JSON mới thay vì dùng bản cache.

---

## 9. Đưa lên GitHub Pages

Làm một lần đầu:

```
cd "C:\Users\khoatnd\.gemini\antigravity\scratch\sabeco-dashboard"
git init
git add index.html style.css script.js data.json data_hangblock.json
git commit -m "Dashboard bao cao kho SABECO"
git remote add origin https://github.com/TEN_TAI_KHOAN/sabeco-dashboard.git
git branch -M main
git push -u origin main
```

Rồi vào repo trên GitHub, chọn **Settings** → **Pages**, phần Source chọn branch `main` và folder `/ (root)`, bấm Save. Sau khoảng một phút sẽ có link dạng `https://TEN_TAI_KHOAN.github.io/sabeco-dashboard/`.

Những lần cập nhật sau chỉ cần:

```
python export_to_json.py
python export_hangblock.py
git add data.json data_hangblock.json
git commit -m "Cap nhat du lieu"
git push
```

GitHub Pages tự build lại sau khoảng một phút.

Hai điểm cần cân nhắc trước khi công khai. Thứ nhất, **GitHub Pages ở chế độ public thì bất kỳ ai có link đều xem được** toàn bộ số liệu tồn kho. Nếu đây là dữ liệu nội bộ, hãy dùng repo private kèm GitHub Pages riêng tư (cần tài khoản Enterprise), hoặc chỉ chạy local, hoặc đưa lên máy chủ nội bộ của công ty. Thứ hai, **tuyệt đối không commit file `taikhoan.txt`** — file này chứa tài khoản Portal Sabeco. Nó nằm trong thư mục Excel chứ không nằm trong thư mục dashboard, nhưng vẫn nên kiểm tra `git status` trước mỗi lần commit cho chắc.

---

## 10. Thêm báo cáo mới

Cấu trúc đã dựng sẵn cho 6 báo cáo, còn 4 ô trống. Để thêm một báo cáo cần ba việc.

Một là viết script Python xuất JSON, cách nhanh nhất là copy `export_hangblock.py` rồi sửa đường dẫn Excel, chỉ số cột và tên file đầu ra.

Hai là khai báo báo cáo trong `script.js`, ở mảng `REPORTS` gần đầu file. Đổi ô placeholder thành dạng:

```javascript
{ id:'bc4', idx:'04', name:'Tên báo cáo',
  desc:'Mô tả ngắn', icon:'fa-box', ready:true,
  file:'data_moi.json', arrayKey:'tenMangTrongJSON', prefix:'BC04_TenFile' },
```

Ba là viết hàm `renderBC4()` theo mẫu `renderBC3()`, thêm nhánh gọi nó trong hàm `renderReport()`, và thêm danh sách cột vào `EXPORT_COLS` để nút xuất CSV hoạt động.

Phần bộ lọc, sắp xếp, tìm kiếm, xuất file và chip đếm dòng đều dùng chung nên không phải viết lại.

---

## 11. Xử lý sự cố thường gặp

**Bảng trống, có dải vàng cảnh báo.** Bạn đang mở bằng `file://`. Chạy `python -m http.server 8000` rồi vào `http://localhost:8000`.

**Bảng trống, không có dải vàng.** Bộ lọc đang loại hết dữ liệu. Bấm *Thao Tác Lại Bộ Lọc*.

**Script Python báo `FileNotFoundError`.** Đường dẫn Excel không đúng hoặc OneDrive chưa tải file về máy. Mở thư mục kiểm tra file có tồn tại và không còn biểu tượng đám mây.

**Script báo lỗi permission hoặc file đang mở.** Đóng file Excel rồi chạy lại.

**Số liệu trên web không đổi sau khi chạy script.** Trình duyệt đang dùng cache. Nhấn `Ctrl + F5`.

**Log hiện `Join duoc ... 3/5`.** Sheet `Dashboard` thiếu lô hoặc gõ lệch mã hàng, số lô so với sheet `Data`. Sửa Excel rồi chạy lại script.

**Cột Nguyên Nhân Block hiện "Chưa nhập".** Lô đó chưa được điền trên sheet `Dashboard`.

---

## 12. Danh sách file

Thư mục dashboard `C:\Users\khoatnd\.gemini\antigravity\scratch\sabeco-dashboard\`:

`index.html` là khung trang. `style.css` là theme màu, bảng, badge, phối màu cột. `script.js` là toàn bộ logic gồm điều hướng báo cáo, lọc, sắp xếp, tìm kiếm, xuất CSV. `data.json` là dữ liệu Hàng Gần Hết Hạn, khoảng 1,8 MB với 4.107 dòng. `data_hangblock.json` là dữ liệu Hàng Block, khoảng 3 KB. `export_to_json.py` và `export_hangblock.py` là hai script chuyển Excel sang JSON. `README.md` là ghi chú kỹ thuật, còn `HUONG_DAN_SU_DUNG.md` là tài liệu này.

Bốn file `index.html`, `style.css`, `script.js` và hai file JSON là tối thiểu cần để deploy. Hai script Python chỉ chạy trên máy bạn, không cần đưa lên web.

Nếu `data.json` 1,8 MB làm trang load chậm, có thể giảm bằng cách chỉ xuất các dòng dưới 70% thay vì toàn bộ 4.107 dòng.

---

**Khoa Trương** — Phòng Kho vận, SABECO
