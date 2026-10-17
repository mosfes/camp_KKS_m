import BusLayoutManager from "../../components/BusLayoutManager";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";

export default async function BusLayoutEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numericId = /^[1-9]\d*$/.test(id) ? Number(id) : null;
  const template = await prisma.bus_layout_template.findFirst({
    where: numericId !== null && Number.isSafeInteger(numericId)
      ? { template_id: numericId }
      : { public_id: id },
    select: { template_id: true, public_id: true },
  });
  if (!template) notFound();
  if (numericId !== null) redirect(`/admin_add_user/bus-layout/${template.public_id}`);

  return (
    <div className="m-4 md:m-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">จัดเลย์เอาท์รถ</h1>
        <p className="mt-1 text-sm text-gray-500">
          ลากที่นั่ง ประตู และห้องน้ำลงบนผัง แล้วบันทึกหรือเผยแพร่ให้หัวหน้าค่าย
        </p>
      </div>
      <BusLayoutManager
        mode="editor"
        templateId={template.template_id}
      />
    </div>
  );
}
