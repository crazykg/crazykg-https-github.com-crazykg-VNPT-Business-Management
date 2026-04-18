import React from 'react';

const CUSTOMER_REQUEST_LIST_PATH = '/customer-request-management';

const overviewKpis = [
  { label: 'Ca nóng', value: '12', tone: 'border-amber-300 bg-amber-50 text-amber-900' },
  { label: 'Thiếu ước lượng', value: '08', tone: 'border-rose-300 bg-rose-50 text-rose-900' },
  { label: 'Sắp quá SLA', value: '05', tone: 'border-sky-300 bg-sky-50 text-sky-900' },
  { label: 'Đang chờ PM', value: '09', tone: 'border-slate-300 bg-slate-100 text-slate-800' },
];

const roleColumns = [
  {
    title: 'Workspace người tạo',
    tone: 'bg-sky-50 border-sky-200',
    chips: ['Đánh giá khách hàng', 'Theo dõi phản hồi', 'Báo khách hàng'],
  },
  {
    title: 'Workspace điều phối',
    tone: 'bg-amber-50 border-amber-200',
    chips: ['Giao người xử lý', 'Duyệt kết quả', 'Theo dõi tải PM'],
  },
  {
    title: 'Workspace người xử lý',
    tone: 'bg-emerald-50 border-emerald-200',
    chips: ['Việc mới', 'Đang làm', 'Ghi nhận worklog nhanh'],
  },
];

const attentionCases = [
  'CRC-202604-0192 | Thiếu ước lượng + sát SLA',
  'CRC-202604-0171 | Chờ khách hàng bổ sung thông tin',
  'CRC-202604-0158 | Trả PM lần 2 cần quyết định',
];

const inboxLanes = [
  {
    title: 'Ưu tiên mở trước',
    items: ['Ca nóng', 'Thiếu ước lượng', 'PM cần chốt'],
  },
  {
    title: 'Danh sách đang bám',
    items: ['Dòng gọn 01', 'Dòng gọn 02', 'Dòng gọn 03', 'Dòng gọn 04'],
  },
  {
    title: 'Chi tiết + hành động',
    items: ['Đầu mục case', 'Dòng thời gian ngắn', 'Thanh hành động', 'Worklog / Ước lượng / Chuyển bước'],
  },
];

const overviewCustomerRanking = [
  { label: 'Tổng công ty ABC', value: '11' },
  { label: 'VNPT tỉnh Bình Dương', value: '10' },
  { label: 'Khối khách hàng chiến lược', value: '9' },
  { label: 'Doanh nghiệp SME miền Nam', value: '8' },
];

const overviewProjectRanking = [
  { label: 'Dự án CRM doanh nghiệp', value: '7' },
  { label: 'Tích hợp DMS nội bộ', value: '6' },
  { label: 'Nâng cấp cổng CSKH', value: '5' },
];

const inboxSecondaryFilters = ['Tất cả khách hàng', 'Tất cả kênh', 'Tất cả ưu tiên'];

const WireframeShell: React.FC<{
  title: string;
  children: React.ReactNode;
}> = ({ title, children }) => (
  <section className="overflow-hidden rounded-[28px] border border-slate-300 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.08)]">
    <div className="border-b border-slate-200 bg-[linear-gradient(135deg,rgba(248,250,252,1),rgba(255,255,255,1))] px-4 py-3">
      <h2 className="text-sm font-bold leading-5 text-slate-900">{title}</h2>
    </div>
    <div className="p-3">{children}</div>
  </section>
);

const WireCard: React.FC<{
  title: string;
  tone?: string;
  children?: React.ReactNode;
}> = ({ title, tone = 'border-slate-300 bg-white', children }) => (
  <div className={`rounded-2xl border border-dashed px-3 py-3 ${tone}`}>
    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{title}</p>
    {children}
  </div>
);

