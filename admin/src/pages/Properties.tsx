import { useEffect, useState, useCallback } from "react";
import OperationManual from "../components/OperationManual";
import {
  fetchProperties,
  createProperty,
  updateProperty,
  deleteProperty,
  updatePropertyStatus,
  updatePropertyOperationStatus,
  STATUS_LABELS,
  OPERATION_STATUS_LABELS,
  PROPERTY_TYPE_LABELS,
  ROOM_TYPE_LABELS,
  REGION_LABELS,
  PROPERTY_STATUSES,
  OPERATION_STATUSES,
  PROPERTY_TYPES,
  ROOM_TYPES,
  type Property,
  type PropertyListQuery,
  type CreatePropertyPayload,
  type UpdatePropertyPayload,
  OPERATION_TYPES,
  TAX_CATEGORIES,
  LICENSE_STATUSES,
  CONTRACT_TYPES,
  OPERATION_TYPE_LABELS,
  TAX_CATEGORY_LABELS,
  LICENSE_STATUS_LABELS,
  CONTRACT_TYPE_LABELS,
} from "../utils/property-api";

// --- Status badge styles ---

const STATUS_STYLES: Record<string, string> = {
  preparing: "bg-yellow-100 text-yellow-800",
  active: "bg-green-100 text-green-800",
  paused: "bg-gray-100 text-gray-800",
  closed: "bg-red-100 text-red-800",
};

const OP_STATUS_STYLES: Record<string, string> = {
  inactive: "bg-gray-100 text-gray-600",
  available: "bg-blue-100 text-blue-800",
  occupied: "bg-purple-100 text-purple-800",
  maintenance: "bg-orange-100 text-orange-800",
  blocked: "bg-red-100 text-red-800",
};

// --- Main Page ---

