"use client";

import { useEffect, useState } from "react";
import { X, ChevronDown, ChevronUp, Loader2 } from "lucide-react";

interface StudentEntry {
  id: number;
  name: string;
}

interface Group {
  text: string;
  count: number;
  students: StudentEntry[];
}

interface BreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  campId: string | string[];
  type: "allergy" | "disease" | "remark";
  title: string;
  totalCount: number;
  accentColor: string; // Tailwind color class prefix e.g. "red" | "green" | "blue"
}

const colorMap: Record<
  string,
  {
    bg: string;
    badge: string;
    badgeText: string;
    expandedBg: string;
    border: string;
    dot: string;
  }
> = {
  red: {
    bg: "bg-red-50",
    badge: "bg-red-100",
    badgeText: "text-red-700",
    expandedBg: "bg-red-50/60",
    border: "border-red-100",
    dot: "bg-red-400",
  },
  green: {
    bg: "bg-[#f0f4f2]",
    badge: "bg-[#d4e6dd]",
    badgeText: "text-[#3d6b5e]",
    expandedBg: "bg-[#f0f4f2]/80",
    border: "border-[#d1e0d9]",
    dot: "bg-[#6b857a]",
  },
  blue: {
    bg: "bg-blue-50",
    badge: "bg-blue-100",
    badgeText: "text-blue-700",
    expandedBg: "bg-blue-50/60",
    border: "border-blue-100",
    dot: "bg-blue-400",
  },
};

export default function BreakdownModal({
  isOpen,
  onClose,
  campId,
  type,
  title,
  totalCount,
  accentColor,
}: BreakdownModalProps) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const colors = colorMap[accentColor] ?? colorMap.blue;

  useEffect(() => {
    if (!isOpen) return;
    setGroups([]);
    setExpanded(new Set());
    setLoading(true);

    fetch(`/api/camps/${campId}/students/breakdown?type=${type}`)
      .then((r) => r.json())
      .then((data) => {
        setGroups(data.groups ?? []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [isOpen, campId, type]);

  const toggleExpand = (text: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);

      if (next.has(text)) next.delete(text);
      else next.add(text);

      return next;
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <button
        aria-label="ปิดหน้าต่างรายละเอียดนักเรียน"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        type="button"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              มีนักเรียนจำนวน{" "}
              <span className="font-semibold text-gray-700">{totalCount}</span>{" "}
              คน
            </p>
          </div>
          <button
            aria-label="ปิด"
            className="text-gray-400 hover:text-gray-700 transition-colors rounded-lg p-1.5 hover:bg-gray-100"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="animate-spin text-gray-400" size={28} />
              <p className="text-sm text-gray-400">กำลังโหลด...</p>
            </div>
          ) : groups.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">
              ไม่พบข้อมูล
            </div>
          ) : (
            groups.map((group) => {
              const isOpen = expanded.has(group.text);

              return (
                <div
                  key={group.text}
                  className={`rounded-xl border ${colors.border} overflow-hidden`}
                >
                  {/* Group header row */}
                  <button
                    aria-expanded={isOpen}
                    className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${colors.bg} hover:brightness-95`}
                    onClick={() => toggleExpand(group.text)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${colors.dot}`}
                      />
                      <span className="font-medium text-gray-800 text-sm truncate">
                        {group.text}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                      <span
                        className={`${colors.badge} ${colors.badgeText} text-xs font-semibold px-2.5 py-0.5 rounded-full`}
                      >
                        {group.count} คน
                      </span>
                      {isOpen ? (
                        <ChevronUp className="text-gray-400" size={16} />
                      ) : (
                        <ChevronDown className="text-gray-400" size={16} />
                      )}
                    </div>
                  </button>

                  {/* Expanded student list */}
                  {isOpen && (
                    <div className={`${colors.expandedBg} px-4 py-3 space-y-2`}>
                      {group.students.map((s) => (
                        <div
                          key={s.id}
                          className="flex items-center gap-3 text-sm"
                        >
                          <span className="text-gray-400 font-mono text-xs w-12 flex-shrink-0">
                            {s.id}
                          </span>
                          <span className="text-gray-700">{s.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-100 flex justify-end">
          <button
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            onClick={onClose}
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
}
