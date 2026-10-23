import { useId, type ReactNode } from 'react';

export type SheetView = 'memories' | 'skills' | 'resources';
const views: { id: SheetView; label: string }[] = [
  { id: 'memories', label: '기억' }, { id: 'skills', label: '기술' }, { id: 'resources', label: '자원' },
];

export function RecordTabs({ active, select, counts, children }: {
  active: SheetView;
  select: (view: SheetView) => void;
  counts: Record<SheetView, number>;
  children: ReactNode;
}) {
  const id = useId();
  return <>
    <div className="record-tabs" role="tablist" aria-label="현재 기록표 항목">
      {views.map((view, index) => <button key={view.id} id={`${id}-${view.id}`} type="button" role="tab"
        aria-selected={active === view.id} aria-controls={`${id}-panel`} tabIndex={active === view.id ? 0 : -1}
        onClick={() => select(view.id)} onKeyDown={event => {
          const next = event.key === 'ArrowRight' ? (index + 1) % views.length
            : event.key === 'ArrowLeft' ? (index + views.length - 1) % views.length
              : event.key === 'Home' ? 0 : event.key === 'End' ? views.length - 1 : -1;
          if (next < 0) return;
          event.preventDefault();
          select(views[next].id);
          document.getElementById(`${id}-${views[next].id}`)?.focus();
        }}><span>{view.label}</span><span>{counts[view.id]}</span></button>)}
    </div>
    <div className="sheet-scroll" id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${active}`} tabIndex={0}>{children}</div>
  </>;
}
