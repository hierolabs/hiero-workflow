import { useEffect, useState, useCallback } from "react";
import {
  fetchHostexMappings,
  linkHostexProperty,
  unlinkHostexProperty,
  triggerInitialSync,
  rematchReservations,
  fetchWebhookLogs,
  type HostexMapping,
  type UnmappedProperty,
  type WebhookLog,
} from "../utils/reservation-api";

type Tab = "mappings" | "logs";

export default function HostexSync() {
  const [tab, setTab] = useState<Tab>("mappings");

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Hostex 연동</h1>
        <p className="mt-1 text-sm text-gray-500">
          Hostex 숙소와 내부 공간을 연결하고, 예약 동기화 상태를 확인합니다.
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-1 border-b border-gray-200">
        <TabButton active={tab === "mappings"} onClick={() => setTab("mappings")}>
          숙소 매핑
        </TabButton>
        <TabButton active={tab === "logs"} onClick={() => setTab("logs")}>
          웹훅 로그
        </TabButton>
      </div>

      {tab === "mappings" && <MappingTab />}
      {tab === "logs" && <LogsTab />}
    </div>
  );
}

// --- Mapping Tab ---

function MappingTab() {
  const [mappings, setMappings] = useState<HostexMapping[]>([]);
  const [unmapped, setUnmapped] = useState<UnmappedProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [rematching, setRematching] = useState(false);
  const [linkingId, setLinkingId] = useState<number | null>(null);
  const [selectedPropId, setSelectedPropId] = useState<number>(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchHostexMappings();
      setMappings(data.mappings || []);
      setUnmapped(data.unmapped_properties || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await triggerInitialSync();
      alert("동기화가 시작되었습니다. 잠시 후 새로고침하세요.");
    } catch {
      alert("동기화 실패");
    } finally {
      setSyncing(false);
    }
  };

  const handleRematch = async () => {
    setRematching(true);
    try {
      const result = await rematchReservations();
      alert(`${result.matched}건 재매칭 완료`);
    } catch {
      alert("재매칭 실패");
    } finally {
      setRematching(false);
    }
  };

  const handleLink = async (hostexId: number) => {
    if (selectedPropId === 0) return;
    try {
      await linkHostexProperty(selectedPropId, hostexId);
      setLinkingId(null);
      setSelectedPropId(0);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "연결 실패");
    }
  };

  const handleUnlink = async (internalPropId: number) => {
    if (!confirm("Hostex 연결을 해제하시겠습니까?")) return;
    try {
      await unlinkHostexProperty(internalPropId);
      load();
    } catch {
      alert("연결 해제 실패");
    }
  };

  const matchedCount = mappings.filter((m) => m.matched).length;
  const unmatchedCount = mappings.filter((m) => !m.matched).length;

  if (loading) {
    return <div className="flex items-center justify-center py-20"><p className="text-gray-500">로딩 중...</p></div>;
  }

  return (
    <div>
      {/* Actions */}
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={handleSync}
          disabled={syncing}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {syncing ? "동기화 중..." : "예약 전체 동기화"}
        </button>
        <button
          onClick={handleRematch}
          disabled={rematching}
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
        >
          {rematching ? "재매칭 중..." : "미매칭 예약 재매칭"}
        </button>
        <div className="ml-auto flex gap-4 text-sm">
          <span className="text-green-600 font-medium">연결됨 {matchedCount}</span>
          <span className="text-orange-600 font-medium">미연결 {unmatchedCount}</span>
        </div>
      </div>

      {/* Mapping Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <Th>Hostex ID</Th>
              <Th>Hostex 숙소명</Th>
              <Th>Hostex 주소</Th>
              <Th>내부 공간</Th>
              <Th>상태</Th>
              <ThRight>관리</ThRight>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {mappings.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-400">
                  Hostex 숙소가 없습니다. API 토큰을 확인하세요.
                </td>
              </tr>
            ) : (
              mappings.map((m) => (
                <tr key={m.hostex_id} className="hover:bg-gray-50">
                  <Td>
                    <span className="font-mono text-xs text-gray-500">{m.hostex_id}</span>
                  </Td>
                  <Td>
                    <span className="text-sm font-medium text-gray-900">{m.hostex_title}</span>
                  </Td>
                  <Td>
                    <span className="text-xs text-gray-500 max-w-48 truncate block">
                      {m.hostex_address || "-"}
                    </span>
                  </Td>
                  <Td>
                    {m.matched ? (
                      <div>
                        <span className="font-mono text-xs font-semibold text-slate-700">{m.internal_code}</span>
                        <span className="ml-1 text-sm text-gray-700">{m.internal_name}</span>
                      </div>
                    ) : linkingId === m.hostex_id ? (
                      <div className="flex items-center gap-2">
                        <select
                          value={selectedPropId}
                          onChange={(e) => setSelectedPropId(parseInt(e.target.value))}
                          className="rounded border border-gray-300 px-2 py-1 text-sm"
                        >
                          <option value={0}>공간 선택...</option>
                          {unmapped.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.code} - {p.name}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleLink(m.hostex_id)}
                          disabled={selectedPropId === 0}
                          className="rounded bg-slate-900 px-2 py-1 text-xs text-white hover:bg-slate-800 disabled:opacity-40"
                        >
                          연결
                        </button>
                        <button
                          onClick={() => setLinkingId(null)}
                          className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
                        >
                          취소
                        </button>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )}
                  </Td>
                  <Td>
                    {m.matched ? (
                      <span className="inline-flex rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                        연결됨
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-700">
                        미연결
                      </span>
                    )}
                  </Td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                    {m.matched ? (
                      <button
                        onClick={() => handleUnlink(m.internal_prop_id!)}
                        className="rounded border border-red-300 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        연결 해제
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setLinkingId(m.hostex_id);
                          setSelectedPropId(0);
                        }}
                        className="rounded border border-blue-300 px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
                      >
                        연결
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- Logs Tab ---

function LogsTab() {
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchWebhookLogs();
        setLogs(data || []);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const eventStyles: Record<string, string> = {
    reservation_created: "bg-green-100 text-green-800",
    reservation_updated: "bg-blue-100 text-blue-800",
    reservation_cancelled: "bg-red-100 text-red-800",
    message_created: "bg-purple-100 text-purple-800",
    property_availability_updated: "bg-yellow-100 text-yellow-800",
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><p className="text-gray-500">로딩 중...</p></div>;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <Th>시간</Th>
            <Th>이벤트</Th>
            <Th>예약 코드</Th>
            <Th>Property ID</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {logs.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-6 py-12 text-center text-sm text-gray-400">
                웹훅 로그가 없습니다.
              </td>
            </tr>
          ) : (
            logs.map((log) => (
              <tr key={log.id} className="hover:bg-gray-50">
                <Td>
                  <span className="text-xs text-gray-500">
                    {new Date(log.created_at).toLocaleString("ko-KR")}
                  </span>
                </Td>
                <Td>
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${eventStyles[log.event] || "bg-gray-100 text-gray-700"}`}>
                    {log.event}
                  </span>
                </Td>
                <Td>
                  <span className="font-mono text-xs text-gray-600">
                    {log.reservation_code || "-"}
                  </span>
                </Td>
                <Td>
                  <span className="font-mono text-xs text-gray-500">
                    {log.property_id || "-"}
                  </span>
                </Td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// --- Shared UI ---

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
        active
          ? "border-slate-900 text-slate-900"
          : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
      }`}
    >
      {children}
    </button>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
      {children}
    </th>
  );
}

function ThRight({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
      {children}
    </td>
  );
}
