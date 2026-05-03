interface RegionFilterProps {
  regions: string[];
  value: string;
  onChange: (value: string) => void;
}

export default function RegionFilter({
  regions,
  value,
  onChange,
}: RegionFilterProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
    >
      <option value="all">전체 지역</option>
      {regions.map((r) => (
        <option key={r} value={r}>
          {r}
        </option>
      ))}
    </select>
  );
}
