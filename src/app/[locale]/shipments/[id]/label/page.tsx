import { ShipmentLabelView } from "@/features/shipments";

export default async function ShipmentLabelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ShipmentLabelView shipmentId={id} />;
}
