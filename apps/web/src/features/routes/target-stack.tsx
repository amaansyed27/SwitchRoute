"use client";

import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/feedback";
import { Select } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import type { ProviderConnection, RouteTarget } from "@/features/shared/types";
import { providerMeta } from "@/features/providers/catalog";

function SortableTarget({ target, providers, position, onChange, onRemove }: { target: RouteTarget; providers: ProviderConnection[]; position: number; onChange: (target: RouteTarget) => void; onRemove: () => void }) {
  const id = target.id!;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const provider = providers.find((item) => item.id === target.provider_connection_id);
  const models = provider?.metadata.models ?? [];
  function chooseProvider(providerId: string) { const next = providers.find((item) => item.id === providerId); const model = next?.metadata.models?.[0]; onChange({ ...target, provider_connection_id: providerId, model_id: model?.id ?? "", billing_tier: model?.billing_tier ?? "unknown" }); }
  function chooseModel(modelId: string) { const model = models.find((item) => item.id === modelId); onChange({ ...target, model_id: modelId, billing_tier: model?.billing_tier ?? "unknown" }); }

  return <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? .55 : 1 }} className="grid grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
    <button type="button" className="grid size-8 place-items-center rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)]" {...attributes} {...listeners} aria-label={`Reorder target ${position}`}><Icon name="grip" className="size-4"/></button>
    <div className="grid min-w-0 gap-2 sm:grid-cols-[180px_minmax(0,1fr)]"><Select aria-label="Provider" value={target.provider_connection_id} onChange={(event) => chooseProvider(event.target.value)}>{providers.map((item) => <option key={item.id} value={item.id}>{providerMeta(item.provider_kind)?.name ?? item.display_name} · {item.display_name}</option>)}</Select><Select aria-label="Model" value={target.model_id} onChange={(event) => chooseModel(event.target.value)}>{models.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}</Select></div>
    <div className="flex items-center gap-2"><Badge tone={target.billing_tier === "paid" ? "warning" : "success"}>{target.billing_tier.replace("_", " ")}</Badge><Button variant="ghost" size="sm" onClick={onRemove} aria-label="Remove target"><Icon name="trash" className="size-3.5"/></Button></div>
  </div>;
}

export function TargetStack({ targets, providers, onChange }: { targets: RouteTarget[]; providers: ProviderConnection[]; onChange: (targets: RouteTarget[]) => void }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  function dragEnd(event: DragEndEvent) { if (!event.over || event.active.id === event.over.id) return; const oldIndex = targets.findIndex((item) => item.id === event.active.id); const newIndex = targets.findIndex((item) => item.id === event.over?.id); onChange(arrayMove(targets, oldIndex, newIndex)); }
  return <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={dragEnd}><SortableContext items={targets.map((item) => item.id!)} strategy={verticalListSortingStrategy}><div className="space-y-2">{targets.map((target, index) => <SortableTarget key={target.id} target={target} position={index + 1} providers={providers} onChange={(next) => onChange(targets.map((item, itemIndex) => itemIndex === index ? next : item))} onRemove={() => onChange(targets.filter((_, itemIndex) => itemIndex !== index))}/>)}</div></SortableContext></DndContext>;
}
