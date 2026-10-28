"use client";
import { Card, CardBody } from "@heroui/react";

/**
 * กล่องตัวเลขสรุปด้านบนหน้าจัดการ (value เป็น null ระหว่างโหลด)
 */
export default function SummaryCard({ icon: Icon, label, value, note, tone, onPress, isActive }) {
    return (
        <Card
            isPressable={Boolean(onPress)}
            onPress={onPress}
            className={`rounded-2xl border bg-white shadow-sm ${isActive ? "border-amber-400 ring-2 ring-amber-100" : "border-gray-100"}`}
        >
            <CardBody className="p-5">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-500">{label}</p>
                        {value === null ? (
                            <div className="mt-3 h-8 w-16 animate-pulse rounded bg-gray-200" />
                        ) : (
                            <p className="mt-2 text-3xl font-medium text-gray-800">
                                {value.toLocaleString("th-TH")}
                            </p>
                        )}
                        <p className="mt-1 text-xs text-gray-400">{note}</p>
                    </div>
                    <span className={`shrink-0 rounded-2xl p-3 ${tone}`}>
                        <Icon size={22} />
                    </span>
                </div>
            </CardBody>
        </Card>
    );
}
