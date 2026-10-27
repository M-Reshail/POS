import React from 'react';
import { GripVertical, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { ColumnConfig, SortDirection } from '../../hooks/useReorderableColumns';

interface ReorderableThProps<TKey extends string> {
  column: ColumnConfig<TKey>;
  isDragging: boolean;
  isDragOver: boolean;
  dropPosition: 'left' | 'right' | null;
  sortField: TKey | null;
  sortDirection: SortDirection;
  onSort?: (id: TKey) => void;
  onDragStart: (id: TKey, e: React.DragEvent) => void;
  onDragOver: (id: TKey, e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (id: TKey, e: React.DragEvent) => void;
  onDragEnd: () => void;
  onTouchStart?: (id: TKey) => void;
  onTouchMove?: (e: React.TouchEvent) => void;
  onTouchEnd?: () => void;
  className?: string;
}

export function ReorderableTh<TKey extends string>({
  column,
  isDragging,
  isDragOver,
  dropPosition,
  sortField,
  sortDirection,
  onSort,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  className = '',
}: ReorderableThProps<TKey>) {
  const isSorted = sortField === column.id;
  const isSortable = column.sortable ?? true;
  const isReorderable = column.reorderable !== false;
  const align = column.align || 'left';

  const justifyClass =
    align === 'right'
      ? 'justify-end'
      : align === 'center'
      ? 'justify-center'
      : 'justify-start';

  return (
    <th
      data-column-id={isReorderable ? column.id : undefined}
      draggable={isReorderable ? true : false}
      onDragStart={isReorderable ? (e) => onDragStart(column.id, e) : undefined}
      onDragOver={isReorderable ? (e) => onDragOver(column.id, e) : undefined}
      onDragLeave={isReorderable ? onDragLeave : undefined}
      onDrop={isReorderable ? (e) => onDrop(column.id, e) : undefined}
      onDragEnd={isReorderable ? onDragEnd : undefined}
      style={{ minWidth: column.minWidth }}
      className={`sticky top-0 z-20 bg-surface-muted py-2.5 px-3 select-none transition-all group ${
        align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
      } ${isDragging ? 'opacity-40' : 'opacity-100'} ${className}`}
    >
      {/* Drop position indicator */}
      {isReorderable && isDragOver && dropPosition === 'left' && (
        <span className="absolute left-0 top-1 bottom-1 w-1 bg-brand-500 rounded-full z-30 pointer-events-none shadow-sm" />
      )}
      {isReorderable && isDragOver && dropPosition === 'right' && (
        <span className="absolute right-0 top-1 bottom-1 w-1 bg-brand-500 rounded-full z-30 pointer-events-none shadow-sm" />
      )}

      {/* Pill header container matching the reference screenshot */}
      <div
        onClick={() => {
          if (isSortable && onSort) {
            onSort(column.id);
          }
        }}
        title={
          isSortable
            ? isReorderable
              ? `Click to sort by ${column.label}, or drag to rearrange`
              : `Click to sort by ${column.label}`
            : isReorderable
            ? 'Drag to rearrange'
            : undefined
        }
        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-control text-[11px] font-bold uppercase tracking-wider transition-all duration-150 ${
          isReorderable
            ? 'cursor-grab active:cursor-grabbing'
            : isSortable
            ? 'cursor-pointer'
            : 'cursor-default'
        } ${justifyClass} ${
          isSorted
            ? 'bg-surface-elevated text-brand-600 border border-brand-500/30 shadow-xs'
            : 'text-ink-subtle hover:text-ink hover:bg-surface-muted/80 border border-transparent hover:border-border/60'
        }`}
      >
        {/* Drag handle 6-dots icon with touch event support - hidden if non-reorderable */}
        {isReorderable && (
          <span
            onTouchStart={(e) => {
              e.stopPropagation();
              onTouchStart?.(column.id);
            }}
            onTouchMove={(e) => {
              e.stopPropagation();
              onTouchMove?.(e);
            }}
            onTouchEnd={(e) => {
              e.stopPropagation();
              onTouchEnd?.();
            }}
            style={{ touchAction: 'none' }}
            className="cursor-grab active:cursor-grabbing text-ink-subtle/70 group-hover:text-ink-muted transition-colors flex-shrink-0 touch-none"
            title="Drag column to reorder"
          >
            <GripVertical size={13} />
          </span>
        )}

        {/* Column label */}
        <span className="truncate">{column.label}</span>

        {/* Sort indicator */}
        {isSortable && (
          <span className="flex-shrink-0 ml-0.5">
            {isSorted ? (
              sortDirection === 'asc' ? (
                <ArrowUp size={12} className="text-brand-600 font-bold" />
              ) : (
                <ArrowDown size={12} className="text-brand-600 font-bold" />
              )
            ) : (
              <ArrowUpDown size={11} className="text-ink-subtle/40 group-hover:text-ink-subtle/80 transition-colors" />
            )}
          </span>
        )}
      </div>
    </th>
  );
}
