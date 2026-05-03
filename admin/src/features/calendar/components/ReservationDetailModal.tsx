import { useState, useEffect } from "react";
import { fetchReservationDetail } from "../api/calendarApi";
import { getChannelStyle, getChannelLabel } from "../utils/channelColor";
import type { CalendarReservation } from "../types/calendar";

interface ReservationDetailModalProps {
  reservation: CalendarReservation | null;
  onClose: () => void;
}

interface ReservationDetail {
  id: number;
  reservation_code: string;
  guest_name: string;
  guest_phone: string;
  guest_email: string;
  channel_type: string;
  check_in_date: string;
  check_out_date: string;
  nights: number;
  total_rate: number;
  currency: string;
  status: string;
  stay_status: string;
  remarks: string;
}

export default function ReservationDetailModal({
  reservation,
  onClose,
}: ReservationDetailModalProps) {
  const [detail, setDetail] = useState<ReservationDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!reservation) {
      setDetail(null);
      return;
    }

    setLoading(true);
    fetchReservationDetail(reservation.id)
      .then((res) => {
        if (res.success) setDetail(res.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [reservation]);

  if (!reservation) return null;

  const channelStyle = getChannelStyle(reservation.channel_name, reservation.channel_type);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h3 className="text-lg font-bold text-gray-900">예약 상세</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4">
          {loading ? (
            <div className="flex h-32 items-center justify-center text-gray-400">
              로딩 중...
            </div>
          ) : detail ? (
            <div className="space-y-4">
              {/* Channel badge + Guest */}
              <div className="flex items-center gap-3">
                <span
                  className="rounded-full px-3 py-1 text-xs font-medium"
                  style={{ backgroundColor: channelStyle.bg, color: channelStyle.text }}
                >
                  {getChannelLabel(detail.channel_type || reservation.channel_name, reservation.channel_type)}
                </span>
                <span className="text-lg font-semibold text-gray-900">
                  {detail.guest_name}
                </span>
              </div>

              {/* Dates */}
              <InfoRow
                label="일정"
                value={`${detail.check_in_date} ~ ${detail.check_out_date} (${detail.nights}박)`}
              />

              {/* Status */}
              <InfoRow label="상태" value={detail.stay_status || detail.status} />

              {/* Amount */}
              {detail.total_rate > 0 && (
                <InfoRow
                  label="금액"
                  value={`${detail.total_rate.toLocaleString()} ${detail.currency}`}
                />
              )}

              {/* Contact */}
              {detail.guest_phone && (
                <InfoRow label="전화" value={detail.guest_phone} />
              )}
              {detail.guest_email && (
                <InfoRow label="이메일" value={detail.guest_email} />
              )}

              {/* Memo */}
              {detail.remarks && (
                <div>
                  <span className="text-xs font-medium text-gray-500">메모</span>
                  <p className="mt-1 rounded-md bg-gray-50 p-3 text-sm text-gray-700">
                    {detail.remarks}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <InfoRow label="게스트" value={reservation.guest_name} />
              <InfoRow
                label="일정"
                value={`${reservation.check_in_date} ~ ${reservation.check_out_date} (${reservation.nights}박)`}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs font-medium text-gray-500">{label}</span>
      <p className="text-sm text-gray-900">{value}</p>
    </div>
  );
}