const MockCaseRow: React.FC<{ compact?: boolean }> = ({ compact = false }) => (
  <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
        CRC-202604-0188
      </span>
      <span className="rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
        Nguy cơ SLA
      </span>
      <span className="rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
        PM cần duyệt
      </span>
    </div>
    <div className="mt-2 space-y-1">
      <p className="text-[12px] font-semibold leading-5 text-slate-800">
        Lỗi đồng bộ yêu cầu chăm sóc khách hàng sang DMS
      </p>
      <p className={`text-[11px] leading-4 text-slate-500 ${compact ? 'max-w-[70%]' : 'max-w-[85%]'}`}>
        Chờ xác nhận ước lượng và người phụ trách trước khi giao việc chính thức.
      </p>
    </div>
    <div className="mt-2 flex flex-wrap gap-1.5">
      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
        Phụ trách
      </span>
      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
        Tiếp theo
      </span>
      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
        Cập nhật
      </span>
    </div>
  </div>
);

export const CustomerRequestManagementWireframe: React.FC = () => (
  <div className="min-h-full bg-[radial-gradient(circle_at_top,rgba(226,232,240,0.6),rgba(248,250,252,1)_42%,rgba(255,255,255,1)_100%)] p-3 pb-6">
    <div className="mx-auto max-w-[1580px] space-y-3">
      <div className="rounded-[28px] border border-slate-300 bg-white/95 px-4 py-4 shadow-[0_1px_3px_rgba(15,23,42,0.08)] backdrop-blur-sm">
        <h1 className="text-lg font-bold leading-6 text-slate-950">
          Wireframe giao diện tab Tổng quan + Bảng theo dõi
        </h1>
      </div>

      <div className="space-y-3">
          <WireframeShell
            title="Tab Tổng quan"
          >
            <div className="space-y-3">
              <div className="rounded-2xl border border-slate-300 bg-white px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px] font-semibold text-slate-700">
                {overviewKpis.map((item) => (
                  <div
                    key={item.label}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${item.tone}`}
                  >
                    <span>{item.label}:</span>
                    <span className="text-[12px] font-bold leading-none">{item.value}</span>
                  </div>
                ))}
                </div>
              </div>

              <div className="grid gap-3 xl:grid-cols-[minmax(0,1.15fr)_320px]">
                <div className="space-y-3">
                  <div className="grid gap-3 lg:grid-cols-3">
                    {roleColumns.map((item) => (
                      <WireCard
                        key={item.title}
                        title={item.title}
                        tone={item.tone}
                      >
                        <div className="mt-3 space-y-2">
                          {item.chips.map((chip) => (
                            <div
                              key={chip}
                              className="rounded-xl border border-dashed border-slate-300 bg-white px-3 py-2 text-[11px] font-semibold text-slate-600"
                            >
                              {chip}
                            </div>
                          ))}
                        </div>
                      </WireCard>
                    ))}
                  </div>

                  <WireCard
                    title="Dải chú ý nổi bật"
                  >
                    <div className="mt-3 space-y-2">
                      {attentionCases.map((item) => (
                        <div
                          key={item}
                          className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5"
                        >
                          <p className="text-[11px] font-semibold leading-5 text-slate-700">{item}</p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                              Phụ trách
                            </span>
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                              Bước tiếp theo
                            </span>
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                              Cập nhật
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </WireCard>
                </div>

                <div className="space-y-3">
                  <WireCard title="Top khách hàng">
                    <div className="mt-3 space-y-2">
                      {overviewCustomerRanking.map((item) => (
                        <div
                          key={item.label}
                          className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2"
                        >
                          <a
                            href={CUSTOMER_REQUEST_LIST_PATH}
                            className="text-[11px] font-semibold leading-5 text-slate-700 underline decoration-slate-300 underline-offset-4 transition hover:text-primary hover:decoration-primary"
                          >
                            {item.label}
                          </a>
                          <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-bold text-slate-600">
                            {item.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </WireCard>
                  <WireCard title="Top dự án">
                    <div className="mt-3 space-y-2">
                      {overviewProjectRanking.map((item) => (
                        <div
                          key={item.label}
                          className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2"
                        >
                          <a
                            href={CUSTOMER_REQUEST_LIST_PATH}
                            className="text-[11px] font-semibold leading-5 text-slate-700 underline decoration-slate-300 underline-offset-4 transition hover:text-primary hover:decoration-primary"
                          >
                            {item.label}
                          </a>
                          <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-bold text-slate-600">
                            {item.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </WireCard>
                </div>
              </div>
            </div>
          </WireframeShell>

          <WireframeShell
            title="Tab Bảng theo dõi"
          >
            <div className="space-y-3">
              <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50/70 p-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 overflow-x-auto">
                    <div className="flex shrink-0 items-center gap-2">
                      {['01/01/2026', '30/04/2026'].map((item) => (
                        <span
                          key={item}
                          className="inline-flex h-10 min-w-[146px] items-center rounded-2xl border border-slate-300 bg-white px-3 text-[11px] font-semibold text-slate-700"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                    <span className="inline-flex h-10 min-w-[340px] flex-1 items-center rounded-2xl border border-slate-300 bg-white px-3 text-[11px] font-semibold text-slate-400">
                      Tìm mã YC, tên yêu cầu...
                    </span>
                    <span className="inline-flex h-10 w-[128px] shrink-0 items-center rounded-2xl border border-slate-300 bg-white px-3 text-[11px] font-semibold text-slate-700">
                      Tất cả
                    </span>
                    <span className="inline-flex h-10 shrink-0 items-center rounded-2xl border border-slate-300 bg-white px-3 text-[11px] font-semibold text-slate-700">
                      Bộ lọc
                    </span>
                  </div>

                  <div className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_160px]">
                    {inboxSecondaryFilters.map((item) => (
                      <span
                        key={item}
                        className="inline-flex h-10 items-center rounded-2xl border border-slate-300 bg-white px-3 text-[11px] font-semibold text-slate-600"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid gap-3 xl:grid-cols-[280px_minmax(0,1fr)_360px]">
                <WireCard
                  title={inboxLanes[0].title}
                  tone="border-amber-300 bg-amber-50/60"
                >
                  <div className="mt-3 space-y-2">
                    {inboxLanes[0].items.map((item) => (
                      <div
                        key={item}
                        className="rounded-2xl border border-dashed border-amber-300 bg-white px-3 py-2 text-[11px] font-semibold text-slate-700"
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                </WireCard>

                <WireCard
                  title={inboxLanes[1].title}
                >
                  <div className="mt-3 space-y-2">
                    {inboxLanes[1].items.map((item, index) => (
                      <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50/50 p-2">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="rounded-lg bg-white px-2 py-0.5 text-[10px] font-bold text-slate-700">
                            #{index + 1}
                          </span>
                          <div className="flex gap-1">
                            <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                              SLA
                            </span>
                            <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                              PM
                            </span>
                          </div>
                        </div>
                        <MockCaseRow compact />
                      </div>
                    ))}
                  </div>
                </WireCard>

                <WireCard
                  title={inboxLanes[2].title}
                  tone="border-sky-300 bg-sky-50/60"
                >
                  <div className="mt-3 space-y-3">
                    <div className="rounded-2xl border border-dashed border-sky-300 bg-white px-3 py-3">
                      <p className="text-[12px] font-semibold leading-5 text-slate-800">
                        CRC-202604-0188 | Điều chỉnh yêu cầu tích hợp hợp đồng
                      </p>
                      <p className="mt-1 text-[11px] leading-5 text-slate-500">
                        Nội dung tạm hiển thị để xem bố cục: ca này đang chờ PM chốt ước lượng và bước tiếp theo.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                          Phụ trách
                        </span>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                          Bước tiếp theo
                        </span>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                          SLA
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {['Dòng thời gian ngắn', 'Giờ / Ước lượng', 'Liên kết task', 'Tệp đính kèm'].map((item) => (
                        <div
                          key={item}
                          className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-[11px] font-semibold text-slate-600"
                        >
                          {item}
                        </div>
                      ))}
                    </div>

                    <div className="rounded-2xl border border-slate-300 bg-white px-3 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                        Thanh hành động bám
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {['Thêm worklog', 'Ước lượng', 'Chuyển bước', 'Báo khách hàng'].map((item) => (
                          <span
                            key={item}
                            className="rounded-2xl border border-slate-300 bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-600"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </WireCard>
              </div>
            </div>
          </WireframeShell>
      </div>
    </div>
  </div>
);