export default function Properties() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [query, setQuery] = useState<PropertyListQuery>({
    page: 1,
    page_size: 20,
    status: "active",
  });
  const [keyword, setKeyword] = useState("");
  const [showExcluded, setShowExcluded] = useState(false);

  const [showManual, setShowManual] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Property | null>(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showOpStatusModal, setShowOpStatusModal] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchProperties(query);
      setProperties(data.properties || []);
      setTotal(data.total);
      setTotalPages(data.total_pages);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSearch = () => {
    setQuery((prev) => ({ ...prev, page: 1, keyword: keyword || undefined }));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const handleFilterChange = (key: keyof PropertyListQuery, value: string) => {
    setQuery((prev) => ({ ...prev, page: 1, [key]: value || undefined }));
  };

  const handleDelete = async (property: Property) => {
    if (!confirm(`"${property.name}" (${property.code})을(를) 삭제하시겠습니까?`)) return;
    try {
      await deleteProperty(property.id);
      load();
    } catch {
      alert("삭제에 실패했습니다");
    }
  };

  const handleExclude = async (property: Property) => {
    const action = property.status === "closed" ? "포함" : "제외";
    if (!confirm(`"${property.name}"을(를) ${action}하시겠습니까?`)) return;
    try {
      const newStatus = property.status === "closed" ? "active" : "closed";
      await updatePropertyStatus(property.id, newStatus);
      load();
    } catch {
      alert(`${action}에 실패했습니다`);
    }
  };

  const toggleShowExcluded = () => {
    const next = !showExcluded;
    setShowExcluded(next);
    setQuery((prev) => ({
      ...prev,
      page: 1,
      status: next ? undefined : "active",
    }));
  };

  const openCreate = () => {
    setEditTarget(null);
    setShowFormModal(true);
  };

  const openEdit = (property: Property) => {
    setEditTarget(property);
    setShowFormModal(true);
  };

  const openStatusChange = (property: Property) => {
    setSelectedProperty(property);
    setShowStatusModal(true);
  };

  const openOpStatusChange = (property: Property) => {
    setSelectedProperty(property);
    setShowOpStatusModal(true);
  };

  const formatWon = (value: number) => {
    return value.toLocaleString("ko-KR") + "원";
  };

  const handleExport = async () => {
    const token = localStorage.getItem("token");
    const API_URL = import.meta.env.VITE_API_URL as string;

    try {
      const res = await fetch(`${API_URL}/properties/export`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "properties.xlsx";
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("다운로드 실패");
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    const token = localStorage.getItem("token");
    const API_URL = import.meta.env.VITE_API_URL as string;

    try {
      const res = await fetch(`${API_URL}/properties/import`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        alert(`${data.message}`);
        load();
      } else {
        alert(data.error || "업로드 실패");
      }
    } catch {
      alert("업로드 실패");
    }

    e.target.value = "";
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">공간 관리</h1>
          <p className="mt-1 text-sm text-gray-500">
            전체 {total}개의 공간이 등록되어 있습니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowManual(true)} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">운영 매뉴얼</button>
          <button
            onClick={handleExport}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Excel 다운로드
          </button>
          <label className="cursor-pointer rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Excel 업로드
            <input type="file" accept=".xlsx,.xls" onChange={handleImport} className="hidden" />
          </label>
          <button
            onClick={openCreate}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800"
          >
            + 공간 등록
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 space-y-3">
        {/* Search */}
        <div className="flex gap-2">
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="코드, 이름, 주소로 검색..."
            className="block w-72 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:ring-1 focus:ring-slate-500 focus:outline-none"
          />
          <button
            onClick={handleSearch}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            검색
          </button>
        </div>

        {/* Filter dropdowns */}
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={showExcluded}
              onChange={toggleShowExcluded}
              className="accent-slate-900"
            />
            제외된 숙소 포함
          </label>
          <div className="w-px h-5 bg-gray-300" />
          <FilterSelect
            label="지역"
            value={query.region || ""}
            onChange={(v) => handleFilterChange("region", v)}
            options={Object.entries(REGION_LABELS).map(([k, v]) => ({ value: k, label: v }))}
          />
          {showExcluded && (
            <FilterSelect
              label="상태"
              value={query.status || ""}
              onChange={(v) => handleFilterChange("status", v)}
              options={PROPERTY_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
            />
          )}
          <FilterSelect
            label="운영"
            value={query.operation_status || ""}
            onChange={(v) => handleFilterChange("operation_status", v)}
            options={OPERATION_STATUSES.map((s) => ({ value: s, label: OPERATION_STATUS_LABELS[s] }))}
          />
          <FilterSelect
            label="유형"
            value={query.property_type || ""}
            onChange={(v) => handleFilterChange("property_type", v)}
            options={PROPERTY_TYPES.map((t) => ({ value: t, label: PROPERTY_TYPE_LABELS[t] }))}
          />
          <FilterSelect
            label="객실"
            value={query.room_type || ""}
            onChange={(v) => handleFilterChange("room_type", v)}
            options={ROOM_TYPES.map((t) => ({ value: t, label: ROOM_TYPE_LABELS[t] }))}
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-gray-500">로딩 중...</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <Th>코드</Th>
                  <Th>이름</Th>
                  <Th>지역</Th>
                  <Th>유형</Th>
                  <Th>객실</Th>
                  <Th>최대 인원</Th>
                  <Th>상태</Th>
                  <Th>운영</Th>
                  <Th>월세</Th>
                  <Th>관리비</Th>
                  <ThRight>관리</ThRight>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {properties.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-6 py-12 text-center text-sm text-gray-400">
                      등록된 공간이 없습니다.
                    </td>
                  </tr>
                ) : (
                  properties.map((p) => (
                    <tr key={p.id} className={`hover:bg-gray-50 ${p.status === "closed" ? "opacity-50 bg-gray-50" : ""}`}>
                      <Td>
                        <span className="font-mono text-xs font-semibold text-slate-700">{p.code}</span>
                      </Td>
                      <Td>
                        <button
                          onClick={() => openEdit(p)}
                          className="text-left text-sm font-medium text-gray-900 hover:text-blue-600"
                        >
                          {p.name}
                        </button>
                      </Td>
                      <Td>{REGION_LABELS[p.region] || p.region}</Td>
                      <Td>{PROPERTY_TYPE_LABELS[p.property_type] || p.property_type}</Td>
                      <Td>{ROOM_TYPE_LABELS[p.room_type] || p.room_type}</Td>
                      <Td>{p.max_guests}명</Td>
                      <Td>
                        <button
                          onClick={() => openStatusChange(p)}
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[p.status] || "bg-gray-100 text-gray-800"}`}
                        >
                          {STATUS_LABELS[p.status] || p.status}
                        </button>
                      </Td>
                      <Td>
                        <button
                          onClick={() => openOpStatusChange(p)}
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${OP_STATUS_STYLES[p.operation_status] || "bg-gray-100 text-gray-800"}`}
                        >
                          {OPERATION_STATUS_LABELS[p.operation_status] || p.operation_status}
                        </button>
                      </Td>
                      <Td>{formatWon(p.monthly_rent)}</Td>
                      <Td>{formatWon(p.management_fee)}</Td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleExclude(p)}
                            className={`rounded border px-2.5 py-1 text-xs font-medium transition-colors ${
                              p.status === "closed"
                                ? "border-green-300 text-green-600 hover:bg-green-50"
                                : "border-orange-300 text-orange-600 hover:bg-orange-50"
                            }`}
                          >
                            {p.status === "closed" ? "포함" : "제외"}
                          </button>
                          <button
                            onClick={() => openEdit(p)}
                            className="rounded border border-blue-300 px-2.5 py-1 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50"
                          >
                            수정
                          </button>
                          <button
                            onClick={() => handleDelete(p)}
                            className="rounded border border-red-300 px-2.5 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                          >
                            삭제
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-6 py-3">
              <p className="text-sm text-gray-500">
                {total}개 중 {(query.page! - 1) * query.page_size! + 1}-
                {Math.min(query.page! * query.page_size!, total)}
              </p>
              <div className="flex gap-1">
                <PaginationButton
                  disabled={query.page === 1}
                  onClick={() => setQuery((prev) => ({ ...prev, page: prev.page! - 1 }))}
                >
                  이전
                </PaginationButton>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => Math.abs(p - query.page!) <= 2)
                  .map((p) => (
                    <PaginationButton
                      key={p}
                      active={p === query.page}
                      onClick={() => setQuery((prev) => ({ ...prev, page: p }))}
                    >
                      {p}
                    </PaginationButton>
                  ))}
                <PaginationButton
                  disabled={query.page === totalPages}
                  onClick={() => setQuery((prev) => ({ ...prev, page: prev.page! + 1 }))}
                >
                  다음
                </PaginationButton>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showFormModal && (
        <PropertyFormModal
          property={editTarget}
          onClose={() => setShowFormModal(false)}
          onSuccess={() => {
            setShowFormModal(false);
            load();
          }}
        />
      )}
      {showStatusModal && selectedProperty && (
        <StatusChangeModal
          property={selectedProperty}
          onClose={() => {
            setShowStatusModal(false);
            setSelectedProperty(null);
          }}
          onSuccess={() => {
            setShowStatusModal(false);
            setSelectedProperty(null);
            load();
          }}
        />
      )}
      {showOpStatusModal && selectedProperty && (
        <OpStatusChangeModal
          property={selectedProperty}
          onClose={() => {
            setShowOpStatusModal(false);
            setSelectedProperty(null);
          }}
          onSuccess={() => {
            setShowOpStatusModal(false);
            setSelectedProperty(null);
            load();
          }}
        />
      )}
      {showManual && <OperationManual page="properties" onClose={() => setShowManual(false)} />}
    </div>
  );
}

