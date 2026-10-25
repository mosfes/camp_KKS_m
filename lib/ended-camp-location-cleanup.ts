import { getBangkokDateAsUtcMidnight } from "@/lib/bangkok-date";
import { prisma } from "@/lib/db";

export async function clearEndedCampLocations() {
  const today = getBangkokDateAsUtcMidnight();
  const endedCamp = { end_date: { lt: today } };

  const [camps, enrollments, locations] = await prisma.$transaction([
    prisma.camp.updateMany({
      where: { ...endedCamp, location_sharing_enabled: true },
      data: { location_sharing_enabled: false },
    }),
    prisma.student_enrollment.updateMany({
      where: { camp: endedCamp, location_sharing_enabled: true },
      data: { location_sharing_enabled: false },
    }),
    prisma.student_location_update.deleteMany({
      where: { camp: endedCamp },
    }),
  ]);

  return {
    camps: camps.count,
    enrollments: enrollments.count,
    locations: locations.count,
  };
}
