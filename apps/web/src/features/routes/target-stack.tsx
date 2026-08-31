"use client";

import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Badge, Button } from "@switchroute/ui";
import type { ProviderConnection, RouteTarget } from "@/features/shared/types";

function SortableTarget({ target, providers, onChange, onRemove }: { target: RouteTarget; providers: ProviderConnection[]; onChange: (target: RouteTarget) => void; onRemove: () => void }) {
  const id = target.id!;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const provider = providers.find((item) => item.id === target.provider_connection_id);
  const models = provider?.metadata.models ?? [];

  function chooseProvider(providerId: string) {
    const nextProvider = providers.find((item) => item.id === providerId);
    const firstModel = nextProvider?.metadata.models?.[0];
    onChange({ ...target, provider_connection_id: providerId, model_id: firstModel?.id ?? "", billing_tier: firstModel?.billing_tier ?? "unknown" });
  }

  function chooseModel(modelId: string) {
    const model = models.find((item) => item.id === modelId);
    onChange({ ...target, model_id: modelId, billing_tier: model?.billing_tier ?? "unknown" });
  }

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? .55 : 1 }} className="route-target-row">
      <button type="button" className="route-grip" {...attributes} {...listeners} aria-label="Reorder target">☰</button>
      <div className="route-target-fields">
        <select aria-label="Provider" className="sr-select" value={target.provider_connection_id} onChange={(event) => chooseProvider(event.target.value)}>{providers.map((item) => <option key={item.id} value={item.id}>{item.display_name}</option>)}</select>
        <select aria-label="Model" className="sr-select" value={target.model_id} onChange={(event) => chooseModel(event.target.value)}>{models.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}</select>
      </div>
      <Badge tone={target.billing_tier === "paid" ? "warning" : "success"}>{target.billing_tier.replace("_", " ")}</Badge>
      <Button type="button" className="sr-button-danger" onClick={onRemove} aria-label="Remove target">×</Button>
    </div>
  );
}

export function TargetStack({ targets, providers, onChange }: { targets: RouteTarget[]; providers: ProviderConnection[]; onChange: (targets: RouteTarget[]) => void }) {
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  function dragEnd(event: DragEndEvent) {
    if (!event.over || event.active.id === event.over.id) return;
    const oldIndex = targets.findIndex((item) => item.id === event.active.id);
    const newIndex = targets.findIndex((item) => item.id === event.over?.id);
    onChange(arrayMove(targets, oldIndex, newIndex));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={dragEnd}>
      <SortableContext items={targets.map((item) => item.id!)} strategy={verticalListSortingStrategy}>
        <div className="route-target-stack">{targets.map((target, index) => <SortableTarget key={target.id} target={target} providers={providers} onChange={(next) => onChange(targets.map((item, itemIndex) => itemIndex === index ? next : item))} onRemove={() => onChange(targets.filter((_, itemIndex) => itemIndex !== index))} />)}</div>
      </SortableContext>
    </DndContext>
  );
}