// --- Create/Edit Modal ---

function PropertyFormModal({
  property,
  onClose,
  onSuccess,
}: {
  property: Property | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const isEdit = !!property;

  const [form, setForm] = useState<CreatePropertyPayload>({
    code: property?.code || "",
    name: property?.name || "",
    region: property?.region || "",
    address: property?.address || "",
    detail_address: property?.detail_address || "",
    property_type: property?.property_type || "apartment",
    room_type: property?.room_type || "entire",
    max_guests: property?.max_guests || 2,
    bedrooms: property?.bedrooms || 1,
    beds: property?.beds || 1,
    bathrooms: property?.bathrooms || 1,
    monthly_rent: property?.monthly_rent || 0,
    management_fee: property?.management_fee || 0,
    deposit: property?.deposit || 0,
    check_in_time: property?.check_in_time || "15:00",
    check_out_time: property?.check_out_time || "11:00",
    operation_type: property?.operation_type || "",
    tax_category: property?.tax_category || "",
    license_status: property?.license_status || "NONE",
    contract_type: property?.contract_type || "",
    owner_name: property?.owner_name || "",
    memo: property?.memo || "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const updateField = <K extends keyof CreatePropertyPayload>(key: K, value: CreatePropertyPayload[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isEdit) {
        const { code: _, ...updateData } = form;
        await updateProperty(property!.id, updateData as UpdatePropertyPayload);
      } else {
        await createProperty(form);
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "처리에 실패했습니다");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalWrapper onClose={onClose} title={isEdit ? "공간 수정" : "공간 등록"} wide>
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && <ErrorAlert message={error} />}

        {/* 식별 */}
        <Section title="기본 정보">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="코드" required>
              <input
                type="text"
                value={form.code}
                onChange={(e) => updateField("code", e.target.value)}
                disabled={isEdit}
                placeholder="B105"
                required
                className={inputClass(isEdit)}
              />
            </FormField>
            <FormField label="이름" required>
              <input
                type="text"
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                placeholder="다하임 1005"
                required
                className={inputClass()}
              />
            </FormField>
          </div>
        </Section>

        {/* 위치 */}
        <Section title="위치">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="지역">
              <select
                value={form.region}
                onChange={(e) => updateField("region", e.target.value)}
                className={inputClass()}
              >
                <option value="">선택</option>
                {Object.entries(REGION_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </FormField>
            <FormField label="상세주소">
              <input
                type="text"
                value={form.detail_address}
                onChange={(e) => updateField("detail_address", e.target.value)}
                placeholder="1005호"
                className={inputClass()}
              />
            </FormField>
          </div>
          <FormField label="주소">
            <input
              type="text"
              value={form.address}
              onChange={(e) => updateField("address", e.target.value)}
              placeholder="서울특별시 강동구 ..."
              className={inputClass()}
            />
          </FormField>
        </Section>

        {/* 유형 & 스펙 */}
        <Section title="유형 및 스펙">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="공간 유형">
              <select
                value={form.property_type}
                onChange={(e) => updateField("property_type", e.target.value)}
                className={inputClass()}
              >
                {PROPERTY_TYPES.map((t) => (
                  <option key={t} value={t}>{PROPERTY_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </FormField>
            <FormField label="객실 유형">
              <select
                value={form.room_type}
                onChange={(e) => updateField("room_type", e.target.value)}
                className={inputClass()}
              >
                {ROOM_TYPES.map((t) => (
                  <option key={t} value={t}>{ROOM_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </FormField>
          </div>
          <div className="grid grid-cols-4 gap-4">
            <FormField label="최대 인원">
              <input
                type="number"
                min={1}
                value={form.max_guests}
                onChange={(e) => updateField("max_guests", parseInt(e.target.value) || 1)}
                className={inputClass()}
              />
            </FormField>
            <FormField label="침실">
              <input
                type="number"
                min={0}
                value={form.bedrooms}
                onChange={(e) => updateField("bedrooms", parseInt(e.target.value) || 0)}
                className={inputClass()}
              />
            </FormField>
            <FormField label="침대">
              <input
                type="number"
                min={0}
                value={form.beds}
                onChange={(e) => updateField("beds", parseInt(e.target.value) || 0)}
                className={inputClass()}
              />
            </FormField>
            <FormField label="욕실">
              <input
                type="number"
                min={0}
                step={0.5}
                value={form.bathrooms}
                onChange={(e) => updateField("bathrooms", parseFloat(e.target.value) || 0)}
                className={inputClass()}
              />
            </FormField>
          </div>
        </Section>

        {/* 비용 */}
        <Section title="비용">
          <div className="grid grid-cols-3 gap-4">
            <FormField label="월세 (원)">
              <input
                type="number"
                min={0}
                value={form.monthly_rent}
                onChange={(e) => updateField("monthly_rent", parseInt(e.target.value) || 0)}
                className={inputClass()}
              />
            </FormField>
            <FormField label="관리비 (원)">
              <input
                type="number"
                min={0}
                value={form.management_fee}
                onChange={(e) => updateField("management_fee", parseInt(e.target.value) || 0)}
                className={inputClass()}
              />
            </FormField>
            <FormField label="보증금 (원)">
              <input
                type="number"
                min={0}
                value={form.deposit}
                onChange={(e) => updateField("deposit", parseInt(e.target.value) || 0)}
                className={inputClass()}
              />
            </FormField>
          </div>
        </Section>

        {/* 운영 */}
        <Section title="운영">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="체크인 시간">
              <input
                type="time"
                value={form.check_in_time}
                onChange={(e) => updateField("check_in_time", e.target.value)}
                className={inputClass()}
              />
            </FormField>
            <FormField label="체크아웃 시간">
              <input
                type="time"
                value={form.check_out_time}
                onChange={(e) => updateField("check_out_time", e.target.value)}
                className={inputClass()}
              />
            </FormField>
          </div>
          <FormField label="메모">
            <textarea
              value={form.memo}
              onChange={(e) => updateField("memo", e.target.value)}
              rows={3}
              placeholder="운영 관련 메모"
              className={inputClass()}
            />
          </FormField>
        </Section>

        <Section title="세무·회계">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="운영유형">
              <select value={form.operation_type} onChange={(e) => updateField("operation_type", e.target.value)} className={inputClass()}>
                <option value="">미지정</option>
                {OPERATION_TYPES.map((t) => <option key={t} value={t}>{OPERATION_TYPE_LABELS[t] || t}</option>)}
              </select>
            </FormField>
            <FormField label="세금구분">
              <select value={form.tax_category} onChange={(e) => updateField("tax_category", e.target.value)} className={inputClass()}>
                <option value="">미지정</option>
                {TAX_CATEGORIES.map((t) => <option key={t} value={t}>{TAX_CATEGORY_LABELS[t] || t}</option>)}
              </select>
            </FormField>
            <FormField label="허가상태">
              <select value={form.license_status} onChange={(e) => updateField("license_status", e.target.value)} className={inputClass()}>
                <option value="">미지정</option>
                {LICENSE_STATUSES.map((t) => <option key={t} value={t}>{LICENSE_STATUS_LABELS[t] || t}</option>)}
              </select>
            </FormField>
            <FormField label="계약유형">
              <select value={form.contract_type} onChange={(e) => updateField("contract_type", e.target.value)} className={inputClass()}>
                <option value="">미지정</option>
                {CONTRACT_TYPES.map((t) => <option key={t} value={t}>{CONTRACT_TYPE_LABELS[t] || t}</option>)}
              </select>
            </FormField>
          </div>
          <FormField label="임대인(집주인)">
            <input type="text" value={form.owner_name} onChange={(e) => updateField("owner_name", e.target.value)} placeholder="집주인 이름" className={inputClass()} />
          </FormField>
        </Section>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {loading ? "처리 중..." : isEdit ? "수정" : "등록"}
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
}

// --- Status Change Modal ---

function StatusChangeModal({
  property,
  onClose,
  onSuccess,
}: {
  property: Property;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [status, setStatus] = useState(property.status);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await updatePropertyStatus(property.id, status);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "변경 실패");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalWrapper onClose={onClose} title="상태 변경">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <ErrorAlert message={error} />}
        <p className="text-sm text-gray-600">
          <span className="font-medium">{property.name}</span>의 상태를 변경합니다.
        </p>
        <div className="space-y-2">
          {PROPERTY_STATUSES.map((s) => (
            <label
              key={s}
              className={`flex cursor-pointer items-center gap-3 rounded-md border px-4 py-3 transition-colors ${
                status === s
                  ? "border-slate-900 bg-slate-50"
                  : "border-gray-200 hover:bg-gray-50"
              }`}
            >
              <input
                type="radio"
                name="status"
                value={s}
                checked={status === s}
                onChange={() => setStatus(s)}
                className="accent-slate-900"
              />
              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[s]}`}>
                {STATUS_LABELS[s]}
              </span>
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            취소
          </button>
          <button type="submit" disabled={loading || status === property.status} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">
            {loading ? "변경 중..." : "변경"}
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
}

// --- Operation Status Change Modal ---

function OpStatusChangeModal({
  property,
  onClose,
  onSuccess,
}: {
  property: Property;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [opStatus, setOpStatus] = useState(property.operation_status);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await updatePropertyOperationStatus(property.id, opStatus);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "변경 실패");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalWrapper onClose={onClose} title="운영 상태 변경">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <ErrorAlert message={error} />}
        <p className="text-sm text-gray-600">
          <span className="font-medium">{property.name}</span>의 운영 상태를 변경합니다.
        </p>
        <div className="space-y-2">
          {OPERATION_STATUSES.map((s) => (
            <label
              key={s}
              className={`flex cursor-pointer items-center gap-3 rounded-md border px-4 py-3 transition-colors ${
                opStatus === s
                  ? "border-slate-900 bg-slate-50"
                  : "border-gray-200 hover:bg-gray-50"
              }`}
            >
              <input
                type="radio"
                name="op_status"
                value={s}
                checked={opStatus === s}
                onChange={() => setOpStatus(s)}
                className="accent-slate-900"
              />
              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${OP_STATUS_STYLES[s]}`}>
                {OPERATION_STATUS_LABELS[s]}
              </span>
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            취소
          </button>
          <button type="submit" disabled={loading || opStatus === property.operation_status} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">
            {loading ? "변경 중..." : "변경"}
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
}

// --- Shared components ---

function ModalWrapper({
  onClose,
  title,
  children,
  wide,
}: {
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div
        className={`relative z-10 w-full ${wide ? "max-w-2xl" : "max-w-md"} max-h-[90vh] overflow-y-auto rounded-lg bg-white p-6 shadow-xl`}
      >
        <h2 className="mb-4 text-lg font-bold text-gray-900">{title}</h2>
        {children}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-gray-800 border-b border-gray-200 pb-1">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

function ErrorAlert({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {message}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-slate-500 focus:ring-1 focus:ring-slate-500 focus:outline-none"
    >
      <option value="">{label} 전체</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
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

function PaginationButton({
  children,
  active,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
        active
          ? "bg-slate-900 text-white"
          : disabled
            ? "text-gray-300 cursor-not-allowed"
            : "text-gray-600 hover:bg-gray-200"
      }`}
    >
      {children}
    </button>
  );
}

function inputClass(disabled = false) {
  return `block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:ring-1 focus:ring-slate-500 focus:outline-none ${disabled ? "bg-gray-100 cursor-not-allowed" : ""}`;
}
