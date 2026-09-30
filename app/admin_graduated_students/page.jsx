"use client";

import {
  Button,
  Card,
  CardBody,
  Input,
  Pagination,
  Select,
  SelectItem,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/react";
import { ArrowLeft, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { HeadteacherNavbar } from "@/components/Headteacher";
import LoadingSpinner from "@/components/LoadingSpinner";

export default function GraduatedStudentsPage() {
  const router = useRouter();
  const [rows, setRows] = useState([]);
  const [years, setYears] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [year, setYear] = useState("all");
  const [roomType, setRoomType] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: "10",
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

  return (
    <>
      <HeadteacherNavbar />
      <main className="p-4 md:p-8">
        <div className="mb-6 flex items-center gap-3">
          <Button
            isIconOnly
            variant="light"
            className="rounded-full"
            onPress={() => router.back()}
          >
            <ArrowLeft size={20} />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              นักเรียนที่จบการศึกษา
            </h1>
            <p className="text-sm text-gray-500">
              ทะเบียนผู้จบแยกตามปีการศึกษา
            </p>
          </div>
        </div>

        <Card className="border border-gray-100 bg-white shadow-sm">
          <CardBody className="space-y-4 p-5">
            <div className="flex flex-wrap gap-3">
              <Input
                className="min-w-[240px] flex-1"
                placeholder="ค้นหารหัส ชื่อ หรือนามสกุล"
                startContent={<Search size={16} className="text-gray-400" />}
                value={search}
                onValueChange={(value) => {
                  setSearch(value);
                  setPage(1);
                }}
              />
              <Select
                className="w-full sm:w-56"
                label="ปีการศึกษาที่จบ"
                selectedKeys={[year]}
                onChange={(event) => {
                  setYear(event.target.value);
                  setPage(1);
                }}
              >
                <SelectItem key="all">ทุกปีการศึกษา</SelectItem>
                {years.map((item) => (
                  <SelectItem
                    key={String(item)}
                    textValue={String(Number(item) + 543)}
                  >
                    {Number(item) + 543}
                  </SelectItem>
                ))}
              </Select>
              <Select
                className="w-full sm:w-56"
                label="ห้องเดิม"
                selectedKeys={[roomType]}
                onChange={(event) => {
                  setRoomType(event.target.value);
                  setPage(1);
                }}
              >
                <SelectItem key="all">ทุกห้อง</SelectItem>
                {rooms.map((room) => (
                  <SelectItem
                    key={String(room.id)}
                    textValue={`ม.6 ห้อง ${room.name}`}
                  >
                    ม.6 ห้อง {room.name}
                  </SelectItem>
                ))}
              </Select>
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <LoadingSpinner size="md" />
              </div>
            ) : (
              <Table aria-label="รายชื่อนักเรียนที่จบการศึกษา">
                <TableHeader>
                  <TableColumn>รหัสนักเรียน</TableColumn>
                  <TableColumn>ชื่อ-นามสกุล</TableColumn>
                  <TableColumn>ห้องเดิม</TableColumn>
                  <TableColumn>ปีการศึกษาที่จบ</TableColumn>
                </TableHeader>
                <TableBody emptyContent="ยังไม่มีข้อมูลนักเรียนที่จบการศึกษา">
                  {rows.map((row) => (
                    <TableRow key={row.graduationId}>
                      <TableCell>{row.studentId}</TableCell>
                      <TableCell>
                        {row.prefixName || ""}
                        {row.firstname} {row.lastname}
                      </TableCell>
                      <TableCell>{row.classroom}</TableCell>
                      <TableCell>{Number(row.academicYear) + 543}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {totalPages > 1 && (
              <div className="flex justify-center">
                <Pagination page={page} total={totalPages} onChange={setPage} />
              </div>
            )}
          </CardBody>
        </Card>
      </main>
    </>
  );
}
