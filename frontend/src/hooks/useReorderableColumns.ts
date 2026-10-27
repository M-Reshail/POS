import { useState, useCallback, useRef } from 'react';

export interface ColumnConfig<TKey extends string = string> {
  id: TKey;
  label: string;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  reorderable?: boolean;
  minWidth?: string;
  className?: string;
}

export type SortDirection = 'asc' | 'desc' | null;

export function normalizeColumnOrder<TKey extends string>(cols: ColumnConfig<TKey>[]): ColumnConfig<TKey>[] {
  const reorderable = cols.filter((c) => c.reorderable !== false);
  const fixed = cols.filter((c) => c.reorderable === false);
  return [...reorderable, ...fixed];
}

interface UseReorderableColumnsOptions<TKey extends string> {
  storageKey: string;
  defaultColumns: ColumnConfig<TKey>[];
  initialSortField?: TKey | null;
  initialSortDirection?: SortDirection;
}

export function useReorderableColumns<TKey extends string>({
  storageKey,
  defaultColumns,
  initialSortField = null,
  initialSortDirection = null,
}: UseReorderableColumnsOptions<TKey>) {
  // 1. Column ordering with localStorage persistence
  const [columns, setColumns] = useState<ColumnConfig<TKey>[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const savedIds: TKey[] = JSON.parse(saved);
        if (Array.isArray(savedIds) && savedIds.length > 0) {
          const colMap = new Map(defaultColumns.map((c) => [c.id, c]));
          const restored: ColumnConfig<TKey>[] = [];
          for (const id of savedIds) {
            const col = colMap.get(id);
            if (col) {
              restored.push(col);
              colMap.delete(id);
            }
          }
          // append any default columns not present in saved order (e.g. newly introduced columns)
          for (const col of colMap.values()) {
            restored.push(col);
          }
          return normalizeColumnOrder(restored);
        }
      }
    } catch (e) {
      console.warn('[useReorderableColumns] Error reading storage:', e);
    }
    return normalizeColumnOrder(defaultColumns);
  });

  // 2. Sorting state
  const [sortField, setSortField] = useState<TKey | null>(initialSortField);
  const [sortDirection, setSortDirection] = useState<SortDirection>(initialSortDirection);

  // 3. Drag and Drop state (desktop + mobile touch)
  const [draggedColumnId, setDraggedColumnId] = useState<TKey | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<TKey | null>(null);
  const [dropPosition, setDropPosition] = useState<'left' | 'right' | null>(null);
  const isDraggingRef = useRef(false);

  // Persist column changes
  const saveColumns = useCallback(
    (newCols: ColumnConfig<TKey>[]) => {
      const normalized = normalizeColumnOrder(newCols);
      setColumns(normalized);
      try {
        localStorage.setItem(storageKey, JSON.stringify(normalized.map((c) => c.id)));
      } catch (e) {
        console.warn('[useReorderableColumns] Error saving storage:', e);
      }
    },
    [storageKey]
  );

  // Reorder helper
  const executeReorder = useCallback(
    (sourceId: TKey, targetId: TKey, position: 'left' | 'right') => {
      if (sourceId === targetId) return;

      const sourceCol = columns.find((c) => c.id === sourceId);
      const targetCol = columns.find((c) => c.id === targetId);
      if (!sourceCol || !targetCol) return;
      if (sourceCol.reorderable === false || targetCol.reorderable === false) return;

      const fromIndex = columns.findIndex((c) => c.id === sourceId);
      let toIndex = columns.findIndex((c) => c.id === targetId);

      if (fromIndex === -1 || toIndex === -1) return;

      if (position === 'right') {
        if (fromIndex > toIndex) {
          toIndex = toIndex + 1;
        }
      } else if (position === 'left') {
        if (fromIndex < toIndex) {
          toIndex = toIndex - 1;
        }
      }

      const newCols = Array.from(columns);
      const [moved] = newCols.splice(fromIndex, 1);
      newCols.splice(toIndex, 0, moved);

      saveColumns(normalizeColumnOrder(newCols));
    },
    [columns, saveColumns]
  );

  // Move column left or right by 1 position (useful for mobile step buttons)
  const moveColumn = useCallback(
    (id: TKey, direction: 'left' | 'right') => {
      const index = columns.findIndex((c) => c.id === id);
      if (index === -1) return;
      const col = columns[index];
      if (col.reorderable === false) return;

      const targetIndex = direction === 'left' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= columns.length) return;
      const targetCol = columns[targetIndex];
      if (targetCol.reorderable === false) return;

      const newCols = Array.from(columns);
      const [moved] = newCols.splice(index, 1);
      newCols.splice(targetIndex, 0, moved);
      saveColumns(normalizeColumnOrder(newCols));
    },
    [columns, saveColumns]
  );

  // Check if current order differs from default
  const isCustomOrder = columns.some((col, idx) => col.id !== defaultColumns[idx]?.id);

  // Reset order to default
  const resetColumns = useCallback(() => {
    setColumns(normalizeColumnOrder(defaultColumns));
    setSortField(initialSortField);
    setSortDirection(initialSortDirection);
    try {
      localStorage.removeItem(storageKey);
    } catch {}
  }, [defaultColumns, storageKey, initialSortField, initialSortDirection]);

  // Handle Sort toggle
  const handleSort = useCallback(
    (id: TKey) => {
      // Don't trigger sort if a drag just ended
      if (isDraggingRef.current) return;

      if (sortField !== id) {
        setSortField(id);
        setSortDirection('asc');
      } else if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortField(null);
        setSortDirection(null);
      }
    },
    [sortField, sortDirection]
  );

  // Desktop Drag handlers (HTML5 Drag & Drop)
  const handleDragStart = useCallback(
    (id: TKey, e: React.DragEvent) => {
      const col = columns.find((c) => c.id === id);
      if (col?.reorderable === false) return;
      isDraggingRef.current = true;
      setDraggedColumnId(id);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', id);
    },
    [columns]
  );

  const handleDragOver = useCallback(
    (id: TKey, e: React.DragEvent) => {
      const col = columns.find((c) => c.id === id);
      if (col?.reorderable === false) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const rect = e.currentTarget.getBoundingClientRect();
      const isRight = e.clientX - rect.left > rect.width / 2;
      setDropPosition(isRight ? 'right' : 'left');
      setDragOverColumnId(id);
    },
    [columns]
  );

  const handleDragLeave = useCallback(() => {
    setDragOverColumnId(null);
    setDropPosition(null);
  }, []);

  const handleDrop = useCallback(
    (targetId: TKey, e: React.DragEvent) => {
      e.preventDefault();
      const targetCol = columns.find((c) => c.id === targetId);
      if (targetCol?.reorderable !== false && draggedColumnId && dropPosition) {
        executeReorder(draggedColumnId, targetId, dropPosition);
      }
      setDraggedColumnId(null);
      setDragOverColumnId(null);
      setDropPosition(null);
      setTimeout(() => {
        isDraggingRef.current = false;
      }, 50);
    },
    [draggedColumnId, dropPosition, executeReorder, columns]
  );

  const handleDragEnd = useCallback(() => {
    setDraggedColumnId(null);
    setDragOverColumnId(null);
    setDropPosition(null);
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 50);
  }, []);

  // Mobile Touch handlers (Touch Events)
  const handleTouchStart = useCallback(
    (id: TKey) => {
      const col = columns.find((c) => c.id === id);
      if (col?.reorderable === false) return;
      isDraggingRef.current = true;
      setDraggedColumnId(id);
    },
    [columns]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!draggedColumnId) return;
      const touch = e.touches[0];
      if (!touch) return;

      const elem = document.elementFromPoint(touch.clientX, touch.clientY);
      const th = elem?.closest('th[data-column-id]');
      if (th) {
        const targetId = th.getAttribute('data-column-id') as TKey;
        if (targetId) {
          const targetCol = columns.find((c) => c.id === targetId);
          if (targetCol?.reorderable === false) return;
          const rect = th.getBoundingClientRect();
          const isRight = touch.clientX - rect.left > rect.width / 2;
          setDragOverColumnId(targetId);
          setDropPosition(isRight ? 'right' : 'left');
        }
      }
    },
    [draggedColumnId, columns]
  );

  const handleTouchEnd = useCallback(() => {
    if (draggedColumnId && dragOverColumnId && dropPosition) {
      const targetCol = columns.find((c) => c.id === dragOverColumnId);
      if (targetCol?.reorderable !== false) {
        executeReorder(draggedColumnId, dragOverColumnId, dropPosition);
      }
    }
    setDraggedColumnId(null);
    setDragOverColumnId(null);
    setDropPosition(null);
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 50);
  }, [draggedColumnId, dragOverColumnId, dropPosition, executeReorder, columns]);

  return {
    columns,
    sortField,
    sortDirection,
    draggedColumnId,
    dragOverColumnId,
    dropPosition,
    isCustomOrder,
    handleSort,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDragEnd,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    moveColumn,
    resetColumns,
  };
}
