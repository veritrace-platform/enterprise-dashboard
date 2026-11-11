VeriTrace · M1 Operational Core · dành cho frontend

# Sổ tay frontend M1

Backend của M1 đã xong và đã phát hành trên nhánh `main`: REST API của core và telemetry, WebSocket thời gian thực, dữ liệu demo và simulator cảm biến. Sổ tay này giúp bạn chạy cả hệ thống trên máy, có dữ liệu để làm việc ngay, và tránh những điểm tích hợp dễ sai khi xây dashboard và PWA.

Mọi lệnh, script và đoạn TypeScript dưới đây đã được chạy thử trên backend M1 ngày 2026-10-04.

Tra nhanhSSCC (00) 0 8930001 000000001 8

Mở app

dashboard http://localhost:8001 · PWA :8002 · portal :8003

Dev server

3001 · 3002 · 3003, luôn mở qua cổng 800x

API

/api/v1/… cùng origin · WebSocket /ws/v1/notifications

Bật backend

make up-apps · make seed (trong platform-infrastructure)

Mật khẩu demo

veritrace-demo-2026

Hợp đồng

[core openapi.yaml](https://github.com/veritrace-platform/core-business-service/blob/main/api/openapi.yaml) · [telemetry openapi.yaml](https://github.com/veritrace-platform/telemetry-stream-service/blob/main/api/openapi.yaml)

## Mục lục

1. [1Phạm vi M1](#scope)
2. [2Tài liệu gốc](#docs)
3. [3Chuẩn bị máy](#machine)
4. [4Chạy backend](#backend)
5. [5Frontend sau gateway](#gateway)
6. [6Tài khoản và dữ liệu](#data)
7. [7Gọi REST API](#api)
8. [8Phiên đăng nhập](#session)
9. [9Real-time và biểu đồ](#realtime)
10. [10PWA trên điện thoại](#phone)
11. [11Stack và những gì cần giữ](#stack)
12. [12Sự cố và báo lỗi](#trouble)

## 01Phạm vi frontend của M1

M1 có năm story frontend. Mọi endpoint mà các story này cần đã chạy thật, nên bạn làm việc trên API thật ngay từ đầu; MSW chỉ còn cần cho test.

| Story | Repo | Nội dung |
| --- | --- | --- |
| EP0-US06 | cả ba repo | Nền tảng: scaffold, client API có type, phiên BFF, i18n vi/en, client real-time, CI |
| EP1-US06 | enterprise-dashboard | Đăng ký tenant, đăng nhập, quản lý người dùng, hồ sơ tenant, hồ sơ cá nhân và đổi mật khẩu |
| EP2-US10 | enterprise-dashboard | Tổng quan, danh mục, lô, tồn kho, shipment (tạo, gán, mã lấy hàng, giao, hủy), thu hồi, in nhãn |
| EP2-US11 | driver-mobile-pwa | Việc của tài xế, lấy hàng, checkpoint, nhận hàng tại kho, xem offline chỉ đọc |
| EP3-US08 | dashboard và PWA | Biểu đồ nhiệt độ trực tiếp và trung tâm cảnh báo |

Thứ tự gợi ý:

1. EP0-US06 trước. Client API có type, phiên BFF và client real-time là nền của mọi màn hình.
2. EP1-US06, vì mọi màn hình khác cần đăng nhập.
3. EP2-US10 và EP2-US11 song song, theo đường đi của một shipment: tạo và gán trên dashboard, lấy hàng và checkpoint trên PWA, nhận hàng, rồi thu hồi.
4. EP3-US08, khi trang chi tiết shipment và thẻ shipment trên PWA đã có.

`public-trace-portal` trong M1 chỉ cần scaffold (thuộc EP0-US06). Các trang của portal là việc của M2 (EP6-US05).

## 02Tài liệu gốc

Sổ tay này là đường tắt. Đặc tả nằm trong repo `veritrace` và đã chốt. Nếu thấy đặc tả thiếu hoặc không hợp lý, hãy báo người phụ trách backend thay vì tự làm khác; thay đổi quyết định được ghi bằng một ADR mới.

| Tài liệu | Đọc khi |
| --- | --- |
| [frontend/README.md](https://github.com/veritrace-platform/veritrace/blob/main/docs/frontend/README.md) | Quy ước chung: i18n, ngày giờ, số, ô nhập GS1, lỗi, quyền, màu trạng thái; client real-time; CI gợi ý |
| [frontend/enterprise-dashboard.md](https://github.com/veritrace-platform/veritrace/blob/main/docs/frontend/enterprise-dashboard.md) | Route, endpoint, vai trò và story của từng màn hình dashboard |
| [frontend/driver-mobile-pwa.md](https://github.com/veritrace-platform/veritrace/blob/main/docs/frontend/driver-mobile-pwa.md) | Màn hình và luồng của PWA: lấy hàng, checkpoint, nhận hàng, bảng mã lỗi |
| [guides/frontend-integration.md](https://github.com/veritrace-platform/veritrace/blob/main/docs/guides/frontend-integration.md) | Hợp đồng backend dành cho frontend: origin, phiên BFF, lỗi, quy tắc domain, real-time |
| [contracts/rest-api.md](https://github.com/veritrace-platform/veritrace/blob/main/docs/contracts/rest-api.md) | Quy ước REST, toàn bộ mã lỗi, danh sách endpoint |
| [contracts/messaging.md §6](https://github.com/veritrace-platform/veritrace/blob/main/docs/contracts/messaging.md#6-websocket-real-time-notifications) | WebSocket: subprotocol, message, close code |
| [domain/access-control.md](https://github.com/veritrace-platform/veritrace/blob/main/docs/domain/access-control.md) | Ma trận quyền theo vai trò, bên tham gia và trạng thái |
| [domain/shipment-lifecycle.md](https://github.com/veritrace-platform/veritrace/blob/main/docs/domain/shipment-lifecycle.md) | Trạng thái shipment, giao nhận, hủy, thu hồi, nhật ký sự kiện |
| [domain/gs1-identifiers.md](https://github.com/veritrace-platform/veritrace/blob/main/docs/domain/gs1-identifiers.md) | GTIN, GLN, SSCC, check digit; chuẩn hóa mã quét được (§3.1) |
| [domain/cold-chain-monitoring.md](https://github.com/veritrace-platform/veritrace/blob/main/docs/domain/cold-chain-monitoring.md) | Quy tắc vi phạm nhiệt độ: vượt ngưỡng liên tục 30 s, mất tín hiệu quá 15 s thì ngắt episode |
| [ADR-0020](https://github.com/veritrace-platform/veritrace/blob/main/docs/adr/0020-frontend-stack.md), [0021](https://github.com/veritrace-platform/veritrace/blob/main/docs/adr/0021-frontend-origin-and-session.md), [0022](https://github.com/veritrace-platform/veritrace/blob/main/docs/adr/0022-driver-pwa-device-capabilities.md) | Stack đề xuất (mục 11), origin và phiên đăng nhập, khả năng thiết bị của PWA |
| Hai file `api/openapi.yaml` | Hợp đồng thực thi; mọi request và response đều có example |
| [contracts/test-vectors/](https://github.com/veritrace-platform/veritrace/tree/main/docs/contracts/test-vectors) | Vector test cho GS1 check digit, JSON chuẩn hóa, hash của sự kiện và incident |

## 03Chuẩn bị máy

| Công cụ | Ghi chú |
| --- | --- |
| Docker Engine hoặc Docker Desktop, có Compose v2 | Chạy toàn bộ backend trong container; không cần cài Go hay Python. Stack dùng khoảng 1 GB RAM. |
| GNU Make, Git |  |
| Node.js LTS, pnpm | Bật pnpm bằng `corepack enable` |
| curl, jq | Cho script dữ liệu mẫu ở mục 6 |

Trên Windows, làm mọi thứ trong WSL2 và để các repo trong filesystem của WSL.

## 04Chạy backend

Mọi repo nằm cạnh nhau trong một thư mục cha. `make up-apps` build core và telemetry từ các repo bên cạnh, và script sinh type ở mục 7 đọc `../core-business-service/api/openapi.yaml`, nên các repo frontend của bạn cũng nằm trong thư mục này. Nếu đã clone chúng ở nơi khác, hãy chuyển vào đây.

bash

```
mkdir veritrace-platform && cd veritrace-platform
git clone https://github.com/veritrace-platform/veritrace.git
make -C veritrace workspace     # clone mọi repo còn thiếu, kể cả ba repo frontend, nằm cạnh nhau
for r in veritrace platform-infrastructure core-business-service telemetry-stream-service; do
  git -C "$r" switch main       # bản backend M1 đã phát hành
done
cd platform-infrastructure
make up-apps                    # hạ tầng, gateway, core và telemetry; lần đầu build mất vài phút
make seed                       # công ty, tài khoản, kho, sản phẩm, lô; chạy lại không sao
make ps                         # mọi container ở trạng thái healthy
```

**Kỳ vọng:** `make ps` báo mọi container `healthy`, và `curl -s http://localhost:8000/.well-known/jwks.json` trả về JSON có `keys`.

Muốn clone bằng SSH: `VERITRACE_GIT_BASE=git@github.com:veritrace-platform make -C veritrace workspace`.

### Hằng ngày

| Việc | Lệnh, chạy trong platform-infrastructure |
| --- | --- |
| Bật backend, kể cả sau khi khởi động lại máy | `make up-apps` |
| Xem trạng thái và log | `make ps`, `make logs SERVICE=core-business-service` |
| Tắt, giữ dữ liệu | `make down` |
| Xóa dữ liệu, làm lại từ đầu | `make reset && make up-apps && make seed` |
| Tất cả lệnh | `make help` |

Lưu ý

Luôn bật backend bằng `make up-apps`. `make up` chỉ bật hạ tầng và trỏ gateway tới service chạy trên host, là cách làm của người viết Go. Nếu lỡ chạy nó, API qua gateway sẽ trả `502`; chạy lại `make up-apps` là xong.

Khi backend có bản mới trên `main`:

bash

```
cd platform-infrastructure
for r in veritrace platform-infrastructure core-business-service telemetry-stream-service; do
  git -C "../$r" pull --ff-only
done
make up-apps                    # build lại các service nếu mã đã đổi
```

Sau đó sinh lại type (mục 7) để thấy ngay mọi thay đổi của hợp đồng khi biên dịch.

## 05Chạy frontend sau gateway

Trình duyệt chỉ nói chuyện với một origin, là cổng gateway của app (ADR-0021). Gateway chuyển API và WebSocket tới backend, mọi đường dẫn khác tới dev server của bạn trên host. Vì vậy không có CORS, và cookie phiên cùng origin với API.

| App | Dev server | Mở trong trình duyệt |
| --- | --- | --- |
| enterprise-dashboard | `pnpm dev --port 3001` | http://localhost:8001 |
| driver-mobile-pwa | `pnpm dev --port 3002` | http://localhost:8002 |
| public-trace-portal | `pnpm dev --port 3003` | http://localhost:8003 |

| Đường dẫn trên cổng 8001, 8002, 8003 | Đi tới |
| --- | --- |
| `/api/v1/telemetry/*`, `/ws/*` | telemetry-stream-service |
| `/api/v1/*`, `/.well-known/*` | core-business-service |
| Mọi đường dẫn khác, kể cả `/bff/*` | Dev server của app |

Mở cổng 800x

Đừng mở trực tiếp cổng 300x: ở đó `/api/v1` và `/ws` không tới được backend.

Biến môi trường cho dashboard và PWA (tên giống nhau ở mọi app, theo ADR-0021):

.env.local

```
API_BASE_URL=http://localhost:8000   # chỉ phía server (BFF) dùng, để gọi API qua gateway
SESSION_SECRET=                      # 32 byte ngẫu nhiên, tạo bằng: openssl rand -base64 32
```

Code chạy trong trình duyệt gọi đường dẫn tương đối `/api/v1/…` và không dùng `API_BASE_URL`. Để trống `NEXT_PUBLIC_WS_URL`: URL WebSocket được suy ra từ `location`.

Gateway tới dev server qua `host.docker.internal`. `next dev` mặc định nghe trên mọi interface nên chạy được ngay. Nếu cổng 800x trả `502` trong khi dev server đang chạy, thử `pnpm dev -H 0.0.0.0 --port 3001` và kiểm tra firewall.

## 06Tài khoản và dữ liệu mẫu

`make seed` tạo bốn công ty. Mọi tài khoản dùng mật khẩu `veritrace-demo-2026` (biến `DEMO_PASSWORD` trong `platform-infrastructure/.env`), và `make demo-accounts` in lại danh sách.

| Email | Công ty, vai trò | Dùng để |
| --- | --- | --- |
| admin@sgfresh.example | SGFRESH, ADMIN | Dashboard của chủ hàng: người dùng, địa điểm, thu hồi lô |
| warehouse@sgfresh.example | SGFRESH, WAREHOUSE_MANAGER | Sản phẩm, lô, tồn kho, tạo shipment, cấp mã lấy hàng |
| admin@mekongcold.example | MEKONG_COLD, ADMIN | Dashboard của nhà vận chuyển |
| dispatch@mekongcold.example | MEKONG_COLD, WAREHOUSE_MANAGER | Gán tài xế |
| driver@mekongcold.example | MEKONG_COLD, DRIVER | PWA: việc được giao, lấy hàng, checkpoint |
| admin@d7mart.example | D7MART, ADMIN | Dashboard của bên nhận |
| dock@d7mart.example | D7MART, WAREHOUSE_MANAGER | Nhận hàng: PWA `/receive` hoặc dashboard |
| admin@hanoidairy.example | HANOI_DAIRY, ADMIN | Tenant ngoài cuộc: kiểm tra không lộ dữ liệu của tenant khác |

Đăng nhập bị giới hạn 10 lần mỗi phút cho mỗi địa chỉ, và ở máy local mọi trình duyệt dùng chung một địa chỉ. Gặp `429 RATE_LIMITED` thì đợi số giây trong header `Retry-After`.

### Thế giới demo

| Cơ sở | Công ty | GLN | Vĩ độ, kinh độ | Geo-fence |
| --- | --- | --- | --- | --- |
| Tan Thuan cold store, điểm đi | SGFRESH | 8930001000025 | 10.7627, 106.7429 | 300 m |
| Thu Duc cold depot, checkpoint | MEKONG_COLD | 8935002000012 | 10.8502, 106.7719 | 300 m |
| District 7 store hub, điểm đến | D7MART | 8934567000017 | 10.7296, 106.7188 | 250 m |

SGFRESH bán sữa tươi thanh trùng `08930001000018` (2–8 °C), sữa chua `08930001000025` (2–6 °C) và cá basa đông lạnh `08930001000032` (−25 đến −18 °C). Mỗi sản phẩm có một lô ở kho Tan Thuan: `L2026-MILK-01` (2000), `L2026-YOG-01` (1000), `L2026-BASA-01` (500).

### Shipment mẫu ở mọi trạng thái

Seed không tạo shipment. Script dưới đây tạo một shipment cho mỗi trạng thái, từ lô `L2026-MILK-01`, đi từ kho Tan Thuan tới District 7 store hub, với Mekong Cold làm nhà vận chuyển. Lưu script thành `sample-data.sh` trong thư mục `veritrace-platform` rồi chạy bằng bash. Mỗi lần chạy tạo bốn shipment mới và dùng 132 trong 2000 đơn vị của lô.

bash

```
bash sample-data.sh                          # VT=http://localhost:8000 và PW=veritrace-demo-2026 là mặc định
# CREATED     089300010000000018  01a104b4-b490-78f5-962c-e7e4f5e34809
# IN_TRANSIT  089300010000000025  01a104b4-b4c0-71df-8511-6d6570a82d8b
# DELIVERED   089300010000000032  01a104b4-b505-7d75-b0c8-8ca3dfcb8dca
# CANCELLED   089300010000000049  01a104b4-b54f-7be7-b654-18871d4a276e
```

bash

```
#!/usr/bin/env bash
# Sample data for frontend work on top of `make seed`.
#   bash sample-data.sh                 one shipment per status, between the demo facilities
#   bash sample-data.sh here LAT LON    facilities at your own position, and a shipment ready for pickup there
set -euo pipefail
VT=${VT:-http://localhost:8000}
PW=${PW:-veritrace-demo-2026}

# api METHOD PATH TOKEN [JSON]: prints the response body; prints the problem and fails on an error status.
api() {
  local args=(-s -w '\n%{http_code}' -X "$1" "$VT$2") out status
  [ -n "$3" ] && args+=(-H "Authorization: Bearer $3")
  [ -n "${4:-}" ] && args+=(-H 'Content-Type: application/json' --data "$4")
  out=$(curl "${args[@]}")
  status=${out##*$'\n'}
  out=${out%$'\n'*}
  if ((status >= 400)); then echo "$1 $2 -> HTTP $status $out" >&2; return 1; fi
  printf '%s\n' "$out"
}
login() { api POST /api/v1/auth/login "" "{\"email\":\"$1\",\"password\":\"$PW\"}" | jq -r .access_token; }
id_of() { jq -r .id <<<"$1"; }
sscc_of() { jq -r .sscc <<<"$1"; }
day() { jq -rn --argjson days "$1" 'now + $days * 86400 | strftime("%Y-%m-%d")'; } # today + DAYS (UTC)

WM=$(login warehouse@sgfresh.example)
DISPATCH=$(login dispatch@mekongcold.example)
DRIVER_ID=$(api GET '/api/v1/users?role=DRIVER' "$DISPATCH" | jq -r '.items[] | select(.email == "driver@mekongcold.example") | .id')

ship() { # LOT ORIGIN_ID DESTINATION_GLN QUANTITY -> a CREATED shipment, carried by Mekong Cold, driver assigned
  local shipment
  shipment=$(api POST /api/v1/shipments "$WM" "{\"lot_id\":\"$1\",\"quantity\":$4,\"origin_location_id\":\"$2\",\"destination_gln\":\"$3\",\"carrier_tenant_code\":\"MEKONG_COLD\"}")
  api POST "/api/v1/shipments/$(id_of "$shipment")/driver" "$DISPATCH" "{\"driver_user_id\":\"$DRIVER_ID\"}"
}

samples() {
  local driver dock store lot origin hub created in_transit delivered cancelled shipment
  driver=$(login driver@mekongcold.example)
  dock=$(login dock@d7mart.example)
  store=$(api GET '/api/v1/locations?limit=100' "$WM" | jq -r '.items[] | select(.gln == "8930001000025") | .id')
  lot=$(api GET '/api/v1/lots?limit=100' "$WM" | jq -r '.items[] | select(.lot_number == "L2026-MILK-01") | .id')
  origin='{"latitude":10.7627,"longitude":106.7429,"accuracy_meters":8}'
  hub='{"latitude":10.7296,"longitude":106.7188,"accuracy_meters":8}'
  pick_up() {
    local code
    code=$(api POST "/api/v1/shipments/$(id_of "$1")/pickup-code" "$WM" | jq -r .code)
    api POST "/api/v1/shipments/$(id_of "$1")/pickup" "$driver" "{\"sscc\":\"$(sscc_of "$1")\",\"code\":\"$code\",\"position\":$origin}"
  }
  created=$(ship "$lot" "$store" 8934567000017 24)
  in_transit=$(pick_up "$(ship "$lot" "$store" 8934567000017 48)")
  delivered=$(pick_up "$(ship "$lot" "$store" 8934567000017 48)")
  delivered=$(api POST "/api/v1/shipments/$(id_of "$delivered")/delivery" "$dock" "{\"sscc\":\"$(sscc_of "$delivered")\",\"position\":$hub}")
  cancelled=$(ship "$lot" "$store" 8934567000017 12)
  cancelled=$(api POST "/api/v1/shipments/$(id_of "$cancelled")/cancel" "$WM" '{"reason":"The customer postponed the order"}')
  for shipment in "$created" "$in_transit" "$delivered" "$cancelled"; do
    jq -r '"\(.status)\t\(.sscc)\t\(.id)"' <<<"$shipment"
  done
}

# place TOKEN GLN NAME LAT LON -> the id of the tenant's location with this GLN, created or moved to LAT LON
place() {
  local id body
  body="\"latitude\":$4,\"longitude\":$5,\"geo_fence_radius_meters\":1000"
  id=$(api GET '/api/v1/locations?limit=100' "$1" | jq -r --arg gln "$2" '.items[] | select(.gln == $gln) | .id')
  if [ -n "$id" ]; then
    api PATCH "/api/v1/locations/$id" "$1" "{$body,\"is_active\":true}" | jq -r .id
  else
    api POST /api/v1/locations "$1" "{\"gln\":\"$2\",\"name\":\"$3\",\"address\":\"Developer desk\",\"city\":\"Ho Chi Minh City\",$body}" | jq -r .id
  fi
}

here() {
  local lat=$1 lon=$2 origin product lot shipment issued
  origin=$(place "$(login admin@sgfresh.example)" 8930001000902 "Saigon Fresh desk store" "$lat" "$lon")
  place "$(login admin@mekongcold.example)" 8935002000906 "Mekong Cold desk depot" "$lat" "$lon" >/dev/null
  place "$(login admin@d7mart.example)" 8934567000901 "D7 Mart desk hub" "$lat" "$lon" >/dev/null
  product=$(api GET '/api/v1/products?limit=100' "$WM" | jq -r '.items[] | select(.gtin == "08930001000018") | .id')
  lot=$(api POST /api/v1/lots "$WM" "{\"product_id\":\"$product\",\"lot_number\":\"DESK-$(date +%y%m%d-%H%M%S)\",\"production_date\":\"$(day 0)\",\"expiration_date\":\"$(day 14)\",\"quantity_commissioned\":100,\"commissioned_location_id\":\"$origin\"}" | jq -r .id)
  shipment=$(ship "$lot" "$origin" 8934567000901 10)
  issued=$(api POST "/api/v1/shipments/$(id_of "$shipment")/pickup-code" "$WM")
  echo "Facilities at $lat,$lon with a 1 km geo-fence:"
  echo "  origin      8930001000902  Saigon Fresh desk store"
  echo "  checkpoint  8935002000906  Mekong Cold desk depot"
  echo "  destination 8934567000901  D7 Mart desk hub"
  jq -r '"Shipment \(.status)  SSCC \(.sscc)  id \(.id)"' <<<"$shipment"
  jq -r '"Pickup code \(.code), valid until \(.expires_at)"' <<<"$issued"
}

case "${1:-samples}" in
  samples) samples ;;
  here) here "${2:?latitude}" "${3:?longitude}" ;;
  *) echo "usage: $0 [samples | here LAT LON]" >&2; exit 2 ;;
esac
```

Màu và nhãn trạng thái dùng chung cho mọi app ([frontend/README.md §3](https://github.com/veritrace-platform/veritrace/blob/main/docs/frontend/README.md#status-colors-and-labels)):

- **CREATED** Chờ lấy hàng
- **IN_TRANSIT** Đang vận chuyển
- **DELIVERED** Đã nhận
- **CANCELLED** Đã hủy
- **RECALLED** Bị thu hồi, khóa
- **Breach** Đang vi phạm
- **Breach** Đã qua

### Vòng đời đầy đủ, vi phạm và thu hồi

`make demo` chạy trong khoảng 2 phút. Nó commission một lô `DEMO-…`, đưa shipment qua mọi bước, tạo một vi phạm nhiệt độ rồi thu hồi lô. Sau đó bạn có một shipment `RECALLED` với timeline 6 sự kiện, một incident đã kết thúc và chuỗi nhiệt độ, đủ cho timeline và trung tâm cảnh báo.

### Nhiệt độ trực tiếp

bash

```
cd platform-infrastructure
make simulate SCENARIO=normal SSCC=<SSCC đang IN_TRANSIT> ARGS="--loop"   # 4–5 °C liên tục, tới khi Ctrl+C
make simulate SCENARIO=sustained-breach SSCC=<SSCC đang IN_TRANSIT>       # một vi phạm: confirmed rồi resolved
make simulate-list                                                         # mọi kịch bản
make demo-watch ACCOUNT=admin@d7mart.example                              # thông báo của một tài khoản, in ra terminal
```

Simulator gửi một reading mỗi 5 giây cho mỗi thiết bị. Với `sustained-breach`, nhiệt độ vượt 8 °C trong 90 giây: `cold_chain.breach_confirmed` đến sau khoảng một phút rưỡi kể từ lúc chạy, `cold_chain.breach_resolved` khoảng một phút sau đó, và cả kịch bản dài chừng 3,5 phút. `short-excursion` và `sensor-gap` không tạo incident; dùng chúng để kiểm tra UI không báo nhầm.

Đừng thu hồi lô seed

Thu hồi không đảo ngược được và khóa mọi shipment của lô. Đừng thu hồi các lô `L2026-*`, vì script mẫu cần `L2026-MILK-01`. Muốn thử màn thu hồi, hãy commission một lô mới và tạo shipment từ nó. Muốn về trạng thái ban đầu: `make reset && make up-apps && make seed`.

## 07Gọi REST API

### Sinh type từ OpenAPI

Type của request và response sinh từ hai file OpenAPI, không viết tay. Mỗi service sinh một file, rồi gộp lại trong một client `openapi-fetch`.

bash

```
pnpm add openapi-fetch
pnpm add -D openapi-typescript typescript@5
```

package.json

```
"scripts": {
  "api:generate": "openapi-typescript ../core-business-service/api/openapi.yaml -o src/lib/api/core.d.ts && openapi-typescript ../telemetry-stream-service/api/openapi.yaml -o src/lib/api/telemetry.d.ts"
}
```

Giữ TypeScript 5

`openapi-typescript` 7.x yêu cầu peer `typescript ^5.x`. Với TypeScript 7, nó dừng ngay với lỗi `Cannot read properties of undefined (reading 'createKeywordTypeNode')`.

Commit các file sinh ra để build không phụ thuộc mạng. Trong CI, sinh lại từ bản đã phát hành rồi so với bản đã commit:

bash

```
pnpm exec openapi-typescript https://raw.githubusercontent.com/veritrace-platform/core-business-service/main/api/openapi.yaml -o src/lib/api/core.d.ts
pnpm exec openapi-typescript https://raw.githubusercontent.com/veritrace-platform/telemetry-stream-service/main/api/openapi.yaml -o src/lib/api/telemetry.d.ts
git diff --exit-code src/lib/api
```

ts

```
// src/lib/api/client.ts
import createClient from "openapi-fetch";
import type { components as Core, paths as CorePaths } from "./core";
import type { components as Telemetry, paths as TelemetryPaths } from "./telemetry";

export type Shipment = Core["schemas"]["Shipment"];
export type Problem = Core["schemas"]["Problem"];
export type ClientMessage = Telemetry["schemas"]["ClientMessage"];

// Một client cho cả hai service. Trong trình duyệt, đường dẫn tương đối đi qua gateway của chính app.
// Code phía server (BFF) cần baseUrl: process.env.API_BASE_URL.
export const api = createClient<CorePaths & TelemetryPaths>();

export async function listInTransit() {
  const { data, error } = await api.GET("/api/v1/shipments", {
    params: { query: { status: "IN_TRANSIT", limit: 20 } },
  });
  if (error) console.warn(error.code, error.trace_id); // error có kiểu Problem
  return data?.items ?? [];
}
```

### Quy ước

| Chủ đề | Quy tắc |
| --- | --- |
| JSON | `snake_case`; `null` nghĩa là trống có chủ đích |
| Định danh | UUID. Mã GS1 luôn là chuỗi, giữ cả số 0 ở đầu |
| Thời gian | RFC 3339 theo UTC, ví dụ `2026-10-04T02:20:30.084Z`; ngày dạng `YYYY-MM-DD`. UI hiển thị giờ địa phương |
| Danh sách | `{"items": [...], "next_cursor": "…" \| null}`; `limit` mặc định 20, tối đa 100; gửi `cursor` để lấy trang sau. Mới nhất trước, trừ sự kiện của shipment (cũ nhất trước) |
| Tạo mới | `201`, resource vừa tạo nằm trong body |
| Lệnh | `POST` vào sub-resource, ví dụ `/shipments/{id}/pickup`; trả về shipment đã cập nhật, nên có thể ghi thẳng vào cache |
| Sửa | `PATCH` theo JSON merge patch, chỉ gửi các field thay đổi |
| Truy vết | Mọi response có header `X-Trace-Id`; problem có `trace_id` |

### Lỗi

Mọi lỗi là `application/problem+json` có `code` ổn định. Ví dụ thật khi tạo sản phẩm với GTIN sai check digit:

json

```
{
  "type": "about:blank",
  "title": "Unprocessable Entity",
  "status": 422,
  "code": "INVALID_GS1_IDENTIFIER",
  "detail": "gtin expected check digit 8",
  "instance": "/api/v1/products",
  "trace_id": "126d9d09d912d9cb7a51afed64d58399",
  "errors": [{ "field": "gtin", "code": "CHECK_DIGIT", "message": "expected check digit 8" }]
}
```

- Rẽ nhánh theo `code`, không theo `title` hay `detail`, rồi dịch ra vi hoặc en.
- `errors[].field` và `errors[].code` là lỗi dưới từng ô nhập. Ví dụ đổi mật khẩu với mật khẩu hiện tại sai trả `400 VALIDATION_FAILED` với `{"field": "current_password", "code": "INCORRECT"}`.
- `404 NOT_FOUND` nghĩa là không tồn tại hoặc người dùng không được thấy; UI không phân biệt hai trường hợp này. `403 FORBIDDEN` nghĩa là thấy được nhưng không được làm.
- Lỗi không lường trước: hiện thông báo chung kèm `trace_id` và nút sao chép.

| Màn hình | Mã cần xử lý riêng |
| --- | --- |
| Đăng nhập | `INVALID_CREDENTIALS` (chung cho sai email và sai mật khẩu), `RATE_LIMITED` |
| Đăng ký tenant | `VALIDATION_FAILED`, `INVALID_GS1_IDENTIFIER` (ví dụ `PREFIX_MISMATCH` khi GLN trụ sở không thuộc tiền tố công ty), `IDENTIFIER_ALREADY_REGISTERED`, `RATE_LIMITED` |
| Sản phẩm, địa điểm | `INVALID_GS1_IDENTIFIER`, `IDENTIFIER_ALREADY_REGISTERED` |
| Tạo shipment | `INSUFFICIENT_STOCK`, `LOT_RECALLED`, `INVALID_GS1_IDENTIFIER` |
| Lấy hàng | `SSCC_MISMATCH`, `PICKUP_CODE_INVALID` (kèm `remaining_attempts`), `PICKUP_CODE_EXPIRED`, `PICKUP_CODE_LOCKED` (423), `OUTSIDE_GEOFENCE` (kèm `distance_meters`, `allowed_meters`), `SHIPMENT_RECALLED_LOCKED` |
| Checkpoint, giao hàng | `SSCC_MISMATCH`, `OUTSIDE_GEOFENCE`, `INVALID_STATE_TRANSITION`, `SHIPMENT_RECALLED_LOCKED` |

### Quyền theo vai trò

Ẩn menu và tắt nút mà người dùng không dùng được, kèm tooltip giải thích; server vẫn là bên quyết định. Vai trò nằm ở `user.role` của phiên. Vai trò của tenant trong một shipment là `participants[].role` của phần tử có `tenant_code` trùng `user.tenant.code`.

| Việc | Ai làm được |
| --- | --- |
| Người dùng, hồ sơ tenant, địa điểm | ADMIN |
| Sản phẩm, lô, tồn kho, tạo shipment | ADMIN, WAREHOUSE_MANAGER |
| Gán nhà vận chuyển, cấp mã lấy hàng, hủy | ADMIN, WAREHOUSE_MANAGER của bên OWNER |
| Gán tài xế | ADMIN, WAREHOUSE_MANAGER của bên CARRIER |
| Lấy hàng, checkpoint | DRIVER được gán |
| Xác nhận giao hàng | ADMIN, WAREHOUSE_MANAGER của bên CONSIGNEE |
| Thu hồi lô | ADMIN của chủ lô |
| Xem shipment, sự kiện, nhiệt độ | Mọi bên tham gia; DRIVER chỉ thấy shipment được gán |

Điều kiện về trạng thái và bối cảnh (geo-fence, SSCC, tồn kho) có trong [access-control.md §2](https://github.com/veritrace-platform/veritrace/blob/main/docs/domain/access-control.md).

## 08Phiên đăng nhập qua BFF

Dashboard và PWA giữ refresh token trong một cookie `HttpOnly` được mã hóa, do các route `/bff/session/*` của chính app quản lý. Access token chỉ nằm trong bộ nhớ. Không lưu token vào `localStorage`, `sessionStorage` hay cookie mà script đọc được.

| Bước | Trình duyệt | BFF |
| --- | --- | --- |
| Đăng nhập | `POST /bff/session/login` | Gọi `POST /api/v1/auth/login`, ghi refresh token vào cookie, trả `{access_token, expires_in, user}` |
| Gọi API | `Authorization: Bearer <access token>` | Không tham gia |
| `401 TOKEN_EXPIRED` | `POST /bff/session/refresh` một lần rồi gửi lại request | Gọi `POST /api/v1/auth/refresh` với token trong cookie, ghi cookie mới |
| Tải lại trang, mở lại app | `POST /bff/session/refresh` | Như trên |
| Đăng xuất | `POST /bff/session/logout` | Gọi `POST /api/v1/auth/logout`, xóa cookie |
| WebSocket | Subprotocol `bearer.<access token>`; bị đóng `4401` thì refresh rồi nối lại | Không tham gia |

- Login và refresh trả cùng một `Session`: `access_token` sống `expires_in` = 900 giây; `refresh_token` mới, dùng một lần; `refresh_token_expires_in` = 604800 giây (7 ngày), dùng làm `Max-Age` của cookie; và `user`, giống `GET /api/v1/me`.
- `/api/v1/auth/refresh` và `/api/v1/auth/logout` nhận `{"refresh_token": "…"}`. Logout luôn trả `204`.
- Khi gọi login, refresh và logout, BFF chuyển tiếp `X-Forwarded-For` (địa chỉ của trình duyệt) và `User-Agent` của trình duyệt. Nhờ vậy giới hạn tốc độ và danh sách phiên ứng với trình duyệt, không phải với server Next.
- Cookie: `HttpOnly`, `Secure`, `SameSite=Lax`, mã hóa bằng iron-session với `SESSION_SECRET`.

Bẫy quan trọng

Refresh token chỉ dùng được một lần. Gửi lại một refresh token đã xoay vòng bị coi là token bị đánh cắp: backend thu hồi cả họ phiên, và người dùng bị đăng xuất với `401 REFRESH_TOKEN_INVALID`. Chỉ cần hai lần refresh song song, trong cùng một tab hoặc ở hai tab dùng chung cookie, là đủ gây ra chuyện này. Vì vậy, gộp các lần refresh trong tab thành một promise, và bọc lời gọi `/bff/session/refresh` trong `navigator.locks.request` để các tab refresh lần lượt; tab sau sẽ gửi cookie mới mà tab trước vừa nhận.

Phác thảo dưới đây gắn token vào mọi request, refresh đúng một lần khi gặp `TOKEN_EXPIRED`, rồi gửi lại request kèm body. Nó đã được typecheck với `strict`, và cơ chế gộp refresh và gửi lại đã chạy thử với `openapi-fetch` 0.17: ba request song song nhận `401`, chỉ có một lần refresh, và cả ba được gửi lại thành công, kể cả `POST` có body.

ts

```
// src/lib/api/session.ts
import type { Middleware } from "openapi-fetch";
import { api } from "./client";

let accessToken: string | null = null;
let refreshing: Promise<string | null> | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token; // gọi sau khi /bff/session/login trả về
}

// Mỗi lúc chỉ một lần refresh: dùng chung trong tab, xếp hàng giữa các tab (refresh token chỉ dùng một lần).
export function refreshSession(): Promise<string | null> {
  refreshing ??= refreshOnce().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

async function refreshOnce(): Promise<string | null> {
  accessToken = await navigator.locks.request("veritrace-session-refresh", async () => {
    const response = await fetch("/bff/session/refresh", { method: "POST" });
    return response.ok ? ((await response.json()) as { access_token: string }).access_token : null;
  });
  return accessToken;
}

const retryable = new WeakMap<Request, Request>();

const auth: Middleware = {
  onRequest({ request }) {
    if (accessToken) request.headers.set("Authorization", `Bearer ${accessToken}`);
    retryable.set(request, request.clone()); // fetch dùng hết body; giữ một bản để gửi lại một lần
    return request;
  },
  async onResponse({ request, response }) {
    if (response.status !== 401) return response;
    const problem = (await response.clone().json().catch(() => null)) as { code?: string } | null;
    const retry = retryable.get(request);
    if (problem?.code !== "TOKEN_EXPIRED" || !retry) return response;
    const token = await refreshSession();
    if (!token) return response; // phiên đã hết: chuyển về /login
    retry.headers.set("Authorization", `Bearer ${token}`);
    return fetch(retry);
  },
};

api.use(auth);
```

Khi trang tải lại, gọi `refreshSession()` trước khi hiện phần cần đăng nhập. Nếu nó trả `null`, chuyển về `/login`.

## 09Real-time và biểu đồ nhiệt độ

Mỗi phiên mở một kết nối WebSocket tới `/ws/v1/notifications` trên chính origin của app. Thông báo vi phạm và thu hồi tự đến với mọi bên tham gia. Dữ liệu nhiệt độ trực tiếp thì cần subscribe theo SSCC.

Type sinh ra cho `NotificationMessage` là một union có phân biệt theo `type`, nên `switch (message.type)` tự thu hẹp kiểu của `data`:

ts

```
// src/lib/realtime/client.ts
import type { components } from "../api/telemetry";

type NotificationMessage = components["schemas"]["NotificationMessage"];
type ClientMessage = components["schemas"]["ClientMessage"];

// accessToken lấy từ session.ts; appendPoint, notify, openRecallModal là hàm của UI.
const url = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws/v1/notifications`;
const socket = new WebSocket(url, ["veritrace.v1", `bearer.${accessToken}`]);

socket.onopen = () => {
  const subscribe: ClientMessage = { type: "subscribe", channel: "telemetry", sscc: "089300010000000025" };
  socket.send(JSON.stringify(subscribe));
};

socket.onmessage = (event) => {
  const message = JSON.parse(event.data) as NotificationMessage;
  switch (message.type) {
    case "telemetry.reading":
      appendPoint(message.data.recorded_at, message.data.temperature_celsius);
      break;
    case "cold_chain.breach_confirmed":
      notify(`${message.data.product_name}: ${message.data.temperature_celsius} °C`);
      break;
    case "shipment.recalled":
      openRecallModal(message.data.shipment_id, message.data.reason);
      break;
  }
};
```

| type | Nhận khi | Gợi ý xử lý |
| --- | --- | --- |
| `cold_chain.breach_confirmed` | Tenant là bên tham gia; tài xế chỉ với shipment được gán | Toast và chuông; làm mới incident và shipment |
| `cold_chain.breach_resolved` | Như trên | Chuyển incident sang đã qua |
| `shipment.recalled` | Bên tham gia của shipment bị thu hồi | Dashboard: modal đỏ chặn thao tác. PWA: màn hình đỏ “Không giao hàng” |
| `telemetry.reading` | Đã subscribe SSCC đó | Nối điểm vào biểu đồ |
| `subscribed`, `unsubscribed` | Trả lời subscribe, unsubscribe |  |
| `error` | Subscribe không thực hiện được | `NOT_FOUND`: kết nối vẫn mở; với shipment vừa tạo, thử lại sau vài giây. `FORBIDDEN`: tài xế không được gán, kết nối đóng `4403` |

Với breach và recall, `id` của message là `event_id` của sự kiện gốc: bỏ qua message có `id` đã thấy. Hai message thật từ lần chạy thử:

json

```
{"type": "telemetry.reading", "id": "01a104b5-1a88-76ec-972f-c91affaca36f", "sent_at": "2026-10-04T02:19:00.104Z",
 "data": {"device_id": "SIM-089300010000000025-1", "sscc": "089300010000000025", "recorded_at": "2026-10-04T02:19:00.084Z",
          "temperature_celsius": 4.53, "humidity_percent": 67.9, "latitude": 10.7627, "longitude": 106.7429}}
{"type": "cold_chain.breach_resolved", "id": "01a104b7-6464-7135-b42e-3d2c2fadf8dc", "sent_at": "2026-10-04T02:21:30.106Z",
 "data": {"incident_id": "01a104b6-04d4-7dab-9cb4-ce0ebf42fd49", "sscc": "089300010000000025", "ended_at": "2026-10-04T02:21:30.084Z",
          "duration_seconds": 90, "extreme_temperature_celsius": 11.44}}
```

### Đóng kết nối và nối lại

| Mã đóng | Nghĩa | Client làm gì |
| --- | --- | --- |
| 4401 | Token thiếu, sai hoặc hết hạn. Server đóng đúng lúc token hết hạn, sau 15 phút | Refresh phiên rồi nối lại |
| 4403 | Tài xế subscribe shipment không được gán | Không subscribe SSCC đó nữa |
| 4408 | Quá 20 subscription | Bỏ bớt subscription |
| 4400, 1009 | Frame không hợp lệ: không phải JSON text, hoặc dài quá 4 KiB (quá 64 KiB thì đóng 1009) | Sửa client |
| 1001, 1008, 1013, lỗi mạng | Server tắt, client đọc chậm (tụt quá 256 message), backend tạm không kiểm tra được token | Nối lại với backoff từ 1 s tới 30 s, có jitter |

Sau mỗi lần nối lại, subscribe lại các SSCC đang xem và refetch các query liên quan: message phát ra trong lúc mất kết nối không được gửi lại. Server tự ping mỗi 30 giây, và trình duyệt tự trả lời.

### Biểu đồ nhiệt độ

- `GET /api/v1/telemetry/shipments/{sscc}/readings?resolution=raw|1m|15m&from=&to=`. Cửa sổ tối đa: `raw` 6 giờ, `1m` 7 ngày, `15m` 90 ngày. Mặc định `to` là bây giờ, còn `from` lùi 1 giờ, 1 ngày hoặc 7 ngày. Kết quả `{sscc, resolution, from, to, items}`, cũ nhất trước, không phân trang.
- `raw` trả từng reading. `1m` và `15m` trả `bucket`, `avg_temperature_celsius`, `min_temperature_celsius`, `max_temperature_celsius`, `reading_count`.
- Biểu đồ trực tiếp: tải `raw`, rồi nối thêm các `telemetry.reading` khi đang subscribe.
- Dải an toàn lấy từ `min_temp_celsius`, `max_temp_celsius` của shipment. Incident của một shipment: `GET /api/v1/telemetry/shipments/{sscc}/incidents`. Trung tâm cảnh báo: `GET /api/v1/telemetry/incidents?state=open|resolved` và `GET /api/v1/telemetry/incidents/summary`.

## 10Test PWA trên điện thoại

### Trên máy tính trước

- Camera: webcam chạy được trên http://localhost:8002, vì `localhost` là secure context.
- Vị trí: Chrome DevTools, mục Sensors, ô Location, nhập tọa độ của cơ sở ở mục 6. Ví dụ để lấy hàng ở kho Tan Thuan: 10.7627, 106.7429.
- Nhãn để quét: trang in nhãn `/shipments/{id}/label` của dashboard (EP2-US10) vẽ mã GS1-128 `(00)` + SSCC; mở nó trên màn hình máy tính rồi quét bằng điện thoại. Nhập tay 18 chữ số luôn có sẵn.

### Trên điện thoại qua HTTPS

bash

```
cd platform-infrastructure
make tunnel TUNNEL_TARGET=http://gateway:8002     # in ra https://….trycloudflare.com
```

Mở URL đó trên điện thoại. Trang, API và WebSocket dùng chung một origin HTTPS, nên camera, vị trí và service worker đều chạy. URL đổi sau mỗi lần chạy.

Nếu Next.js báo chặn request dev từ origin lạ, thêm `allowedDevOrigins: ["*.trycloudflare.com"]` vào `next.config`.

### Với GPS thật

GPS của điện thoại sẽ nằm ngoài geo-fence của các kho demo. Chế độ `here` của script ở mục 6 tạo ba cơ sở ngay tại vị trí của bạn, với geo-fence 1 km, và một shipment sẵn sàng lấy hàng:

bash

```
bash sample-data.sh here 10.7769 106.7009     # vĩ độ, kinh độ của bạn; trên Google Maps, nhấn giữ một điểm để xem
# Facilities at 10.7769,106.7009 with a 1 km geo-fence:
#   origin      8930001000902  Saigon Fresh desk store
#   checkpoint  8935002000906  Mekong Cold desk depot
#   destination 8934567000901  D7 Mart desk hub
# Shipment CREATED  SSCC 089300010000000117  id 01a104c2-4184-7f5d-8e57-df226d3a2aee
# Pickup code 130565, valid until 2026-10-04T02:48:22.091685355Z
```

1. Đăng nhập PWA bằng `driver@mekongcold.example`, mở shipment, quét hoặc nhập SSCC, rồi nhập mã lấy hàng. Mã sống 15 phút; hết hạn thì cấp mã mới trên dashboard bằng `warehouse@sgfresh.example`.
2. Checkpoint: quét hoặc nhập GLN `8935002000906`.
3. Nhận hàng: đăng nhập `dock@d7mart.example`, vào `/receive` và quét SSCC.

Chạy lại với tọa độ khác thì ba cơ sở được dời tới đó, và một shipment mới được tạo.

## 11Stack và những gì cần giữ

Trong M1, bạn chọn stack cho phù hợp với cách làm của mình. ADR-0020 là một đề xuất; tài liệu về stack sẽ được cập nhật theo lựa chọn thực tế sau khi M1 xong. Các đoạn mẫu trong sổ tay dùng `openapi-fetch`, nhưng nếu bạn dùng axios hay một client khác, vẫn lấy type từ các file đã sinh (`paths`, `components`).

Những điểm dưới đây gắn với backend, nên cần giữ đúng:

| Điểm | Vì sao |
| --- | --- |
| Một origin cho mỗi app, đi qua gateway (mục 5) | Backend không bật CORS, và WebSocket chỉ nhận kết nối từ origin của gateway |
| Phiên qua BFF: refresh token trong cookie `HttpOnly`, access token trong bộ nhớ (mục 8) | Refresh token không được lộ cho script; backend xoay vòng và phát hiện dùng lại |
| BFF chuyển tiếp `X-Forwarded-For` và `User-Agent` | Giới hạn tốc độ và danh sách phiên tính theo trình duyệt |
| Type sinh từ OpenAPI, không viết tay (mục 7) | Mọi thay đổi hợp đồng hiện ra ngay khi biên dịch |
| Rẽ nhánh lỗi theo `code` của problem | `title` và `detail` có thể đổi; `code` thì ổn định |
| Kiểm tra GS1 phía client đúng như backend | Dùng các vector trong `contracts/test-vectors/gs1-check-digit.json` |

## 12Sự cố thường gặp và báo lỗi

| Triệu chứng | Nguyên nhân và cách xử lý |
| --- | --- |
| `502` khi mở localhost:8001 | Dev server chưa chạy ở 3001, hoặc Docker không tới được nó. Chạy `pnpm dev --port 3001`; nếu vẫn lỗi, thêm `-H 0.0.0.0` và kiểm tra firewall |
| `502` ở `/api/v1/…` | Service chưa chạy, hoặc đã lỡ chạy `make up`. Chạy `make up-apps` rồi xem `make ps` |
| `/api/v1/…` trả 404 của Next | Đang mở cổng 300x; mở cổng 800x |
| `429 RATE_LIMITED` khi đăng nhập | Quá 10 lần mỗi phút; đợi `Retry-After` giây |
| `401 TOKEN_EXPIRED` | Access token sống 15 phút: refresh một lần rồi gửi lại |
| Bị đăng xuất bất chợt, `401 REFRESH_TOKEN_INVALID` | Hai lần refresh song song đã dùng lại cùng một refresh token (mục 8) |
| WebSocket đóng `4401` sau 15 phút | Bình thường: token hết hạn. Refresh rồi nối lại |
| Subscribe trả `error` `NOT_FOUND` cho shipment vừa tạo | Telemetry nhận shipment qua Kafka chậm hơn một chút; thử lại sau vài giây |
| `OUTSIDE_GEOFENCE` khi test | Vị trí nằm ngoài geo-fence: dùng DevTools Sensors hoặc `sample-data.sh here` (mục 10) |
| `PICKUP_CODE_EXPIRED` | Mã chỉ sống 15 phút; cấp mã mới |
| `INSUFFICIENT_STOCK` khi chạy script mẫu | Lô `L2026-MILK-01` đã hết: `make reset && make up-apps && make seed` |
| `openapi-typescript` báo `createKeywordTypeNode` | Đang dùng TypeScript 7; cài `typescript@5` |
| Script mẫu không đăng nhập được | Stack đã được seed với `DEMO_PASSWORD` khác: chạy với `PW=<mật khẩu đó>`, hoặc `make reset` |

### Báo lỗi backend

Gửi người phụ trách backend: method, đường dẫn, body đã gửi, status và nguyên văn problem nhận về, nhất là `code` và `trace_id`. `trace_id` (cũng có trong header `X-Trace-Id`) dẫn thẳng tới log của đúng request đó. Nếu hợp đồng thiếu thứ màn hình cần, hãy nêu màn hình, story và dữ liệu cần thêm.

Sổ tay dành cho backend M1 trên nhánh `main` của veritrace-platform. Khi hợp đồng thay đổi, OpenAPI và tài liệu trong repo veritrace được cập nhật cùng lúc; hãy sinh lại type sau mỗi lần lấy backend mới.