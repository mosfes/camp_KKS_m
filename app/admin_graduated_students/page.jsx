"use client";

import {
  Avatar,
  Button,
  Card,
  CardBody,
  Input,
  Pagination,
  Select,
  SelectItem,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/react";
import { ArrowLeft, GraduationCap, Search, Users, X } from "lucide-react";
import { Fragment, useEffect, useState } from "react";
import { useRouter } from "next/navigation";


const PAGE_SIZE = 10;

const BREADCRUMBS = [
  { label: "ภาพรวม", href: "/admin_add_user?tab=overview" },
  { label: "นักเรียน", href: "/admin_add_user?tab=student" },
];

const toBuddhistYear = (year) => Number(year) + 543;

export default function GraduatedStudentsPage() {
  const router = useRouter();
  const [rows, setRows] = useState([]);
  const [years, setYears] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [year, setYear] = useState("all");
  const [roomType, setRoomType] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(PAGE_SIZE),
          year,
          roomType,
        });
        if (search.trim()) params.set("search", search.trim());
        const response = await fetch(`/api/students/graduated?${params}`, {
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setRows(data.data);
        setYears(data.years);
        setRooms(data.rooms);
        setTotal(data.pagination.total);
        setTotalPages(data.pagination.totalPages);
      } catch (error) {
        if (error.name !== "AbortError") console.error(error);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [page, roomType, search, year]);

  const hasFilters = year !== "all" || roomType !== "all" || search.trim();
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);

  const changeYear = (value) => {
    setYear(value);
    setPage(1);
  };

  const clearFilters = () => {
    setYear("all");
    setRoomType("all");
    setSearch("");
    setPage(1);
  };

  return (
    <div className="w-full p-4 md:p-8">
        {/* Breadcrumb */}
        <nav
          aria-label="Breadcrumb"
          className="mb-4 flex max-w-full items-center gap-1.5 overflow-hidden text-xs text-gray-500 sm:gap-2"
        >
          {BREADCRUMBS.map((item) => (
            <Fragment key={item.href}>
              <button
                type="button"
                className="shrink-0 whitespace-nowrap rounded-sm font-normal text-gray-600 transition-colors hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6b857a]"
                onClick={() => router.push(item.href)}
              >
                {item.label}
              </button>
              <span className="shrink-0 select-none text-gray-300">/</span>
            </Fragment>
          ))}
          <span className="truncate font-medium text-[#3d6357]">
            นักเรียนที่จบการศึกษา
          </span>
        </nav>

        {/* Header */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              isIconOnly
              variant="light"
              className="rounded-full"
              aria-label="ย้อนกลับ"
              onPress={() => router.back()}
            >
              <ArrowLeft size={20} />
            </Button>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sage text-white shadow-sm">
              <GraduationCap size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                นักเรียนที่จบการศึกษา
              </h1>
              <p className="text-sm text-gray-500">
                ทะเบียนผู้จบแยกตามปีการศึกษาและห้องเดิม
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-[#EFECE5] bg-white px-4 py-2.5 shadow-sm">
            <Users size={18} className="text-sage" />
            <span className="text-sm text-gray-500">
              {hasFilters ? "ตรงเงื่อนไข" : "นักเรียนที่จบทั้งหมด"}
            </span>
            <span className="text-lg font-bold text-gray-800">
              {loading && total === 0 ? "–" : total.toLocaleString("th-TH")}
            </span>
            <span className="text-sm text-gray-500">คน</span>
          </div>
        </div>

        <Card className="border border-[#EFECE5] bg-white shadow-sm">
          <CardBody className="gap-5 p-4 md:p-6">
            {/* Filters */}
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <Input
                className="md:flex-1"
                placeholder="ค้นหารหัส ชื่อ หรือนามสกุล"
                startContent={<Search size={16} className="text-gray-400" />}
                isClearable
                value={search}
                onValueChange={(value) => {
                  setSearch(value);
                  setPage(1);
                }}
              />
              <Select
                aria-label="ปีการศึกษาที่จบ"
                className="md:w-56"
                selectedKeys={[year]}
                disallowEmptySelection
                onChange={(event) => changeYear(event.target.value)}
              >
                <SelectItem key="all" textValue="ปีการศึกษาที่จบ: ทั้งหมด">
                  ทั้งหมด
                </SelectItem>
                {years.map((item) => (
                  <SelectItem
                    key={String(item)}
                    textValue={`ปีการศึกษาที่จบ: ${toBuddhistYear(item)}`}
                  >
                    {toBuddhistYear(item)}
                  </SelectItem>
                ))}
              </Select>
              <Select
                aria-label="ห้องเดิม"
                className="md:w-56"
                selectedKeys={[roomType]}
                disallowEmptySelection
                onChange={(event) => {
                  setRoomType(event.target.value);
                  setPage(1);
                }}
              >
                <SelectItem key="all" textValue="ห้องเดิม: ทั้งหมด">
                  ทั้งหมด
                </SelectItem>
                {rooms.map((room) => (
                  <SelectItem
                    key={String(room.id)}
                    textValue={`ห้องเดิม: ม.6 ห้อง ${room.name}`}
                  >
                    ม.6 ห้อง {room.name}
                  </SelectItem>
                ))}
              </Select>
              {hasFilters && (
                <Button
                  variant="light"
                  className="shrink-0 text-gray-500"
                  startContent={<X size={14} />}
                  onPress={clearFilters}
                >
                  ล้างตัวกรอง
                </Button>
              )}
            </div>

            {/* Table */}
            <div className="w-full overflow-x-auto">
              {loading ? (
                <div className="space-y-3 rounded-xl border border-gray-100 p-4">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <div key={index} className="flex items-center gap-4 py-2">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <Skeleton className="h-3.5 w-16 rounded-lg" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-3.5 w-1/3 rounded-lg" />
                        <Skeleton className="h-3 w-1/5 rounded-lg" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Table
                  aria-label="รายชื่อนักเรียนที่จบการศึกษา"
                  shadow="none"
                  isHeaderSticky
                  classNames={{
                    wrapper:
                      "border border-gray-100 rounded-xl p-0 overflow-hidden min-w-[760px] lg:min-w-full",
                    th: "bg-gray-50/50 border-b border-gray-100 text-gray-800 font-semibold py-4",
                    td: "py-4 border-b border-gray-50/50",
                  }}
                >
                  <TableHeader>
                    <TableColumn>โปรไฟล์</TableColumn>
                    <TableColumn>รหัสนักเรียน</TableColumn>
                    <TableColumn>ชื่อ-นามสกุล</TableColumn>
                    <TableColumn>ห้องเดิม</TableColumn>
                    <TableColumn>ปีการศึกษาที่จบ</TableColumn>
                  </TableHeader>
                  <TableBody
                    emptyContent={
                      hasFilters
                        ? "ไม่พบนักเรียนที่ตรงกับเงื่อนไข"
                        : "ยังไม่มีข้อมูลนักเรียนที่จบการศึกษา"
                    }
                  >
                    {rows.map((row) => (
                      <TableRow
                        key={row.graduationId}
                        className="border-b border-gray-300 last:border-b-0 hover:bg-gray-50"
                      >
                        <TableCell>
                          <Avatar
                            className="h-9 w-9 bg-[#e8f0ee] text-sm font-medium text-[#3d6357]"
                            name={(row.firstname || "?").charAt(0)}
                            src={row.profileImageUrl || undefined}
                          />
                        </TableCell>
                        <TableCell>{row.studentId}</TableCell>
                        <TableCell>
                          <div className="min-w-[180px]">
                            <p className="truncate whitespace-nowrap font-medium text-gray-800">
                              {row.prefixName || ""}
                              {row.firstname} {row.lastname}
                            </p>
                            <p className="truncate text-xs text-gray-500">
                              ชื่อเล่น: {row.nickname || "-"}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>{row.classroom}</TableCell>
                        <TableCell>{toBuddhistYear(row.academicYear)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            {/* Footer */}
            {total > 0 && (
              <div className="relative flex w-full flex-col items-center gap-4 md:flex-row">
                <p className="order-2 text-sm text-gray-500 md:absolute md:left-2 md:order-1">
                  แสดง {rangeStart}–{rangeEnd} จาก {total.toLocaleString("th-TH")} คน
                </p>
                <div className="order-1 flex w-full flex-1 justify-center md:order-2">
                  {totalPages > 1 && (
                    <Pagination
                      isCompact
                      showControls
                      showShadow
                      color="default"
                      page={page}
                      total={totalPages}
                      onChange={setPage}
                      classNames={{ cursor: "bg-sage text-white font-medium" }}
                    />
                  )}
                </div>
              </div>
            )}
          </CardBody>
        </Card>
    </div>
  );
}
