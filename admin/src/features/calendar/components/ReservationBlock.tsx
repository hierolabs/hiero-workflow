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

  const line1 = total
    ? `${reservation.guest_name}_${total}(${perNight})`
    : reservation.guest_name;
  const line2 = `${channelLabel} ${reservation.nights}박`;

  const pixelLeft = left * cellWidth + 1;
  const pixelWidth = width * cellWidth - 2;
  const narrow = pixelWidth < 60;

  return (
    <div
      role="button"
      tabIndex={0}
      className="absolute cursor-pointer overflow-hidden transition-shadow hover:shadow-lg hover:-translate-y-px"
      style={{
        left: pixelLeft,
        top: 2,
        width: pixelWidth,
        height: narrow ? 28 : 32,
        backgroundColor: style.bg,
        color: style.text,
        borderRadius: 3,
        padding: narrow ? "2px 2px" : "2px 4px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
        zIndex: 2,
      }}
      onClick={() => onClick(reservation)}
      onKeyDown={(e) => e.key === "Enter" && onClick(reservation)}
      title={`${line1}\n${line2}\n금액: ${amount ? amount.toLocaleString() + "원" : "-"}`}
    >
      <div className="truncate" style={{ fontSize: narrow ? 8 : 10, fontWeight: 600, lineHeight: 1.2 }}>
        {narrow ? reservation.guest_name : line1}
      </div>
      {!narrow && (
        <div className="truncate" style={{ fontSize: 9, fontWeight: 400, opacity: 0.9, marginTop: 1 }}>
          {line2}
        </div>
      )}
    </div>
  );
}
