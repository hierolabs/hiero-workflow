import type { CalendarReservation } from "../types/calendar";
import { getChannelStyle, getChannelLabel, toManwon, toPerNight } from "../utils/channelColor";

interface ReservationBlockProps {
  reservation: CalendarReservation;
  left: number;
  width: number;
  cellWidth: number;
  onClick: (reservation: CalendarReservation) => void;
}

export default function ReservationBlock({
  reservation,
  left,
  width,
  cellWidth,
  onClick,
}: ReservationBlockProps) {
  const style = getChannelStyle(reservation.channel_name, reservation.channel_type);
  const channelLabel = getChannelLabel(reservation.channel_name, reservation.channel_type);
  const amount = reservation.total_rate;
  const total = toManwon(amount);
  const perNight = toPerNight(amount, reservation.nights);

  const pixelLeft = left * cellWidth + 1;
  const pixelWidth = width * cellWidth - 2;
  const narrow = pixelWidth < 70;
  const veryNarrow = pixelWidth < 40;

  // 게스트명 + 금액
  const guestName = reservation.guest_name || "";
  const priceText = total ? `${total}(${perNight})` : "";

  return (
    <div
      role="button"
      tabIndex={0}
      className="absolute cursor-pointer overflow-hidden transition-all hover:shadow-md hover:brightness-95"
      style={{
        left: pixelLeft,
        top: 3,
        width: pixelWidth,
        height: 34,
        backgroundColor: style.bg,
        color: style.text,
        borderRadius: 6,
        padding: veryNarrow ? "2px 2px" : "3px 6px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        zIndex: 2,
      }}
      onClick={() => onClick(reservation)}
      onKeyDown={(e) => e.key === "Enter" && onClick(reservation)}
      title={`${guestName} · ${channelLabel} ${reservation.nights}박\n금액: ${amount ? "₩" + amount.toLocaleString() : "-"}`}
    >
      {veryNarrow ? (
        <div className="truncate text-center" style={{ fontSize: 8, fontWeight: 600 }}>
          {guestName.charAt(0) || channelLabel.charAt(0)}
        </div>
      ) : narrow ? (
        <div className="truncate" style={{ fontSize: 10, fontWeight: 600, lineHeight: 1.3 }}>
          {guestName}
        </div>
      ) : (
        <>
          <div className="truncate" style={{ fontSize: 11, fontWeight: 600, lineHeight: 1.3 }}>
            {guestName} {priceText && <span style={{ fontWeight: 400, fontSize: 10 }}>{priceText}</span>}
          </div>
          <div className="truncate" style={{ fontSize: 9, fontWeight: 400, opacity: 0.85, marginTop: 1 }}>
            {channelLabel} {reservation.nights}박
          </div>
        </>
      )}
    </div>
  );
}
