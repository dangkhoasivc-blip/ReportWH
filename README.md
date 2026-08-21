# HỆ THỐNG BÁO CÁO KHO — SABECO

Dashboard multi-report web tĩnh, theme SABECO green/gold. Không cần backend.

> Hướng dẫn dành cho người dùng: xem **[HUONG_DAN_SU_DUNG.md](HUONG_DAN_SU_DUNG.md)**.
> File này là ghi chú kỹ thuật.

## Cấu trúc

```
sabeco-dashboard/
├── index.html               # Khung trang: sidebar báo cáo + vùng chi tiết
├── style.css                # Theme, bảng, badge, phối màu cột
├── script.js                # Điều hướng, lọc, sort, search, export CSV
├── data.json                # BC02 Shelf Life  (1.8 MB / 4107 dòng)
├── data_hangblock.json      # BC03 Hàng Block  (3.3 KB / 5 dòng)
├── export_to_json.py        # Excel -> data.json
├── export_hangblock.py      # Excel -> data_hangblock.json
├── HUONG_DAN_SU_DUNG.md     # Hướng dẫn người dùng
└── README.md
```

## Layout

Sidebar trái (xanh đậm) là danh sách 6 báo cáo. Vùng phải là chi tiết báo cáo đang chọn, gồm header → tiêu đề + chip số dòng → hàng nút bộ lọc dropdown → KPI + bảng.

Bộ lọc nằm **trong** vùng báo cáo (không ở sidebar) vì mỗi báo cáo có tập bộ lọc riêng.

## Báo cáo

| ID | Tên | Nguồn Excel | Rule | Trạng thái |
|----|-----|-------------|------|-----------|
| bc1 | Hàng Gửi C1 | `Bao cao hang gui C1 theo kho (DD-MM-YYYY).xlsm` | Đa ngày (manifest) + lọc NPP | ready |
| bc2 | Hàng Gần Hết Hạn Sử Dụng | `Cảnh báo % shelf life.xlsm` | QĐ49 theo tuổi thọ hàng | ready |
| bc3 | Hàng Block | `BC Hàng Block.xlsm` | `status IN ('D','R')` | ready |
| bc4 | Thời Hạn Hợp Đồng | `Báo cáo theo dõi thời hạn hợp đồng v2.2026..xlsx` | On-Going / NearExpiry (≤60d) / Expired | ready |
| bc5–bc6 | — | — | — | placeholder |

**BC02 — QĐ49:** `floor(%HSD) <= ngưỡng(SỐ NGÀY HSD)`, tra từ sheet `QĐ49` (182d→32%, 273d→27%, 365d→20%). Không phải mốc 60% cố định. Ngưỡng `<60%` trên UI chỉ là bộ lọc hiển thị. Dữ liệu 17/08/2026: 0 dòng vi phạm QĐ49, 155 dòng dưới 60%.

**BC03 — Hàng Block:** mọi dòng sheet `Data` đã là hàng block nên không filter thêm. Hai cột `Nguyên Nhân Block` và `Kế Hoạch Clear` **chỉ có trên sheet `Dashboard`**, phải join `Data ← Dashboard` theo `(MÃ HÀNG, SỐ LÔ)`. Script log `Join duoc x/y dong` — hai số phải bằng nhau.

Nhóm `BB` (bao bì) không có HSD nên NSX/HSD/%HSD = 0, UI hiện dấu gạch. Cột `VỊ TRÍ` của sheet `Data` trả về literal `'FUNCTION'` ở mọi dòng (lỗi API Portal) nên đã bỏ khỏi UI và CSV.

**BC04 — Thời Hạn Hợp Đồng:** đọc sheet `Dashboard`. Cột `THỜI HẠN HĐ CÒN LẠI` và `TRẠNG THÁI` **đã được tính sẵn bằng công thức Excel** dựa vào `TODAY()` (so sánh với `NGÀY HẾT HẠN`, ưu tiên HĐ mới nếu có gia hạn) — script chỉ đọc giá trị (`data_only=True`), không tự tính lại ngưỡng NearExpiry (60 ngày đã nằm trong công thức Excel). `TRẠNG THÁI = "-"` nghĩa là hợp đồng không xác định thời hạn cố định (tự gia hạn hàng năm, theo thông báo mới...). Cột người phụ trách được join thêm từ sheet `Vai trò` theo `Khu Vực`.

## Chạy local

```bash
cd "C:\Users\khoatnd\.gemini\antigravity\scratch\sabeco-dashboard"
python -m http.server 8000     # rồi mở http://localhost:8000
```

Mở bằng `file://` sẽ bị CORS chặn `fetch` — `script.js` fallback sang payload rỗng và hiện dải cảnh báo vàng thay vì lỗi trắng trang.

## Cập nhật dữ liệu

```bash
python export_hangguic1.py     # BC01 (đa ngày, tự phát hiện file mới trong folder Gui C1)
python export_to_json.py       # BC02
python export_hangblock.py     # BC03 (điền sheet Dashboard trước)
python export_hopdong.py       # BC04
```

Đóng Excel trước khi chạy. Script `shutil.copy2` ra bản tạm rồi `openpyxl.load_workbook(data_only=True, read_only=True)` nên không khoá file gốc. Reload web bằng `Ctrl+F5`.

## Thêm báo cáo mới

1. Copy `export_hangblock.py`, sửa đường dẫn Excel + chỉ số cột + `OUTPUT_JSON`.
2. Trong `script.js`, đổi placeholder trong mảng `REPORTS`:
   ```javascript
   { id:'bc4', idx:'04', name:'...', desc:'...', icon:'fa-box', ready:true,
     file:'data_moi.json', arrayKey:'...', prefix:'BC04_...' },
   ```
3. Viết `renderBC4()` theo mẫu `renderBC3()`, thêm nhánh trong `renderReport()`, thêm cột vào `EXPORT_COLS`.

Filter/sort/search/export/chip đếm dòng dùng chung, không cần viết lại.

## Deploy GitHub Pages

```bash
git init
git add index.html style.css script.js data.json data_hangblock.json
git commit -m "Dashboard bao cao kho SABECO"
git remote add origin https://github.com/USERNAME/sabeco-dashboard.git
git branch -M main && git push -u origin main
```

Settings → Pages → Source `main` / `/ (root)` → Save.

**Lưu ý bảo mật:** repo public nghĩa là ai có link đều xem được toàn bộ số liệu tồn kho. Cân nhắc repo private (Pages riêng tư cần Enterprise), chạy local, hoặc host nội bộ. Không bao giờ commit `taikhoan.txt` (chứa tài khoản Portal Sabeco).

## Theme

```css
--sabeco-green: #0a422a       /* Chính */
--sabeco-green-light: #1e5a40 /* Hover */
--sabeco-green-pale: #e8f0ec  /* Background nhẹ */
--sabeco-gold: #c9a13b        /* Accent */
--sabeco-gold-light: #e0bf62  /* Highlight */
--sabeco-bg: #f8f9fa          /* Background tổng */
```

Phối màu cột: STT cam `#ea580c`, mã kho đen đậm, mã hàng xanh dương `#2563eb`, tên hàng slate `#334155`, số lượng đen đậm mono, ngày xám mono `#64748b`, khu vực xanh SABECO, số lô tím `#7c3aed`. Pill %HSD: đỏ `<30`, cam `<45`, vàng `<55`, xanh `>=55`.

## Liên hệ

**Khoa Trương** — Phòng Kho vận, SABECO
