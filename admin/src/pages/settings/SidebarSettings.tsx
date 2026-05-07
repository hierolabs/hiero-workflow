import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DEFAULT_NAV, ICON_MAP } from "../../components/Layout";
import type { NavGroup, NavItem } from "../../components/Layout";

export default function SidebarSettings() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<NavGroup[]>(() => {
    try {
      const saved = localStorage.getItem("sidebar_config");
      if (saved) return JSON.parse(saved);
    } catch { /* ignore */ }
    return DEFAULT_NAV;
  });
  const [editingGroup, setEditingGroup] = useState<number | null>(null);
  const [editingItem, setEditingItem] = useState<{ gi: number; ii: number } | null>(null);
  const [dragItem, setDragItem] = useState<{ gi: number; ii: number } | null>(null);
  const [dragGroup, setDragGroup] = useState<number | null>(null);

  const save = (updated: NavGroup[]) => {
    setGroups(updated);
    localStorage.setItem("sidebar_config", JSON.stringify(updated));
    window.dispatchEvent(new Event("sidebar-config-changed"));
  };

  // 그룹 순서 이동
  const moveGroup = (idx: number, dir: -1 | 1) => {
    const next = [...groups];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    save(next);
  };

  // 아이템 순서 이동 (그룹 내)
  const moveItem = (gi: number, ii: number, dir: -1 | 1) => {
    const next = groups.map(g => ({ ...g, items: [...g.items] }));
    const items = next[gi].items;
    const target = ii + dir;
    if (target < 0 || target >= items.length) return;
    [items[ii], items[target]] = [items[target], items[ii]];
    save(next);
  };

  // 아이템을 다른 그룹으로 이동
  const moveItemToGroup = (fromGi: number, ii: number, toGi: number) => {
    if (fromGi === toGi) return;
    const next = groups.map(g => ({ ...g, items: [...g.items] }));
    const [item] = next[fromGi].items.splice(ii, 1);
    next[toGi].items.push(item);
    save(next);
  };

  // 그룹명 변경
  const renameGroup = (gi: number, label: string) => {
    const next = groups.map((g, i) => i === gi ? { ...g, label } : g);
    save(next);
  };

  // 아이템명 변경
  const renameItem = (gi: number, ii: number, label: string) => {
    const next = groups.map((g, gIdx) => ({
      ...g,
      items: g.items.map((item, iIdx) =>
        gIdx === gi && iIdx === ii ? { ...item, label } : item
      ),
    }));
    save(next);
  };

  // 초기화
  const resetToDefault = () => {
    localStorage.removeItem("sidebar_config");
    setGroups(DEFAULT_NAV);
    window.dispatchEvent(new Event("sidebar-config-changed"));
  };

  // 드래그&드롭 (아이템)
  const handleItemDragStart = (gi: number, ii: number) => {
    setDragItem({ gi, ii });
  };

  const handleItemDrop = (toGi: number, toIi: number) => {
    if (!dragItem) return;
    const next = groups.map(g => ({ ...g, items: [...g.items] }));
    const [item] = next[dragItem.gi].items.splice(dragItem.ii, 1);
    next[toGi].items.splice(toIi, 0, item);
    save(next);
    setDragItem(null);
  };

  const handleGroupDragStart = (gi: number) => {
    setDragGroup(gi);
  };

  const handleGroupDrop = (toGi: number) => {
    if (dragGroup === null || dragGroup === toGi) return;
    const next = [...groups];
    const [g] = next.splice(dragGroup, 1);
    next.splice(toGi, 0, g);
    save(next);
    setDragGroup(null);
  };

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <button onClick={() => navigate("/settings")} className="text-sm text-gray-500 hover:text-gray-700 mb-1">&larr; 설정으로</button>
          <h1 className="text-2xl font-bold text-gray-900">사이드바 설정</h1>
          <p className="mt-1 text-sm text-gray-500">그룹 이름, 메뉴 이름, 순서를 변경합니다</p>
        </div>
        <button
          onClick={resetToDefault}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
        >
          초기화
        </button>
      </div>

      <div className="space-y-4">
        {groups.map((group, gi) => (
          <div
            key={gi}
            className="rounded-lg border border-gray-200 bg-white shadow-sm"
            draggable
            onDragStart={() => handleGroupDragStart(gi)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleGroupDrop(gi)}
          >
            {/* 그룹 헤더 */}
            <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
              <span className="cursor-grab text-gray-300 hover:text-gray-500">&#x2630;</span>
              {editingGroup === gi ? (
                <input
                  autoFocus
                  className="flex-1 rounded border border-blue-300 px-2 py-1 text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-blue-400"
                  defaultValue={group.label}
                  onBlur={(e) => { renameGroup(gi, e.target.value); setEditingGroup(null); }}
                  onKeyDown={(e) => { if (e.key === "Enter") { renameGroup(gi, e.currentTarget.value); setEditingGroup(null); } }}
                />
              ) : (
                <span
                  className="flex-1 text-sm font-semibold text-gray-900 cursor-pointer hover:text-blue-600"
                  onClick={() => setEditingGroup(gi)}
                >
                  {group.label}
                </span>
              )}
              <div className="flex gap-1">
                <button
                  onClick={() => moveGroup(gi, -1)}
                  disabled={gi === 0}
                  className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30"
                  title="위로"
                >&uarr;</button>
                <button
                  onClick={() => moveGroup(gi, 1)}
                  disabled={gi === groups.length - 1}
                  className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30"
                  title="아래로"
                >&darr;</button>
              </div>
            </div>

            {/* 아이템 목록 */}
            <div className="divide-y divide-gray-50">
              {group.items.map((item, ii) => {
                const IconComp = ICON_MAP[item.iconName];
                const isEditing = editingItem?.gi === gi && editingItem?.ii === ii;
                return (
                  <div
                    key={item.to}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50"
                    draggable
                    onDragStart={(e) => { e.stopPropagation(); handleItemDragStart(gi, ii); }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.stopPropagation(); handleItemDrop(gi, ii); }}
                  >
                    <span className="cursor-grab text-gray-300 hover:text-gray-500 text-xs">&#x2630;</span>
                    {IconComp && <IconComp className="h-4 w-4 text-gray-400 shrink-0" />}
                    {isEditing ? (
                      <input
                        autoFocus
                        className="flex-1 rounded border border-blue-300 px-2 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                        defaultValue={item.label}
                        onBlur={(e) => { renameItem(gi, ii, e.target.value); setEditingItem(null); }}
                        onKeyDown={(e) => { if (e.key === "Enter") { renameItem(gi, ii, e.currentTarget.value); setEditingItem(null); } }}
                      />
                    ) : (
                      <span
                        className="flex-1 text-sm text-gray-700 cursor-pointer hover:text-blue-600"
                        onClick={() => setEditingItem({ gi, ii })}
                      >
                        {item.label}
                      </span>
                    )}
                    <span className="text-xs text-gray-300">{item.to}</span>
                    <div className="flex gap-0.5">
                      <button
                        onClick={() => moveItem(gi, ii, -1)}
                        disabled={ii === 0}
                        className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30 text-xs"
                      >&uarr;</button>
                      <button
                        onClick={() => moveItem(gi, ii, 1)}
                        disabled={ii === group.items.length - 1}
                        className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30 text-xs"
                      >&darr;</button>
                    </div>
                    {/* 그룹 이동 */}
                    <select
                      className="rounded border border-gray-200 px-1.5 py-0.5 text-xs text-gray-500"
                      value={gi}
                      onChange={(e) => moveItemToGroup(gi, ii, Number(e.target.value))}
                    >
                      {groups.map((g, gIdx) => (
                        <option key={gIdx} value={gIdx}>{g.label}</option>
                      ))}
                    </select>
                  </div>
                );
              })}
              {group.items.length === 0 && (
                <div className="px-4 py-3 text-xs text-gray-400 italic">메뉴 없음 (다른 그룹에서 드래그하세요)</div>
              )}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs text-gray-400">변경사항은 즉시 사이드바에 반영됩니다. 초기화 버튼으로 기본값으로 되돌릴 수 있습니다.</p>
    </div>
  );
}
